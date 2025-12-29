export function initRiskModal(){
  const riskModal = document.getElementById("riskModal");

  function show(){ riskModal.classList.add("show"); }
  function hide(){ riskModal.classList.remove("show"); }

  document.getElementById("btnAgree").addEventListener("click", () => {
    localStorage.setItem("wilder_risk_ok", "true");
    hide();
  });

  document.getElementById("btnDecline").addEventListener("click", () => {
    alert("Understood. The app will not continue without agreement.");
  });

  if(localStorage.getItem("wilder_risk_ok") !== "true"){
    show();
  }
}
