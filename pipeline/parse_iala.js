/**
 * IALA Light Character and Sector Parser for Swedish Navigational Lights.
 * Adheres strictly to IALA (International Association of Marine Aids to Navigation
 * and Lighthouse Authorities) and SMA (Swedish Maritime Administration) standards.
 */

// Canonical RGB color values for maritime light sectors
export const MARITIME_COLORS = {
  white: [1.0, 0.95, 0.82],   // Warm maritime incandescent white
  red: [0.94, 0.22, 0.22],     // IALA standard maritime red
  green: [0.08, 0.74, 0.45],   // IALA standard maritime emerald green
  yellow: [0.96, 0.65, 0.12],  // Maritime navigation amber / yellow
  amber: [0.96, 0.65, 0.12],
  orange: [0.96, 0.50, 0.10],
  unknown: [1.0, 0.95, 0.82]
};

export const COLOR_CODES = {
  white: 0,
  red: 1,
  green: 2,
  yellow: 3,
  amber: 3,
  orange: 3,
  unknown: 0
};

/**
 * Inverts a bearing from seaward (ship looking at light) to beam direction (light projecting onto water).
 * In maritime hydrography, sector limits are charted looking FROM seaward TOWARD the light.
 * Formula: (bearing_seaward + 180) % 360
 */
export function invertBearing(bearingDeg) {
  const norm = ((bearingDeg % 360) + 360) % 360;
  return (norm + 180) % 360;
}

/**
 * Normalizes an angle into [0, 360)
 */
export function normalizeAngle(deg) {
  return ((deg % 360) + 360) % 360;
}

/**
 * Checks if a test angle lies within a sector [startDeg, endDeg],
 * accounting for clockwise sector traversal and the 0°/360° north meridian crossing.
 */
export function isAngleInSector(angle, startDeg, endDeg) {
  const a = normalizeAngle(angle);
  const start = normalizeAngle(startDeg);
  const end = normalizeAngle(endDeg);

  const span = ((end - start) + 360) % 360;
  const delta = ((a - start) + 360) % 360;

  if (span === 0 && startDeg !== endDeg) {
    return true; // 360 degree full coverage
  }

  return delta >= 0 && delta <= span;
}

/**
 * Normalizes a color string into canonical name
 */
export function normalizeColor(colStr) {
  if (!colStr) return 'white';
  const c = colStr.trim().toLowerCase();
  if (c.includes('whi') || c === 'w') return 'white';
  if (c.includes('red') || c === 'r') return 'red';
  if (c.includes('gre') || c === 'g') return 'green';
  if (c.includes('yel') || c === 'y') return 'yellow';
  if (c.includes('amb') || c === 'a') return 'amber';
  return 'white';
}

/**
 * Parses raw OSM tags of a seamark node into a structured beacon object.
 */
