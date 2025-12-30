// js/hotspots.js
// Grid aggregation of occurrences -> hotspot cells for fast rendering + offline storage.

function parseDateSafe(s){
  if(!s) return null;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

function monthIdxFromDate(d){
  return d ? d.getMonth() : null;
}

/**
 * Aggregate occurrences into grid cells.
 *
 * @param {Array<{decimalLatitude:number, decimalLongitude:number, eventDate?:string, occurrenceCount?:number}>} occurrences
 * @param {Object} opts
 * @param {number} opts.gridKm   Grid size in kilometers (default 1)
 * @param {Date|null} opts.start Inclusive date filter (optional)
 * @param {Date|null} opts.end   Inclusive date filter (optional)
 * @returns {{gridKm:number, cells:Array<{lat:number, lon:number, count:number, monthCounts:number[]}>}}
 */
export function aggregateHotspots(occurrences, opts = {}){
  const gridKm = typeof opts.gridKm === "number" ? opts.gridKm : 1;
  const start = opts.start || null;
  const end = opts.end || null;

  const cells = new Map();

  // 1 deg latitude ~ 111km
  const latStep = gridKm / 111;

  for(const o of (occurrences || [])){
    const lat = o.decimalLatitude;
    const lon = o.decimalLongitude;
    if(typeof lat !== "number" || typeof lon !== "number") continue;

    const d = parseDateSafe(o.eventDate);
    if(start && d && d < start) continue;
    if(end && d && d > end) continue;

    // adjust lon step by latitude for roughly square km cells
    const lonStep = gridKm / (111 * Math.cos((lat * Math.PI) / 180));

    // snap to grid cell center
    const latCell = Math.round(lat / latStep) * latStep;
    const lonCell = Math.round(lon / lonStep) * lonStep;

    const key = `${latCell.toFixed(6)},${lonCell.toFixed(6)}`;

    const w = Number.isFinite(o.occurrenceCount) ? Number(o.occurrenceCount) : 1;
    const m = monthIdxFromDate(d);

    let cell = cells.get(key);
    if(!cell){
      cell = { lat: latCell, lon: lonCell, count: 0, monthCounts: Array(12).fill(0) };
      cells.set(key, cell);
    }

    cell.count += w;
    if(m != null) cell.monthCounts[m] += w;
  }

  const out = Array.from(cells.values());
  // draw big hotspots on top
  out.sort((a,b) => b.count - a.count);

  return { gridKm, cells: out };
}

/**
 * Merge multiple hotspot sets (e.g., all plants) into one.
 * Keeps monthCounts and totals.
 */
export function mergeHotspots(hotspotSets){
  const merged = new Map();

  for(const hs of (hotspotSets || [])){
    for(const c of (hs?.cells || [])){
      const key = `${c.lat.toFixed(6)},${c.lon.toFixed(6)}`;
      let m = merged.get(key);
      if(!m){
        m = { lat: c.lat, lon: c.lon, count: 0, monthCounts: Array(12).fill(0) };
        merged.set(key, m);
      }
      m.count += c.count || 0;
      for(let i=0;i<12;i++){
        m.monthCounts[i] += (c.monthCounts?.[i] || 0);
      }
    }
  }

  const out = Array.from(merged.values());
  out.sort((a,b) => b.count - a.count);
  return { gridKm: null, cells: out };
}
