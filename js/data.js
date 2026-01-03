import { state } from "./state.js";

// --------------------
// helpers
// --------------------
function toEventDate(year, month){
  if(!Number.isFinite(year)) return null;
  const m = Number.isFinite(month) ? String(month).padStart(2, "0") : "01";
  return `${year}-${m}-01`;
}

function haversineKm(lat1, lon1, lat2, lon2){
  const R = 6371;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

function monthIndexFromEventDate(s){
  if(!s) return null;
  const m = Number(String(s).slice(5,7));
  if(!Number.isFinite(m) || m < 1 || m > 12) return null;
  return m - 1;
}

async function fetchJsonOrNull(url){
  try{
    const res = await fetch(url, { cache: "no-store" });
    if(!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

// --------------------
// normalization
// --------------------
function normalizePlant({ sciName, deName, taxonKey, points, yearCounts, total, image }){
  // points tuples: [lat, lon, year, month]
  const occurrences = (points || []).map(t => {
    const lat = t[0], lon = t[1], year = t[2], month = t[3];
    return {
      decimalLatitude: lat,
      decimalLongitude: lon,
      year,
      month,
      eventDate: toEventDate(year, month),
      occurrenceCount: 1,
      verbatimLocality: state.region?.name || "",
      recordedBy: ""
    };
  });

  // all-time month counts
  const monthCountsAll = Array(12).fill(0);
  for(const o of occurrences){
    const mi = monthIndexFromEventDate(o.eventDate);
    if(mi != null) monthCountsAll[mi] += 1;
  }

  // last 3 years month counts (rolling)
  const nowYear = new Date().getFullYear();
  const yearFrom = nowYear - 2;
  const monthCountsLast3Y = Array(12).fill(0);
  for(const o of occurrences){
    const y = Number(o.year);
    const m = Number(o.month);
    if(!Number.isFinite(y) || !Number.isFinite(m)) continue;
    if(y < yearFrom || y > nowYear) continue;
    if(m < 1 || m > 12) continue;
    monthCountsLast3Y[m - 1] += 1;
  }

  return {
    id: sciName,
    commonName: deName || sciName,
    scientificName: sciName,
    taxonKey: Number.isFinite(taxonKey) ? taxonKey : undefined,

    // true counts (NOT capped)
    total: Number.isFinite(total) ? total : undefined,
    yearCounts: yearCounts || {},

    // capped points (for rendering)
    occurrences,
    frequency: occurrences.length,

    // optional UI assets
    image: image || null,

    // computed per user location
    localCount10km: 0,
    localMonthCounts10km: Array(12).fill(0),

    // seasonality helpers
    monthCountsAll,
    monthCountsLast3Y,

    rarity: "Unknown"
  };
}

// --------------------
// dataset load
// --------------------
export async function loadDataset(){
  const res = await fetch("data/occurrences_compact.json", { cache: "no-store" });
  if(!res.ok) throw new Error("Failed to load data/occurrences_compact.json");
  const data = await res.json();

  // meta / region
  state.region = data.region || state.region || {
    name: "Germany (offline)",
    center: { lat: 51.3397, lon: 12.3731 }
  };

  // optional images map (keep it optional so the app still boots)
  const images = await fetchJsonOrNull("data/plants_wikipedia_images.json");

  const plantsObj = data.plants || {};
  const plants = [];

  for(const sciName of Object.keys(plantsObj)){
    const p = plantsObj[sciName] || {};
    plants.push(normalizePlant({
      sciName,
      deName: p.de || p.german_name || "",
      taxonKey: p.taxonKey,
      points: p.points || [],
      yearCounts: p.year_counts || p.years || {},
      total: p.total,
      image: images?.[sciName] || null,
    }));
  }

  state.plants = plants;

  assignRarityBadges();

  // initial selection
  recomputeSelection();

  // initial local stats (if we already have a location)
  recomputeLocalStatsIfMoved(1.0);

  return state.plants;
}

// --------------------
// local stats near user
// --------------------
export function recomputeLocalStatsIfMoved(thresholdKm = 1.0){
  const lat = state.userLat;
  const lon = state.userLon;
  if(typeof lat !== "number" || typeof lon !== "number") return;

  const prev = state._lastStatsLocation;
  if(prev && typeof prev.lat === "number" && typeof prev.lon === "number"){
    const moved = haversineKm(prev.lat, prev.lon, lat, lon);
    if(moved < thresholdKm) return; // skip recompute
  }

  state._lastStatsLocation = { lat, lon };

  const radiusKm = 10;
  for(const p of state.plants){
    let c = 0;
    const monthCounts = Array(12).fill(0);

    for(const o of (p.occurrences || [])){
      const olat = o.decimalLatitude;
      const olon = o.decimalLongitude;
      if(typeof olat !== "number" || typeof olon !== "number") continue;

      const d = haversineKm(lat, lon, olat, olon);
      if(d > radiusKm) continue;

      c += 1;
      const mi = monthIndexFromEventDate(o.eventDate);
      if(mi != null) monthCounts[mi] += 1;
    }

    p.localCount10km = c;
    p.localMonthCounts10km = monthCounts;
  }
}

// --------------------
// rarity (global) via quantiles on total counts
// --------------------
function computeQuantile(sortedArr, q){
  if(!sortedArr.length) return 0;
  const pos = (sortedArr.length - 1) * q;
  const base = Math.floor(pos);
  const rest = pos - base;
  const a = sortedArr[base];
  const b = sortedArr[Math.min(base + 1, sortedArr.length - 1)];
  return a + rest * (b - a);
}

function assignRarityBadges(){
  const totals = state.plants
    .map(p => Number(p.total))
    .filter(v => Number.isFinite(v) && v > 0)
    .sort((a,b) => a - b);

  if(!totals.length){
    for(const p of state.plants) p.rarity = "Unknown";
    return;
  }

  const p25 = computeQuantile(totals, 0.25);
  const p75 = computeQuantile(totals, 0.75);

  for(const p of state.plants){
    const t = Number(p.total);
    if(!Number.isFinite(t) || t <= 0){
      p.rarity = "Unknown";
    } else if(t < p25){
      p.rarity = "Rare";
    } else if(t >= p75){
      p.rarity = "Common";
    } else {
      p.rarity = "Medium";
    }
  }
}

// --------------------
// selection
// --------------------
export function recomputeSelection(){
  state.filters = state.filters || {};
  const topN = Math.max(1, Number(state.filters.topN) || 12);

  // prefer "near you" then total
  const sorted = [...state.plants].sort((a,b) =>
    (b.localCount10km || 0) - (a.localCount10km || 0) ||
    (Number(b.total) || 0) - (Number(a.total) || 0) ||
    (a.commonName || "").localeCompare(b.commonName || "")
  );

  state.selectedPlants = sorted.slice(0, topN);
}
