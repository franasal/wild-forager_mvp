import { state } from "./state.js";
import { escapeHtml, plantIconSVG, monthIndex } from "./utils.js";

export function initSpecimen(){
  const overlay = document.getElementById("overlay");
  const btnClose = document.getElementById("btnClose");

  btnClose.addEventListener("click", closeSpecimen);
  overlay.addEventListener("click", (e) => {
    if(e.target === overlay) closeSpecimen();
  });

  // kitchen flip
  const flipStage = document.getElementById("flipStage");
  const flip = document.getElementById("flip");
  const btnFlip = document.getElementById("btnFlip");
  const btnFlipBack = document.getElementById("btnFlipBack");
  const btnHideKitchen = document.getElementById("btnHideKitchen");
  const btnHideKitchen2 = document.getElementById("btnHideKitchen2");

  btnFlip.addEventListener("click", () => flip.classList.add("flipped"));
  btnFlipBack.addEventListener("click", () => flip.classList.remove("flipped"));
  btnHideKitchen.addEventListener("click", () => { flipStage.classList.remove("show"); flip.classList.remove("flipped"); });
  btnHideKitchen2.addEventListener("click", () => { flipStage.classList.remove("show"); flip.classList.remove("flipped"); });

  document.getElementById("btnCulinary").addEventListener("click", () => {
    if(!state.selected) return;

    const r = state.selected.recipe || { prep:"", simple:"", pairing:"" };
    document.getElementById("recipeBody").innerHTML = `
      <div class="note"><b>Preparation:</b> ${escapeHtml(r.prep || "—")}</div>
      <div class="noteLine"></div>
      <div class="note"><b>Simple recipe:</b> ${escapeHtml(r.simple || "—")}</div>
      <div class="noteLine"></div>
      <div class="note"><b>Pairing:</b> ${escapeHtml(r.pairing || "—")}</div>
    `;

    flipStage.classList.add("show");
    flip.classList.remove("flipped");
    setTimeout(() => flipStage.scrollIntoView({ behavior:"smooth", block:"start" }), 50);
  });
}

export function openSpecimen(p){
  state.selected = p;

  document.getElementById("specSci").textContent = p.scientificName || "";
  document.getElementById("specCommon").textContent = p.commonName || "";
  document.getElementById("specVisual").innerHTML = plantIconSVG(p.id || p.scientificName || "plant");

  const specGrid = document.getElementById("specGrid");
  specGrid.innerHTML = "";

  const stats = p.nutritionTopTrumps || {};
  const fallbackStats = {
    "Observations": String(p.frequency ?? (p.occurrences || []).length),
    "Season": (p.seasonality && p.seasonality[monthIndex()]) ? p.seasonality[monthIndex()] : "Low"
  };
  const merged = Object.keys(stats).length ? stats : fallbackStats;

  for(const [k,v] of Object.entries(merged)){
    const kv = document.createElement("div");
    kv.className = "kv";
    kv.innerHTML = `<label>${escapeHtml(k)}</label><b>${escapeHtml(v)}</b>`;
    specGrid.appendChild(kv);
  }

  document.getElementById("specId").textContent = p.idMarkers || "No identification markers provided.";

  const warn = (p.lookalikeWarning || "").trim();
  const lookBlock = document.getElementById("specLookBlock");
  if(warn){
    lookBlock.style.display = "block";
    document.getElementById("specLook").textContent = warn;
  } else {
    lookBlock.style.display = "none";
  }

  // reset kitchen view
  document.getElementById("flipStage").classList.remove("show");
  document.getElementById("flip").classList.remove("flipped");

  document.getElementById("overlay").classList.add("show");
}

export function closeSpecimen(){
  document.getElementById("overlay").classList.remove("show");
  document.getElementById("flipStage").classList.remove("show");
  document.getElementById("flip").classList.remove("flipped");
}
