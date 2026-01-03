import { state } from "./state.js";
import { escapeHtml } from "./utils.js";

let map;
let userMarker;
let occurrencesLayer;
let hotspotsLayer;

export function initMap(){
  map = L.map("map", { zoomControl:false }).setView([state.userLat, state.userLon], 12);
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19 }).addTo(map);

  userMarker = L.circleMarker([state.userLat, state.userLon], {
    radius: 7,
    weight: 2,
    color: "rgba(126,231,135,.85)",
    fillColor: "rgba(126,231,135,.20)",
    fillOpacity: 1
  }).addTo(map);

  hotspotsLayer = L.layerGroup().addTo(map);
  occurrencesLayer = L.layerGroup().addTo(map);
}

export function setLocation(lat, lon){
  state.userLat = lat;
  state.userLon = lon;
  userMarker.setLatLng([lat, lon]);
  map.setView([lat, lon], 13, { animate:true });
}

export function clearMapLayers(){
  hotspotsLayer.clearLayers();
  occurrencesLayer.clearLayers();
}

export function showHotspots(hotspots, opts = {}){
  clearMapLayers();

  const pts = [];
  const title = opts.title || "Hotspot";

  const cells = hotspots?.cells || [];
  if(!cells.length) return;

  const max = Math.max(...cells.map(c => c.count || 0), 1);

  for(const c of cells){
    const lat = c.lat;
    const lon = c.lon;
    if(typeof lat !== "number" || typeof lon !== "number") continue;

    pts.push([lat, lon]);
    const count = c.count || 0;

    const totalLine = Number.isFinite(c.totalCount)
      ? `Total (window): <b>${escapeHtml(String(c.totalCount))}</b><br>`
      : "";

    const seasonLine = Number.isFinite(c.seasonCount)
      ? `Season (prev/this/next): <b>${escapeHtml(String(c.seasonCount))}</b><br>`
      : "";

    L.circleMarker([lat, lon], {
      radius,
      weight: 1,
      color: "rgba(126,231,135,.65)",
      fillColor: "rgba(126,231,135,.35)",
      fillOpacity
    })
    .bindPopup(
      `<b>${escapeHtml(title)}</b><br>` +
      seasonLine +
      totalLine +
      `Intensity: <b>${escapeHtml(String(count))}</b>`
    )
    .addTo(hotspotsLayer);

  map.fitBounds(L.latLngBounds(pts), { padding:[20,20] });
}

export function plotAllOccurrences(){
  clearMapLayers();

  const pts = [];
  const plants = (state.selectedPlants && state.selectedPlants.length)
  ? state.selectedPlants
  : state.plants;

  for(const p of plants){


    for(const o of (p.occurrences || [])){
      const lat = o.decimalLatitude;
      const lon = o.decimalLongitude;
      if(typeof lat !== "number" || typeof lon !== "number") continue;

      pts.push([lat, lon]);

      const date = o.eventDate || "unknown date";
      const locality = o.verbatimLocality || "";
      const count = (o.occurrenceCount != null) ? `Count: ${o.occurrenceCount}` : "";

      L.circleMarker([lat, lon], {
        radius: 4,
        weight: 1,
        color: "rgba(126,231,135,.75)",
        fillColor: "rgba(126,231,135,.25)",
        fillOpacity: 1
      })
      .bindPopup(
        `<b>${escapeHtml(p.commonName || "")}</b><br>` +
        `${escapeHtml(p.scientificName || "")}<br>` +
        `${escapeHtml(date)}<br>` +
        `${escapeHtml(locality)}<br>` +
        `${escapeHtml(count)}`
      )
      .addTo(occurrencesLayer);
    }
  }

  if(pts.length){
    map.fitBounds(L.latLngBounds(pts), { padding:[20,20] });
  }
}

export function showPlantOnMap(plant){
  clearMapLayers();

  const pts = [];
  for(const o of (plant.occurrences || [])){
    const lat = o.decimalLatitude;
    const lon = o.decimalLongitude;
    if(typeof lat !== "number" || typeof lon !== "number") continue;

    pts.push([lat, lon]);

    const date = o.eventDate || "unknown date";
    const locality = o.verbatimLocality || "";
    const count = (o.occurrenceCount != null) ? `Count: ${o.occurrenceCount}` : "";

    L.circleMarker([lat, lon], {
      radius: 5,
      weight: 1,
      color: "rgba(255,204,102,.85)",
      fillColor: "rgba(255,204,102,.25)",
      fillOpacity: 1
    })
    .bindPopup(
      `<b>${escapeHtml(plant.commonName || "")}</b><br>` +
      `${escapeHtml(plant.scientificName || "")}<br>` +
      `${escapeHtml(date)}<br>` +
      `${escapeHtml(locality)}<br>` +
      `${escapeHtml(count)}`
    )
    .addTo(occurrencesLayer);
  }

  if(pts.length){
    map.fitBounds(L.latLngBounds(pts), { padding:[20,20] });
  }
}
