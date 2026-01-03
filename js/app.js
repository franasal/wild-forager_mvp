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

function onSelectPlant(plant){
  showPlantOnMap(plant);
  openSpecimen(plant);
}

function lastDaysRange(days){
  const end = new Date();
  const start = new Date(end.getTime() - days * 24 * 60 * 60 * 1000);
  return { start, end };
}

function seasonalizeHotspots(hs){
  const cells = hs?.cells || [];
  if(!cells.length) return hs;

  const m = (new Date()).getMonth(); // 0..11
  const prev = (m + 11) % 12;
  const next = (m + 1) % 12;

  const out = {
    ...hs,
    cells: cells.map(c => {
      const mc = Array.isArray(c.monthCounts) ? c.monthCounts : Array(12).fill(0);
      const seasonCount = (mc[prev] || 0) + (mc[m] || 0) + (mc[next] || 0);
      return {
        ...c,
        totalCount: c.count || 0,
        seasonCount,
        count: seasonCount // IMPORTANT: this drives radius/intensity in map.js
      };
    }).sort((a,b) => (b.count || 0) - (a.count || 0))
  };

  return out;
}

function showAllHotspots(){
  debug("showAllHotspots()");

  const mode = state.filters?.sortMode || "timeless";
  const days = (mode === "season") ? (365 * 3) : 365; // season mode uses last 3 years
  const { start, end } = lastDaysRange(days);

  const plants = (state.selectedPlants && state.selectedPlants.length)
    ? state.selectedPlants
    : state.plants;

  const perPlant = plants.map(p =>
    aggregateHotspots(p.occurrences || [], { gridKm: 1, start, end })
  );

  let merged = mergeHotspots(perPlant);

  if(mode === "season"){
    merged = seasonalizeHotspots(merged);
    showHotspots(merged, { title: `This season (last ${days} days)` });
  } else {
    showHotspots(merged, { title: `All plants (last ${days} days)` });
  }
}

function showAllPoints(){
  plotAllOccurrences();
}

function locate(){
  debug("locate()");
  if(!navigator.geolocation) return;

  navigator.geolocation.getCurrentPosition(
    (pos) => {
      setLocation(pos.coords.latitude, pos.coords.longitude);

      // recompute local counts only if user moved
      recomputeLocalStatsIfMoved(1.0);

      // refresh selection + UI
      recomputeSelection();
      renderDeck({ onSelectPlant });

      // re-render current viz
      renderCurrentViz();
    },
    () => {},
    { enableHighAccuracy:true, timeout: 8000, maximumAge: 60000 }
  );
}

// ----------------------------
// Multi-select viz mode chips
// ----------------------------
function setChipActive(id, on){
  const el = document.getElementById(id);
  if(!el) return;
  el.classList.toggle("active", !!on);
  el.setAttribute("aria-pressed", on ? "true" : "false");
}

function getVizMode(){
  state.filters = state.filters || {};

  const hotspotsOn = state.filters.vizHotspots !== false; // default true
  const pointsOn = state.filters.vizPoints === true;      // default false

  // if both selected, choose one to render (hotspots wins)
  if(hotspotsOn) return "hotspots";
  if(pointsOn) return "points";
  return "hotspots";
}

function syncVizChipsUI(){
  state.filters = state.filters || {};
  const hotspotsOn = state.filters.vizHotspots !== false;
  const pointsOn = state.filters.vizPoints === true;

  setChipActive("btnVizHotspots", hotspotsOn);
  setChipActive("btnVizPoints", pointsOn);
}

function toggleVizChip(which){
  state.filters = state.filters || {};
  if(which === "hotspots"){
    state.filters.vizHotspots = !(state.filters.vizHotspots !== false) ? true : false;
  }
  if(which === "points"){
    state.filters.vizPoints = !(state.filters.vizPoints === true) ? true : false;
  }

  // prevent "none selected": if both off, turn hotspots back on
  const hotspotsOn = state.filters.vizHotspots !== false;
  const pointsOn = state.filters.vizPoints === true;
  if(!hotspotsOn && !pointsOn){
    state.filters.vizHotspots = true;
  }

  syncVizChipsUI();
  renderCurrentViz();
}

function renderCurrentViz(){
  const mode = getVizMode();
  if(mode === "points") showAllPoints();
  else showAllHotspots();
}

function wireVizChips(){
  const a = document.getElementById("btnVizHotspots");
  const b = document.getElementById("btnVizPoints");
  if(a) a.addEventListener("click", () => toggleVizChip("hotspots"));
  if(b) b.addEventListener("click", () => toggleVizChip("points"));
}

// ----------------------------

function wireButtons(){
  debug("wireButtons()");
  wireVizChips();

  const locateBtn = document.getElementById("btnLocate");
  if(locateBtn) locateBtn.addEventListener("click", locate);

  const resortBtn = document.getElementById("btnResort");
  if(resortBtn){
    const syncLabel = () => {
      const m = state.filters?.sortMode || "timeless";
      resortBtn.textContent = (m === "season") ? "This season" : "Timeless";
    };

    syncLabel();

    resortBtn.addEventListener("click", () => {
      state.filters = state.filters || {};
      state.filters.sortMode = (state.filters.sortMode === "season") ? "timeless" : "season";
      syncLabel();
      renderDeck({ onSelectPlant });
    });
  }
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

    // initialize chip state defaults + UI
    state.filters = state.filters || {};
    if(state.filters.vizHotspots === undefined) state.filters.vizHotspots = true;
    if(state.filters.vizPoints === undefined) state.filters.vizPoints = false;
    syncVizChipsUI();

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
        renderCurrentViz();
      });
    }

    // Initial render
    renderDeck({ onSelectPlant });
    renderCurrentViz();

    // Try locating user (optional)
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
