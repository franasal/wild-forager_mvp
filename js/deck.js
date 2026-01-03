import { state } from "./state.js";
import { monthIndex, monthLabel, escapeHtml, seasonBadge, haversineKm } from "./utils.js";

function plantNearestDistanceKm(plant, lat, lon){
  let best = Infinity;
  for(const o of (plant.occurrences || [])){
    const olat = o.decimalLatitude;
    const olon = o.decimalLongitude;
    if(typeof olat !== "number" || typeof olon !== "number") continue;
    const d = haversineKm(lat, lon, olat, olon);
    if(d < best) best = d;
  }
  return best;
}

function sortedPlants(){
  const m = monthIndex();
  const base = state.selectedPlants.length ? state.selectedPlants : state.plants;
  const arr = [...base].map(p => {
    const season = (p.seasonality && p.seasonality[m]) ? p.seasonality[m] : "Low";
    const seasonRank = (season === "High") ? 3 : (season === "Medium" ? 2 : 1);
    const dist = plantNearestDistanceKm(p, state.userLat, state.userLon);
    return { p, season, seasonRank, dist };
  });

  arr.sort((a,b) =>
    (a.dist - b.dist) ||
    (b.seasonRank - a.seasonRank) ||
    ((b.p.frequency || 0) - (a.p.frequency || 0)) ||
    (a.p.commonName || "").localeCompare(b.p.commonName || "")
  );

  return arr;
}

export function renderDeck({ onSelectPlant }){
  const deckEl = document.getElementById("deck");
  const hudMonthEl = document.getElementById("hudMonth");
  const hudCountEl = document.getElementById("hudCount");
  const metaDateEl = document.getElementById("metaDate");

  hudMonthEl.textContent = monthLabel();
  metaDateEl.textContent = monthLabel();

  const items = sortedPlants();
  hudCountEl.textContent = String(items.length);

  deckEl.innerHTML = "";

  for(const {p, season, dist} of items){
    const {label, cls} = seasonBadge(season);
    const obs = Number.isFinite(p.frequency) ? p.frequency : ((p.occurrences || []).length);
    const distText = (dist === Infinity) ? "no points" : `${dist.toFixed(1)} km`;

    const imgUrl = p.image?.filePath || "";
    const imgHtml = imgUrl
      ? `<img class="miniPhoto" src="${escapeHtml(imgUrl)}" alt="${escapeHtml(p.commonName || p.scientificName || "plant")}">`
      : `<div class="miniPhotoFallback">No image</div>`;

    const card = document.createElement("div");
    card.className = "cardMini";
    card.innerHTML = `
      <div class="miniTop">
        <div class="miniName">
          <strong>${escapeHtml(p.commonName || "Unknown")}</strong>
          <em>${escapeHtml(p.scientificName || "")}</em>
        </div>
        <div class="badge ${cls}">${label}</div>
      </div>
      <div class="miniVisual">${imgHtml}</div>
      <div class="miniBottom">
        <span>Obs: <b>${obs}</b> · Nearest: <b>${distText}</b></span>
        <span><b>${escapeHtml(season)}</b></span>
      </div>
    `;

    card.addEventListener("click", () => onSelectPlant(p));
    deckEl.appendChild(card);
  }
}
