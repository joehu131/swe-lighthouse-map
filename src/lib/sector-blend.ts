// Soft sector edges for multi-colour sector lights.
//
// Real sector lights do not switch colour on an exact bearing. Light lists describe an
// "arc of uncertainty" of one to a few degrees where the observer sees a mix of both colours.
// The shader reproduces that with a crossfade centred on each sector boundary. This module
// decides how wide each crossfade is, so that:
//   1. two sectors that share a boundary use the same width there (their weights then sum
//      to 1 and the crossfade has no dark or bright seam), and
//   2. a narrow sector (for example a 3° white fairway between red and green) keeps a pure
//      core instead of being washed out by its neighbours.

import type { Manifest } from './types.js';

/** Widest crossfade half-width in degrees (the full transition is twice this). */
export const MAX_BLEND_HALF_WIDTH_DEG = 4.0;

/**
 * A crossfade may use at most this fraction of the narrower of the two arcs it joins.
 * Keep it below 0.5: at 0.5 the two edge ramps of a narrow sector meet in its middle and
 * the sector loses its pure-colour core.
 */
export const BLEND_FRACTION_OF_ARC = 0.4;

/** Boundaries closer than this (degrees) count as shared. */
const SHARED_EDGE_EPS_DEG = 0.05;

/** Floats per sector in the GPU storage buffer (matches `SectorData` in beam_sector_sdf.wgsl). */
export const SECTOR_STRIDE_FLOATS = 8;

type RawSector = [number, number, number, number]; // start_deg, end_deg, color_code, pad

/** Clockwise arc length from start to end, using the same rule as the shader. */
export function sectorSpan(startDeg: number, endDeg: number): number {
  const span = (endDeg - startDeg + 360) % 360;
  return span === 0 && startDeg !== endDeg ? 360 : span;
}

function isFullCircle(span: number): boolean {
  return span >= 359.99;
}

/**
 * Crossfade half-widths for the start and end edge of every sector of one light.
 * Each edge borders either another sector (shared boundary) or an unlit arc.
 */
export function blendHalfWidths(sectors: RawSector[]): { start: number; end: number }[] {
  const spans = sectors.map((s) => sectorSpan(s[0], s[1]));

  function widthFor(ownSpan: number, neighbourArc: number): number {
    return Math.min(MAX_BLEND_HALF_WIDTH_DEG, BLEND_FRACTION_OF_ARC * Math.min(ownSpan, neighbourArc));
  }

  return sectors.map((sec, i) => {
    const span = spans[i];
    if (isFullCircle(span) || span < 0.01) return { start: 0, end: 0 };

    // Smallest clockwise gap from another sector's end to this start, and from this end to another start.
    // The sector itself is included, so a lone sector sees the unlit arc of (360 - span) on both sides.
    let gapBefore = 360 - span;
    let arcBefore = gapBefore;
    let gapAfter = 360 - span;
    let arcAfter = gapAfter;

    sectors.forEach((other, j) => {
      if (j === i || isFullCircle(spans[j]) || spans[j] < 0.01) return;
      const before = (sec[0] - other[1] + 360) % 360;
      const after = (other[0] - sec[1] + 360) % 360;
      if (before < gapBefore) {
        gapBefore = before;
        arcBefore = before < SHARED_EDGE_EPS_DEG || before > 360 - SHARED_EDGE_EPS_DEG ? spans[j] : before;
      }
      if (after < gapAfter) {
        gapAfter = after;
        arcAfter = after < SHARED_EDGE_EPS_DEG || after > 360 - SHARED_EDGE_EPS_DEG ? spans[j] : after;
      }
    });

    return { start: widthFor(span, arcBefore), end: widthFor(span, arcAfter) };
  });
}

/** Packs every sector into the storage-buffer layout read by beam_sector_sdf.wgsl. */
export function buildSectorBuffer(manifest: Manifest): Float32Array<ArrayBuffer> {
  const data = new Float32Array(Math.max(1, manifest.sectors.length) * SECTOR_STRIDE_FLOATS);

  for (const beacon of manifest.beacons) {
    if (beacon.nsec === 0) continue;
    const own = manifest.sectors.slice(beacon.sec_offset, beacon.sec_offset + beacon.nsec);
    const widths = blendHalfWidths(own);

    own.forEach((s, k) => {
      const o = (beacon.sec_offset + k) * SECTOR_STRIDE_FLOATS;
      data[o + 0] = s[0]; // start_deg
      data[o + 1] = s[1]; // end_deg
      data[o + 2] = s[2]; // color_code
      data[o + 3] = 0; // pad
      data[o + 4] = widths[k].start; // blend_start_deg
      data[o + 5] = widths[k].end; // blend_end_deg
    });
  }

  return data;
}
