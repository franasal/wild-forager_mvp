import { state } from "./state.js";
import { initMap, setLocation, plotAllOccurrences, showPlantOnMap, showHotspots } from "./map.js";
import { renderDeck } from "./deck.js";
import { initSpecimen, openSpecimen } from "./specimen.js";
import { initRiskModal } from "./risk.js";
import { aggregateHotspots, mergeHotspots } from "./hotspots.js";
import { loadDataset, recomputeSelection, recomputeLocalStatsIfMoved } from "./data.js";


function debug(msg){
  console.log("[Wilder]", msg);
  const el = document.getElementById("debugPill");
  if(el) el.textContent = "Boot: " + msg;
}

function initTheme(){
  const saved = localStorage.getItem("wilder_theme");
  if(saved === "light") document.body.classList.add("light");

  const btn = document.getElementById("btnTheme");
  const setLabel = () => {
    const isLight = document.body.classList.contains("light");
    btn.textContent = isLight ? "Dark" : "Bright";
  };

  setLabel();

  btn.addEventListener("click", () => {
    document.body.classList.toggle("light");
    localStorage.setItem("wilder_theme", document.body.classList.contains("light") ? "light" : "dark");
    setLabel();
  });
}

async function loadPlants(){
  debug("loadPlants()");

  document.getElementById("hudMode").textContent = "Loading data…";

  const res = await fetch("data/plants.json", { cache: "no-store" });
  if(!res.ok) throw new Error("Failed to load data/plants.json");

  const data = await res.json();

  state.region = data.region || {
    name: "Leipzig (demo)",
    center: { lat: 51.3397, lon: 12.3731 }
  };

  const rawPlants = data.plants || [];
  state.plants = rawPlants.map(p => {
    const demoOcc = (p.demo && Array.isArray(p.demo.occurrences)) ? p.demo.occurrences : [];
    const occurrences = demoOcc.map(o => ({
      decimalLatitude: o.lat,
      decimalLongitude: o.lon,
      eventDate: o.date,
      occurrenceCount: o.gbif_occurrence_count,
      verbatimLocality: p.demo?.region || "",
      recordedBy: ""
    }));

    const frequency = occurrences.reduce((sum, o) => sum + (Number(o.occurrenceCount) || 1), 0);

    return {
      ...p,
      occurrences,
      frequency
    };
  });

  document.getElementById("regionPill").textContent =
    `Region: ${state.region?.name || "Local Starter Pack"}`;

  document.getElementById("hudMode").textContent =
    "Wikimedia images + demo occurrences (MVP)";

  debug(`loaded ${state.plants.length} plants`);
}

function locate(){
  debug("locate()");
  if(!navigator.geolocation) return;

  navigator.geolocation.getCurrentPosition(
    (pos) => {
      setLocation(pos.coords.latitude, pos.coords.longitude);
      recomputeLocalStatsIfMoved(1.0);
      recomputeSelection();
      renderDeck({ onSelectPlant });
    },
    () => {},
    { enableHighAccuracy:true, timeout: 8000, maximumAge: 60000 }
  );
}

function onSelectPlant(plant){
  showPlantOnMap(plant);
  openSpecimen(plant);
}

function lastDaysRange(days){
  const end = new Date();
  const start = new Date(end.getTime() - days * 24 * 60 * 60 * 1000);
  return { start, end };
}

function showAllHotspots(){
  debug("showAllHotspots()");
  const { start, end } = lastDaysRange(365);
  const plants = (state.selectedPlants && state.selectedPlants.length)
  ? state.selectedPlants
  : state.plants;

const perPlant = plants.map(p =>
  aggregateHotspots(p.occurrences || [], { gridKm: 1, start, end })
);

  const merged = mergeHotspots(perPlant);
  showHotspots(merged, { title: "All plants (last 365 days)" });
}

function wireButtons(){
  debug("wireButtons()");
  document.getElementById("btnLocate").addEventListener("click", locate);
  document.getElementById("btnAll").addEventListener("click", plotAllOccurrences);
  document.getElementById("btnResort").addEventListener("click", () => renderDeck({ onSelectPlant }));
  document.getElementById("btnHotspots").addEventListener("click", showAllHotspots);
}

async function main(){
  debug("start");

  try{
    debug("initMap()");
    initMap();

    debug("initSpecimen()");
    initSpecimen();

    debug("initRiskModal()");
    initRiskModal();

    debug("wireButtons()");
    wireButtons();
    initTheme();

    await loadDataset();

    if(state.region?.center && typeof state.region.center.lat === "number" && typeof state.region.center.lon === "number"){
      setLocation(state.region.center.lat, state.region.center.lon);
    }

    // Top-N control
    const topNEl = document.getElementById("topN");
    if(topNEl){
      topNEl.addEventListener("change", () => {
        state.filters = state.filters || {};
        state.filters.topN = Number(topNEl.value) || 12;

        recomputeSelection();
        renderDeck({ onSelectPlant });
        plotAllOccurrences();
        showAllHotspots();
      });
    }

    // Optional live GBIF block (only runs if the function exists)
    if(typeof fetchOccurrencesByTaxa === "function"){
      const lat = state.userLat;
      const lon = state.userLon;

      if(typeof lat === "number" && typeof lon === "number"){
        const plantsWithKeys = state.plants.filter(p => Number.isFinite(p.taxonKey));
        if(plantsWithKeys.length){
          document.getElementById("hudMode").textContent = "Fetching GBIF observations…";

          const { byTaxonKey, total } = await fetchOccurrencesByTaxa(lat, lon, plantsWithKeys, {
            radiusKm: 10,
            limit: 300
          });

          for(const p of state.plants){
            if(!Number.isFinite(p.taxonKey)) continue;
            const occ = byTaxonKey.get(p.taxonKey) || [];
            p.occurrences = occ;
            p.frequency = occ.length;
          }

          // Recompute top-N after overwriting occurrences
          recomputeSelection();

          document.getElementById("hudMode").textContent = `GBIF loaded: ${total} records (10km)`;
          debug(`GBIF total ${total}`);
        } else {
          document.getElementById("hudMode").textContent = "No GBIF taxon keys available (offline dataset).";
        }
      } else {
        debug("GBIF skipped (no location)");
      }
    }

    // Initial render
    showAllHotspots();
    renderDeck({ onSelectPlant });
    locate();

    debug("ok");
  } catch(e){
    console.error(e);
    document.getElementById("hudMode").textContent = "Startup error: " + (e?.message || e);
    document.getElementById("regionPill").textContent = "Region: Error";
    debug("ERROR");
  }
}

main();