export function parseSeamarkTags(tags, id = 'unknown') {
  const name = tags['name'] || tags['seamark:name'] || tags['name:sv'] || 'Okänd fyr';
  const ref = tags['seamark:light:reference'] || tags['ref:admiralty'] || tags['ref'] || null;

  // Extract focal height and range (checking light:1 namespace first)
  const focalHeight = parseFloat(
    tags['seamark:light:1:height'] ||
    tags['seamark:light:height'] ||
    tags['height'] ||
    '12.0'
  ) || 12.0;

  const nominalRange = parseFloat(
    tags['seamark:light:1:range'] ||
    tags['seamark:light:range'] ||
    '10.0'
  ) || 10.0;

  // Extract base character and period
  const charType = (tags['seamark:light:character'] || tags['seamark:light:1:character'] || 'Fl').trim();
  const group = tags['seamark:light:group'] || tags['seamark:light:1:group'] || null;
  const period = parseFloat(tags['seamark:light:period'] || tags['seamark:light:1:period'] || '6.0') || 6.0;

  // Parse sector definitions
  const sectors = [];
  
  // Strategy 1: Check numbered sectors (seamark:light:1, seamark:light:2, ...)
  let sectorIdx = 1;
  while (tags[`seamark:light:${sectorIdx}:sector_start`] !== undefined) {
    const startSeaward = parseFloat(tags[`seamark:light:${sectorIdx}:sector_start`]);
    const endSeaward = parseFloat(tags[`seamark:light:${sectorIdx}:sector_end`]);
    const colName = normalizeColor(tags[`seamark:light:${sectorIdx}:colour`]);

    if (!isNaN(startSeaward) && !isNaN(endSeaward)) {
      // If 0 to 360 (or identical start and end), it is a full 360 degree circle
      const isFullCircle = (startSeaward === 0 && endSeaward === 360) || (startSeaward === endSeaward);
      const startBeam = isFullCircle ? 0.0 : invertBearing(startSeaward);
      const endBeam = isFullCircle ? 360.0 : invertBearing(endSeaward);

      sectors.push({
        start_deg: startBeam,
        end_deg: endBeam,
        colour: colName,
        code: COLOR_CODES[colName] || 0,
        rgb: MARITIME_COLORS[colName] || MARITIME_COLORS.white,
      });
    }
    sectorIdx++;
  }

  // Strategy 2: If no numbered sectors, check semicolon-delimited tags
  if (sectors.length === 0 && tags['seamark:light:sector_start']) {
    const starts = tags['seamark:light:sector_start'].split(';');
    const ends = (tags['seamark:light:sector_end'] || '').split(';');
    const colors = (tags['seamark:light:colour'] || '').split(';');

    for (let i = 0; i < starts.length; i++) {
      const startSeaward = parseFloat(starts[i]);
      const endSeaward = parseFloat(ends[i] || starts[i]);
      const colName = normalizeColor(colors[i] || colors[0] || 'white');

      if (!isNaN(startSeaward) && !isNaN(endSeaward)) {
        sectors.push({
          start_deg: invertBearing(startSeaward),
          end_deg: invertBearing(endSeaward),
          colour: colName,
          code: COLOR_CODES[colName] || 0,
          rgb: MARITIME_COLORS[colName] || MARITIME_COLORS.white,
        });
      }
    }
  }

  // Strategy 3: Single omnidirectional light or unspecified sectors
  if (sectors.length === 0) {
    const colName = normalizeColor(tags['seamark:light:colour'] || 'white');
    sectors.push({
      start_deg: 0.0,
      end_deg: 360.0,
      colour: colName,
      code: COLOR_CODES[colName] || 0,
      rgb: MARITIME_COLORS[colName] || MARITIME_COLORS.white,
    });
  }

  // Determine optic category and rotation behaviour
  // Sektorfyr: Multiple sectors with navigational colors (WRG)
  // Ensfyr: Leading light with very narrow angle (< 6 deg) or tagged as leading
  // Havsfyr: Major coastal light sweeping 360 degrees
  const singleSectorSpan = sectors.length === 1 && sectors[0].start_deg === 0 && sectors[0].end_deg === 360
    ? 360
    : sectors.length === 1
      ? ((sectors[0].end_deg - sectors[0].start_deg + 360) % 360) || 360
      : 0;

  const isLeading = tags['seamark:type'] === 'leading_light' ||
                    name.toLowerCase().includes('ensfyr') ||
                    (sectors.length === 1 && singleSectorSpan <= 6.0);

  const isSectored = sectors.length > 1;

  let opticType = 'havsfyr';
  let rotates = 1; // 1 = rotating sweep, 0 = static pulsing sector fan

  if (isLeading) {
    opticType = 'ensfyr';
    rotates = 0;
  } else if (isSectored) {
    opticType = 'sektorfyr';
    rotates = 0;
  } else {
    opticType = 'havsfyr';
    rotates = 1;
  }

  // Compose standardized compound character string (e.g. "Fl(2) WRG 6s")
  const groupStr = group && group !== '1' ? `(${group})` : '';
  const colorLetters = Array.from(new Set(sectors.map(s => s.colour[0].toUpperCase())))
    .sort((a, b) => {
      const order = { W: 0, R: 1, G: 2, Y: 3 };
      return (order[a] ?? 9) - (order[b] ?? 9);
    })
    .join('');

  const characterStr = `${charType}${groupStr} ${colorLetters || 'W'} ${period}s`;

  return {
    id: String(id),
    name,
    ref,
    character: characterStr,
    period_s: period,
    focal_height_m: focalHeight,
    range_nm: nominalRange,
    optic_type: opticType,
    rotates: rotates === 1,
    sectors,
  };
}
