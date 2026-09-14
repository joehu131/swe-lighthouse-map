import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const INPUT_FILE = path.join(__dirname, '..', 'public', 'data', 'lighthouses_parsed.json');
const OUTPUT_FILE = path.join(__dirname, '..', 'public', 'data', 'manifest.json');

const R_EARTH = 6378137.0;

// Bounding box for Nordic & Baltic Basin (covers Norway, Sweden, Denmark, Finland, Germany)
// Aspect ratio is exactly 1.500 (4096 x 6144 plate)
const LON_MIN = 4.24;
const LON_MAX = 30.76;
const LAT_MIN = 53.50;
const LAT_MAX = 71.30;

function latLonToMercator(lat, lon) {
  const x = R_EARTH * ((lon * Math.PI) / 180.0);
  const y = R_EARTH * Math.log(Math.tan(Math.PI / 4.0 + ((lat * Math.PI) / 360.0)));
  return [x, y];
}

const MAJOR_HERITAGE_LIGHTS = [
  'vinga', 'landsort', 'kullen', 'långe jan', 'långe erik', 'pater noster',
  'smygehuk', 'malören', 'hoburg', 'måseskär', 'almagrundet', 'morups tånge',
  'ölands södra grund', 'sydostbrotten', 'gustav dalén', 'revengegrundet',
  'understen', 'stora karlsö', 'gotska sandön', 'nidingen', 'hålö', 'falsterbo',
  'djursten', 'eggegrund', 'rödkallen', 'holmögadd', 'svartklubben', 'utklippan'
];

function determineTier(b) {
  const name = (b.name || '').toLowerCase();
  const isNamed = name !== 'okänd fyr' && name.length > 2;
  const isHeritage = MAJOR_HERITAGE_LIGHTS.some((m) => name.includes(m));
  const range = b.range_nm || 0;
  const height = b.focal_height_m || 0;
  const numSectors = (b.sectors || []).length;

  if (isHeritage || (isNamed && (range >= 12.0 || height >= 22.0))) {
    return 'major';
  }
  if (b.optic_type === 'sektorfyr' || numSectors >= 2) {
    return 'sector';
  }
  return 'minor';
}

