// js/gbif.js
// GBIF helpers: resolve taxonKeys + fetch nearby occurrences per taxonKey.

function clamp(n, min, max){ return Math.max(min, Math.min(max, n)); }

// Rough bounding box around a point.
// Note: longitude degrees shrink with latitude; good enough for MVP.
export function getBoundingBox(lat, lon, radiusKm = 10){
  const latDeg = radiusKm / 111;
  const lonDeg = radiusKm / (111 * Math.cos((lat * Math.PI) / 180));

  return {
    minLat: clamp(lat - latDeg, -90, 90),
    maxLat: clamp(lat + latDeg, -90, 90),
    minLon: clamp(lon - lonDeg, -180, 180),
    maxLon: clamp(lon + lonDeg, -180, 180),
  };
}

// Resolve a scientific name to a GBIF taxonKey using GBIF species/match.
export async function resolveTaxonKey(scientificName){
  if(!scientificName) return null;

  const url =
    "https://api.gbif.org/v1/species/match?" +
    new URLSearchParams({
      name: scientificName,
      strict: "true"
    }).toString();

  const res = await fetch(url);
  if(!res.ok) return null;

  const data = await res.json();

  // GBIF returns matchType; accept ONLY good matches for safety.
  // matchType can be: EXACT, FUZZY, HIGHERRANK, NONE, etc.
  const ok = data && (data.matchType === "EXACT" || data.matchType === "FUZZY");
  if(!ok) return null;

  return Number.isFinite(data.usageKey) ? data.usageKey : null;
}

// Build the occurrence search URL for multiple taxonKeys + bbox.
function buildOccurrenceUrl({ taxonKeys, bounds, limit = 300, offset = 0 }){
  const params = new URLSearchParams();

  for(const k of taxonKeys){
    params.append("taxonKey", String(k));
  }

  // Ranges
  params.set("decimalLatitude", `${bounds.minLat},${bounds.maxLat}`);
  params.set("decimalLongitude", `${bounds.minLon},${bounds.maxLon}`);

  // Filters
  params.set("hasCoordinate", "true");
  params.set("hasGeospatialIssue", "false");
  params.set("occurrenceStatus", "PRESENT");

  // Paging
  params.set("limit", String(limit));
  params.set("offset", String(offset));

  return "https://api.gbif.org/v1/occurrence/search?" + params.toString();
}

/**
 * Fetch occurrences around a point for a set of plants.
 * Returns a map: taxonKey -> occurrences[]
 *
 * Occurrence schema matches your app:
 * { decimalLatitude, decimalLongitude, eventDate, occurrenceCount, verbatimLocality, recordedBy, identifiedBy, gbifID, basisOfRecord, license, datasetKey }
 */
export async function fetchOccurrencesByTaxa(lat, lon, plants, opts = {}){
  const radiusKm = typeof opts.radiusKm === "number" ? opts.radiusKm : 10;
  const limit = typeof opts.limit === "number" ? opts.limit : 300;

  const bounds = getBoundingBox(lat, lon, radiusKm);

  const taxonKeys = plants
    .map(p => p.taxonKey)
    .filter(k => Number.isFinite(k));

  if(!taxonKeys.length){
    return { bounds, byTaxonKey: new Map(), total: 0 };
  }

  const url = buildOccurrenceUrl({ taxonKeys, bounds, limit, offset: 0 });

  const res = await fetch(url);
  if(!res.ok) throw new Error("GBIF occurrence search failed");

  const data = await res.json();
  const results = Array.isArray(data.results) ? data.results : [];

  const byTaxonKey = new Map();
  for(const k of taxonKeys) byTaxonKey.set(k, []);

  for(const r of results){
    const k = r.taxonKey;
    if(!Number.isFinite(k)) continue;
    if(!byTaxonKey.has(k)) byTaxonKey.set(k, []);

    byTaxonKey.get(k).push({
      gbifID: r.gbifID,
      taxonKey: r.taxonKey,
      scientificName: r.scientificName,
      decimalLatitude: r.decimalLatitude,
      decimalLongitude: r.decimalLongitude,
      country: r.country,
      countryCode: r.countryCode,
      stateProvince: r.stateProvince,
      verbatimLocality: r.verbatimLocality,
      coordinateUncertaintyInMeters: r.coordinateUncertaintyInMeters,
      eventDate: r.eventDate || null,
      year: r.year,
      month: r.month,
      day: r.day,
      datasetName: r.datasetName,
      datasetKey: r.datasetKey,
      basisOfRecord: r.basisOfRecord,
      occurrenceStatus: r.occurrenceStatus,
      recordedBy: r.recordedBy,
      identifiedBy: r.identifiedBy,
      license: r.license,
      // GBIF doesn't provide "occurrenceCount" consistently; keep as 1 for density counts
      occurrenceCount: 1
    });
  }

  return { bounds, byTaxonKey, total: results.length, gbifCount: data.count };
}
