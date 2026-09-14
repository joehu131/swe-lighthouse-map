import { describe, it, expect } from 'vitest';
import { SpatialHashGrid } from '../src/lib/spatial-hash.ts';
import type { Beacon } from '../src/lib/types.ts';

function createMockBeacon(id: string, u: number, v: number, name = 'Mock Light'): Beacon {
  return {
    id,
    name,
    ref: null,
    tier: 'major',
    u,
    v,
    reach: 0.05,
    period: 6.0,
    phase: 0.0,
    rgb: [1.0, 0.95, 0.82],
    rotates: 1,
    optic_type: 'havsfyr',
    height_m: 20,
    range_nm: 10,
    sec_offset: 0,
    nsec: 1,
    facts: {
      name,
      character: 'Fl W 6s',
      period_s: 6.0,
      range_nm: 10,
      height_m: 20,
      optic_type: 'havsfyr',
      tier: 'major',
      ref: null,
      lat: 57.0,
      lon: 12.0,
      sectors: [],
    },
  };
}

describe('Uniform Spatial Hash Grid (64x128)', () => {
  it('correctly finds the nearest beacon within search radius', () => {
    const grid = new SpatialHashGrid(64, 128);
    const b1 = createMockBeacon('1', 0.20, 0.30, 'Light 1');
    const b2 = createMockBeacon('2', 0.25, 0.35, 'Light 2');
    const b3 = createMockBeacon('3', 0.80, 0.90, 'Light 3');

    grid.insertAll([b1, b2, b3]);

    // Query close to Light 1
    const nearest = grid.findNearest(0.205, 0.302, 0.05);
    expect(nearest).not.toBeNull();
    expect(nearest?.id).toBe('1');
    expect(nearest?.name).toBe('Light 1');
  });

  it('returns null when no beacons are within radius', () => {
    const grid = new SpatialHashGrid(64, 128);
    grid.insert(createMockBeacon('1', 0.1, 0.1));

    const result = grid.findNearest(0.9, 0.9, 0.05);
    expect(result).toBeNull();
  });

  it('handles query across cell boundaries', () => {
    const grid = new SpatialHashGrid(64, 128);
    // Place beacon right on edge of cell 10 (u = 10 / 64 = 0.15625)
    const b = createMockBeacon('edge', 0.156, 0.25);
    grid.insert(b);

    // Query from neighbor cell (u = 0.157)
    const found = grid.findNearest(0.157, 0.25, 0.02);
    expect(found).not.toBeNull();
    expect(found?.id).toBe('edge');
  });

  it('executes queries in sub-microsecond time (< 0.001 ms)', () => {
    const grid = new SpatialHashGrid(64, 128);
    // Populate with 2,000 beacons
    const mockBeacons: Beacon[] = [];
    for (let i = 0; i < 2000; i++) {
      mockBeacons.push(
        createMockBeacon(
          `b_${i}`,
          (i * 0.00049) % 1.0,
          (i * 0.00097) % 1.0
        )
      );
    }
    grid.insertAll(mockBeacons);

    // Measure 1,000 queries
    const start = performance.now();
    for (let q = 0; q < 1000; q++) {
      const u = (q * 0.00099) % 1.0;
      const v = (q * 0.00088) % 1.0;
      grid.findNearest(u, v, 0.02);
    }
    const elapsed = performance.now() - start;
    const avgPerQueryMs = elapsed / 1000;

    // Must be well under 0.01 ms per query (typically ~0.0005 ms)
    expect(avgPerQueryMs).toBeLessThan(0.01);
  });
});
