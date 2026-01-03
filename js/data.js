import { state } from "./state.js";

function toEventDate(year, month){
  if(!Number.isFinite(year)) return null;
  const m = Number.isFinite(month) ? String(month).padStart(2, "0") : "01";
  return `${year}-${m}-01`;
}

function normalizePlant({ sciName, deName, taxonKey, points, yearCounts }){
  // points can be tuples: [lat, lon, year, month]
  const occurrences = (points || []).map(t => {
    const lat = t[0], lon = t[1], year = t[2], month = t[3];
    return {
      decimalLatitude: lat,
      decimalLongitude: lon,
      eventDate: toEventDate(year, month),
      occurrenceCount: 1,
      verbatimLocality: state.region?.name || "",
      recordedBy: ""
    };
  });

  const frequency = occurrences.length;

  return {
    id: sciName,
    commonName: deName || sciName,
    scientificName: sciName,
    taxonKey: Number.isFinite(taxonKey) ? taxonKey : undefined,
    yearCounts: yearCounts || {}, // for later charts
    occurrences,
    frequency
  };
}

export async function loadDataset(){
  const res = await fetch("data/occurrences_compact.json", { cache: "no-store" });
  if(!res.ok) throw new Error("Failed to load data/occurrences_compact.json");
  const data = await res.json();

  // meta / region
  state.region = data.region || state.region || {
    name: "Germany (offline)",
    center: { lat: 51.3397, lon: 12.3731 }
  };

  const plantsObj = data.plants || {};
  const plants = [];

  for(const sciName of Object.keys(plantsObj)){
    const p = plantsObj[sciName] || {};
    plants.push(normalizePlant({
      sciName,
      deName: p.de || p.german_name || "",
      taxonKey: p.taxonKey,
      points: p.points || [],
      yearCounts: p.year_counts || p.years || {}
    }));
  }

  state.plants = plants;

  // initial selection = top N by frequency
  recomputeSelection();

  return state.plants;
}

export function recomputeSelection(){
  const topN = Math.max(1, Number(state.filters.topN) || 12);

  // If you want "top by Germany total", you can use p.total later.
  const sorted = [...state.plants].sort((a,b) =>
    (b.frequency || 0) - (a.frequency || 0) ||
    (a.commonName || "").localeCompare(b.commonName || "")
  );

  state.selectedPlants = sorted.slice(0, topN);
                                        }
