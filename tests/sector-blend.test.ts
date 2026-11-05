import { describe, it, expect } from 'vitest';
import {
  blendHalfWidths,
  sectorSpan,
  MAX_BLEND_HALF_WIDTH_DEG,
  BLEND_FRACTION_OF_ARC,
} from '../src/lib/sector-blend.js';

type S = [number, number, number, number];
const RED = 1;
const GREEN = 2;
const WHITE = 0;

describe('sector crossfade widths', () => {
  it('uses the shader span rule, including 0 to 360 as a full circle', () => {
    expect(sectorSpan(350, 10)).toBe(20);
    expect(sectorSpan(0, 360)).toBe(360);
    expect(sectorSpan(90, 90)).toBe(0);
  });

  it('gives both sides of a shared boundary the same width', () => {
    const secs: S[] = [
      [100, 200, RED, 0],
      [200, 203, WHITE, 0], // narrow white fairway
      [203, 300, GREEN, 0],
    ];
    const w = blendHalfWidths(secs);
    expect(w[0].end).toBeCloseTo(w[1].start);
    expect(w[1].end).toBeCloseTo(w[2].start);
  });

  it('keeps a pure core in narrow sectors', () => {
    const secs: S[] = [
      [100, 200, RED, 0],
      [200, 203, WHITE, 0],
      [203, 300, GREEN, 0],
    ];
    const w = blendHalfWidths(secs);
    // Both ramps of the 3 degree white sector must end before its middle (1.5 degrees in)
    expect(w[1].start).toBeLessThan(1.5);
    expect(w[1].end).toBeLessThan(1.5);
    expect(w[1].start).toBeCloseTo(BLEND_FRACTION_OF_ARC * 3);
  });

  it('caps the width between wide sectors', () => {
    const secs: S[] = [
      [0, 120, RED, 0],
      [120, 240, GREEN, 0],
    ];
    const w = blendHalfWidths(secs);
    expect(w[0].end).toBe(MAX_BLEND_HALF_WIDTH_DEG);
    expect(w[1].start).toBe(MAX_BLEND_HALF_WIDTH_DEG);
  });

  it('handles boundaries that cross north (0 / 360 degrees)', () => {
    const secs: S[] = [
      [350, 5, RED, 0],
      [5, 8, WHITE, 0],
    ];
    const w = blendHalfWidths(secs);
    expect(w[0].end).toBeCloseTo(w[1].start);
    expect(w[1].start).toBeCloseTo(BLEND_FRACTION_OF_ARC * 3);
  });

  it('limits an edge that faces an unlit arc by the size of that arc', () => {
    const secs: S[] = [
      [10, 100, RED, 0],
      [101, 200, GREEN, 0], // 1 degree dark gap between the two
    ];
    const w = blendHalfWidths(secs);
    expect(w[0].end).toBeCloseTo(BLEND_FRACTION_OF_ARC * 1);
    expect(w[1].start).toBeCloseTo(BLEND_FRACTION_OF_ARC * 1);
  });

  it('gives full circles and empty sectors no edges', () => {
    const secs: S[] = [
      [0, 360, WHITE, 0],
      [90, 90, RED, 0],
    ];
    expect(blendHalfWidths(secs)).toEqual([
      { start: 0, end: 0 },
      { start: 0, end: 0 },
    ]);
  });
});
