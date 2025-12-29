export function monthIndex(){ return new Date().getMonth(); }

export function monthLabel(){
  return new Date().toLocaleString(undefined, { month:"long", year:"numeric" });
}

export function escapeHtml(s){
  return String(s ?? "")
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;")
    .replaceAll('"',"&quot;")
    .replaceAll("'","&#039;");
}

function toRad(deg){ return deg * Math.PI / 180; }

export function haversineKm(aLat, aLon, bLat, bLon){
  const R = 6371;
  const dLat = toRad(bLat - aLat);
  const dLon = toRad(bLon - aLon);
  const lat1 = toRad(aLat);
  const lat2 = toRad(bLat);
  const s1 = Math.sin(dLat/2);
  const s2 = Math.sin(dLon/2);
  const x = s1*s1 + Math.cos(lat1)*Math.cos(lat2)*s2*s2;
  const c = 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1-x));
  return R * c;
}

export function plantIconSVG(seed){
  const hue = (seed.split("").reduce((a,c)=>a+c.charCodeAt(0),0) * 7) % 360;
  return `
    <svg class="plantIcon" viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Plant">
      <defs>
        <linearGradient id="g" x1="0" x2="1">
          <stop offset="0" stop-color="hsla(${hue},70%,55%,.95)"/>
          <stop offset="1" stop-color="hsla(${(hue+35)%360},70%,45%,.95)"/>
        </linearGradient>
      </defs>
      <path d="M100 175 C92 150, 95 125, 100 105 C105 125,108 150,100 175 Z" fill="rgba(255,255,255,.08)"/>
      <path d="M100 105 C70 92, 50 70, 52 52 C70 52, 88 66, 100 88 C112 66,130 52,148 52 C150 70,130 92,100 105 Z"
            fill="url(#g)" stroke="rgba(255,255,255,.12)" stroke-width="2"/>
      <path d="M100 88 C90 78, 78 70, 66 64" fill="none" stroke="rgba(0,0,0,.25)" stroke-width="3" stroke-linecap="round"/>
      <path d="M100 88 C110 78, 122 70, 134 64" fill="none" stroke="rgba(0,0,0,.22)" stroke-width="3" stroke-linecap="round"/>
      <circle cx="100" cy="105" r="4" fill="rgba(0,0,0,.25)"/>
    </svg>
  `;
}

export function seasonBadge(season){
  if(season === "High") return { label:"Common", cls:"common" };
  if(season === "Medium") return { label:"Occasional", cls:"medium" };
  return { label:"Rare", cls:"rare" };
}
