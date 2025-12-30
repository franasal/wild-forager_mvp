import { state } from "./state.js";
import { initMap, setLocation, plotAllOccurrences, showPlantOnMap } from "./map.js";
import { renderDeck } from "./deck.js";
import { initSpecimen, openSpecimen } from "./specimen.js";
import { initRiskModal } from "./risk.js";

async function loadPlants(){
  document.getElementById("hudMode").textContent = "Loading data…";

  const res = await fetch("data/plants.json", { cache: "no-store" });
  if(!res.ok) throw new Error("Failed to load data/plants.json");

  const data = await res.json();

  // Support both shapes:
  // A) { region, plants: [...] } (old)
  // B) { plants: [...] } (new file you generated)
  state.region = data.region || {
    name: "Leipzig (demo)",
    center: { lat: 51.3397, lon: 12.3731 }
  };

  const rawPlants = data.plants || [];
  state.plants = rawPlants.map(p => {
    // Convert "demo.occurrences" => "occurrences" in the structure the app expects
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
}

function locate(){
  if(!navigator.geolocation) return;
  navigator.geolocation.getCurrentPosition(
    (pos) => {
      setLocation(pos.coords.latitude, pos.coords.longitude);
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

function wireButtons(){
  document.getElementById("btnLocate").addEventListener("click", locate);
  document.getElementById("btnAll").addEventListener("click", plotAllOccurrences);
  document.getElementById("btnResort").addEventListener("click", () => renderDeck({ onSelectPlant }));
}

async function main(){
  initMap();
  initSpecimen();
  initRiskModal();
  wireButtons();

  try{
    await loadPlants();

    if(state.region?.center && typeof state.region.center.lat === "number" && typeof state.region.center.lon === "number"){
      setLocation(state.region.center.lat, state.region.center.lon);
    }

    plotAllOccurrences();
    renderDeck({ onSelectPlant });
    locate();
  } catch(e){
    console.error(e);
    document.getElementById("hudMode").textContent = "Missing/invalid data file: data/plants.json";
    document.getElementById("regionPill").textContent = "Region: Error";
  }
}

main();
