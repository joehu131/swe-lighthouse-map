import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseSeamarkTags } from './parse_iala.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const CACHE_FILE = path.join(__dirname, 'cache', 'raw_osm.json');
const OUTPUT_FILE = path.join(__dirname, '..', 'public', 'data', 'lighthouses_parsed.json');

// Swedish bounding box
const BBOX = {
  minLat: 55.0,
  maxLat: 69.5,
  minLon: 10.5,
  maxLon: 24.5,
};

const OVERPASS_ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
];

async function fetchFromOverpass() {
  if (fs.existsSync(CACHE_FILE)) {
    console.log(`[extract] Loading cached OSM data from ${CACHE_FILE}...`);
    return JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8'));
  }

  console.log('[extract] Fetching Swedish maritime lights from Overpass API...');

  // Target Sweden boundary with timeout, including nodes, ways, and relations
  const query = `[out:json][timeout:90];
area["ISO3166-1"="SE"]["admin_level"="2"]->.a;
(
  nwr["man_made"="lighthouse"](area.a);
  nwr["seamark:type"="light_major"](area.a);
  nwr["seamark:type"="light_minor"](area.a);
  nwr["seamark:type"="light"](area.a);
  nwr["seamark:type"="leading_light"](area.a);
);
out center body;
`;

  let lastError = null;
  for (const endpoint of OVERPASS_ENDPOINTS) {
    try {
      console.log(`[extract] Trying endpoint: ${endpoint}...`);
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
          'User-Agent': 'swe-lighthouse-map/1.0 (maritime showcase pipeline)',
        },
        body: 'data=' + encodeURIComponent(query),
        signal: AbortSignal.timeout(45000),
      });

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      }

      const data = await res.json();
      console.log(`[extract] Received ${data.elements?.length || 0} elements from Overpass.`);
      fs.writeFileSync(CACHE_FILE, JSON.stringify(data, null, 2), 'utf8');
      return data;
    } catch (err) {
      console.warn(`[extract] Endpoint ${endpoint} failed: ${err.message}`);
      lastError = err;
    }
  }

  throw new Error(`All Overpass endpoints failed. Last error: ${lastError?.message}`);
}

/**
 * Calculates Euclidean distance in meters between two lat/lon points
 */
function haversineDistanceMeters(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export async function extractAndNormalizeLighthouses() {
  const data = await fetchFromOverpass();
  const rawElements = data.elements || [];

  console.log(`[extract] Processing ${rawElements.length} raw elements...`);

  const parsedBeacons = [];
  const seenRefs = new Set();

  for (const el of rawElements) {
    const lat = el.lat ?? el.center?.lat;
    const lon = el.lon ?? el.center?.lon;
    if (lat === undefined || lon === undefined) continue;

    // Filter by Sweden bounding box
    if (
      lat < BBOX.minLat ||
      lat > BBOX.maxLat ||
      lon < BBOX.minLon ||
      lon > BBOX.maxLon
    ) {
      continue;
    }

    const tags = el.tags || {};
    const parsed = parseSeamarkTags(tags, el.id);

    // Two-tier deduplication
    // 1. Ref code matching
    if (parsed.ref && seenRefs.has(parsed.ref)) {
      continue;
    }
    if (parsed.ref) {
      seenRefs.add(parsed.ref);
    }

    // 2. Spatial deduplication (within 25m) unless they are distinct leading lights (nedre vs övre)
    const isDupe = parsedBeacons.some((existing) => {
      const dist = haversineDistanceMeters(lat, lon, existing.lat, existing.lon);
      if (dist < 25) {
        const name1 = (parsed.name || '').toLowerCase();
        const name2 = (existing.name || '').toLowerCase();
        // Don't merge if one is nedre and other is övre
        if (
          (name1.includes('nedre') && name2.includes('övre')) ||
          (name1.includes('övre') && name2.includes('nedre'))
        ) {
          return false;
        }
        return true;
      }
      return false;
    });

    if (isDupe) continue;

    parsedBeacons.push({
      ...parsed,
      lat,
      lon,
    });
  }

  console.log(`[extract] Successfully extracted ${parsedBeacons.length} unique Swedish lighthouses.`);
  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(parsedBeacons, null, 2), 'utf8');
  return parsedBeacons;
}

// Direct execution
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  extractAndNormalizeLighthouses()
    .then((beacons) => {
      console.log(`[extract] Done! Wrote ${beacons.length} beacons to ${OUTPUT_FILE}`);
    })
    .catch((err) => {
      console.error('[extract] Error:', err);
      process.exit(1);
    });
}