export function generateManifest() {
  console.log('[manifest] Reading parsed lighthouses...');
  const beaconsRaw = JSON.parse(fs.readFileSync(INPUT_FILE, 'utf8'));

  const [xMin, yMin] = latLonToMercator(LAT_MIN, LON_MIN);
  const [xMax, yMax] = latLonToMercator(LAT_MAX, LON_MAX);

  const frameWidthM = xMax - xMin;
  const frameHeightM = yMax - yMin;
  const aspectH = frameHeightM / frameWidthM;

  console.log(`[manifest] Frame bounds: width=${(frameWidthM / 1000).toFixed(1)} km, height=${(frameHeightM / 1000).toFixed(1)} km, aspect=${aspectH.toFixed(3)}`);

  const globalSectors = [];
  const processedBeacons = [];

  for (const b of beaconsRaw) {
    const [x, y] = latLonToMercator(b.lat, b.lon);

    // 64-bit float normalized plate coordinates
    const u = (x - xMin) / frameWidthM;
    const v = 1.0 - (y - yMin) / frameHeightM;

    // Bounds safety
    if (u < 0.0 || u > 1.0 || v < 0.0 || v > 1.0) continue;

    const tier = determineTier(b);

    // Realistic range adjustment based on tier
    let effectiveRangeNm = b.range_nm || 6.0;
    let rotates = 0;

    if (tier === 'major') {
      effectiveRangeNm = Math.max(12.0, b.range_nm || 16.0);
      rotates = 1;
    } else if (tier === 'sector') {
      effectiveRangeNm = b.range_nm || 8.0;
      rotates = 0;
    } else {
      effectiveRangeNm = Math.min(6.0, b.range_nm || 4.0);
      rotates = 0;
    }

    // High-latitude Mercator range scale correction:
    const latRad = (b.lat * Math.PI) / 180.0;
    const mercatorScale = 1.0 / Math.cos(latRad);
    const rangeMeters = effectiveRangeNm * 1852.0;
    const projectedMeters = rangeMeters * mercatorScale;
    const reach = projectedMeters / frameWidthM;

    // Flatten sectors into global buffer
    const secOffset = globalSectors.length;
    const nSec = (b.sectors || []).length;

    for (const sec of b.sectors || []) {
      // Packed as vec4: [start_deg, end_deg, color_code, 0.0]
      globalSectors.push([
        parseFloat(sec.start_deg.toFixed(2)),
        parseFloat(sec.end_deg.toFixed(2)),
        sec.code,
        0.0,
      ]);
    }

    const primaryRgb = b.sectors?.[0]?.rgb || [1.0, 0.95, 0.82];

    processedBeacons.push({
      id: b.id,
      name: b.name,
      ref: b.ref,
      tier,
      u: parseFloat(u.toFixed(6)),
      v: parseFloat(v.toFixed(6)),
      reach: parseFloat(reach.toFixed(6)),
      period: parseFloat(b.period_s.toFixed(2)),
      phase: parseFloat((Math.random()).toFixed(4)),
      rgb: primaryRgb,
      rotates,
      optic_type: rotates === 1 ? 'havsfyr' : b.optic_type,
      height_m: b.focal_height_m,
      range_nm: effectiveRangeNm,
      sec_offset: secOffset,
      nsec: nSec,
      facts: {
        name: b.name,
        character: b.character,
        period_s: b.period_s,
        range_nm: effectiveRangeNm,
        height_m: b.focal_height_m,
        optic_type: rotates === 1 ? 'havsfyr' : b.optic_type,
        tier,
        ref: b.ref,
        lat: parseFloat(b.lat.toFixed(5)),
        lon: parseFloat(b.lon.toFixed(5)),
        sectors: (b.sectors || []).map((s) => ({
          start_deg: s.start_deg,
          end_deg: s.end_deg,
          colour: s.colour,
        })),
      },
    });
  }

  // Sort beacons by latitude descending (North to South)
  processedBeacons.sort((a, b) => b.facts.lat - a.facts.lat);

  const manifest = {
    subject: 'sweden',
    label: 'Sverige & Norden (Sweden & Nordic Basin)',
    source: 'OpenSeaMap / OpenStreetMap contributors (ODbL); US NGA Pub. 116; Svenska Fyrsällskapet',
    canvas: [1024, 1536],
    plate: [4096, 6144],
    aspect_h: parseFloat(aspectH.toFixed(4)),
    frame_width_m: frameWidthM,
    merc_bbox: [xMin, yMin, xMax, yMax],
    lat_center: (LAT_MIN + LAT_MAX) / 2.0,
    elev_max_m: 2500.0,
    palette: {
      sea_night: [0.017, 0.029, 0.054],   // Deep oceanic midnight navy (calibrated 175% dusky)
      land_night: [0.033, 0.044, 0.060],  // Dusky basalt/charcoal land silhouette (calibrated 175%)
      sea_day: [0.91, 0.94, 0.97],
      land_day: [0.85, 0.88, 0.90],
      sky_beam: [1.0, 0.92, 0.75],        // Warm incandescent golden beam
    },
    look: {
      ve: 7.0,             // Vertical exaggeration
      height_boost: 2.5,
      exposure: 1.4,
      beam_gain: 2.2,      // Vivid light beams cutting through nocturnal darkness
      sea_gain: 1.8,
      ao: 0.75,            // Deep relief shadows
      ambient: 0.28,       // Dusky nocturnal ambient starlight (175% level)
    },
    n_beacons: processedBeacons.length,
    beacons: processedBeacons,
    sectors: globalSectors,
  };

  console.log(`[manifest] Successfully packaged ${processedBeacons.length} beacons and ${globalSectors.length} sectors.`);
  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(manifest, null, 2), 'utf8');
  return manifest;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    generateManifest();
    console.log(`[manifest] Done! Saved manifest to ${OUTPUT_FILE}`);
  } catch (err) {
    console.error('[manifest] Error:', err);
    process.exit(1);
  }
}
