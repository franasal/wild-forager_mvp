import { state } from "./state.js";
import { escapeHtml, haversineKm, monthLabel } from "./utils.js";

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

function rarityBadge(rarity){
  // Map rarity -> label/class used by CSS badge colors
  if(rarity === "Common") return { label: "Common", cls: "common" };
  if(rarity === "Medium") return { label: "Medium", cls: "medium" };
  if(rarity === "Rare") return { label: "Rare", cls: "rare" };
  return { label: "Unknown", cls: "medium" };
}

function sortedPlants(){
  const base = (state.selectedPlants && state.selectedPlants.length)
    ? state.selectedPlants
    : state.plants;

  const arr = [...base].map(p => {
    const dist = plantNearestDistanceKm(p, state.userLat, state.userLon);
    const local = Number.isFinite(p.localCount10km) ? p.localCount10km : 0;
    const total = Number.isFinite(p.total) ? p.total : 0;
    return { p, dist, local, total };
  });

  // Sort: local relevance first, then nearest point, then global total, then name
  arr.sort((a,b) =>
    (b.local - a.local) ||
    (a.dist - b.dist) ||
    (b.total - a.total) ||
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

  for(const {p, dist, local, total} of items){
    const {label, cls} = rarityBadge(p.rarity);

    const totalText = Number.isFinite(p.total) ? `${p.total} total` : "total ?";
    const obsText = `${local} near · ${totalText}`;
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
        <div class="badge ${cls}">${escapeHtml(label)}</div>
      </div>
      <div class="miniVisual">${imgHtml}</div>
      <div class="miniBottom">
        <span>Obs: <b>${escapeHtml(obsText)}</b> · Nearest: <b>${escapeHtml(distText)}</b></span>
        <span><b>${escapeHtml(p.rarity || "Unknown")}</b></span>
      </div>
    `;

    card.addEventListener("click", () => onSelectPlant(p));
    deckEl.appendChild(card);
  }
}
