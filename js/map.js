import { state } from "./state.js";
import { escapeHtml } from "./utils.js";

let map;
let userMarker;
let occurrencesLayer;

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

  occurrencesLayer = L.layerGroup().addTo(map);
}

export function setLocation(lat, lon){
  state.userLat = lat;
  state.userLon = lon;
  userMarker.setLatLng([lat, lon]);
  map.setView([lat, lon], 13, { animate:true });
}

export function plotAllOccurrences(){
  occurrencesLayer.clearLayers();

  const pts = [];
  for(const p of state.plants){
    for(const o of (p.occurrences || [])){
      const lat = o.decimalLatitude;
      const lon = o.decimalLongitude;
      if(typeof lat !== "number" || typeof lon !== "number") continue;

      pts.push([lat, lon]);

      const date = o.eventDate || "unknown date";
      const locality = o.verbatimLocality || "";
      const recordedBy = o.recordedBy ? `Recorded by: ${o.recordedBy}` : "";

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
        `${escapeHtml(recordedBy)}`
      )
      .addTo(occurrencesLayer);
    }
  }

  if(pts.length){
    map.fitBounds(L.latLngBounds(pts), { padding:[20,20] });
  }
}

export function showPlantOnMap(plant){
  occurrencesLayer.clearLayers();

  const pts = [];
  for(const o of (plant.occurrences || [])){
    const lat = o.decimalLatitude;
    const lon = o.decimalLongitude;
    if(typeof lat !== "number" || typeof lon !== "number") continue;

    pts.push([lat, lon]);

    const date = o.eventDate || "unknown date";
    const locality = o.verbatimLocality || "";
    const recordedBy = o.recordedBy ? `Recorded by: ${o.recordedBy}` : "";

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
      `${escapeHtml(recordedBy)}`
    )
    .addTo(occurrencesLayer);
  }

  if(pts.length){
    map.fitBounds(L.latLngBounds(pts), { padding:[20,20] });
  }
}
