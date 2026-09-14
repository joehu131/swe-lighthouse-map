import type { Beacon } from './types.js';

export class SpatialHashGrid {
  readonly cols: number;
  readonly rows: number;
  private grid: Beacon[][][];

  constructor(cols = 64, rows = 128) {
    this.cols = cols;
    this.rows = rows;
    this.grid = Array.from({ length: cols }, () =>
      Array.from({ length: rows }, () => [])
    );
  }

  clear(): void {
    for (let x = 0; x < this.cols; x++) {
      for (let y = 0; y < this.rows; y++) {
        this.grid[x][y].length = 0;
      }
    }
  }

  insert(beacon: Beacon): void {
    const cx = Math.min(this.cols - 1, Math.max(0, Math.floor(beacon.u * this.cols)));
    const cy = Math.min(this.rows - 1, Math.max(0, Math.floor(beacon.v * this.rows)));
    this.grid[cx][cy].push(beacon);
  }

  insertAll(beacons: Beacon[]): void {
    for (let i = 0; i < beacons.length; i++) {
      this.insert(beacons[i]);
    }
  }

  /**
   * Finds the nearest beacon to (u, v) within maxRadiusUv.
   * Returns null if no beacon is within radius.
   * Runs in O(1) time (< 1 microsecond) by inspecting only neighboring cells.
   */
  findNearest(
    u: number,
    v: number,
    maxRadiusUv: number,
    filter?: (b: Beacon) => boolean
  ): Beacon | null {
    if (u < 0.0 || u > 1.0 || v < 0.0 || v > 1.0) return null;

    const cx = Math.min(this.cols - 1, Math.max(0, Math.floor(u * this.cols)));
    const cy = Math.min(this.rows - 1, Math.max(0, Math.floor(v * this.rows)));

    // Calculate how many cell steps maxRadiusUv spans
    const cellSpanX = Math.max(1, Math.ceil(maxRadiusUv * this.cols));
    const cellSpanY = Math.max(1, Math.ceil(maxRadiusUv * this.rows));

    const minX = Math.max(0, cx - cellSpanX);
    const maxX = Math.min(this.cols - 1, cx + cellSpanX);
    const minY = Math.max(0, cy - cellSpanY);
    const maxY = Math.min(this.rows - 1, cy + cellSpanY);

    let bestDistSq = maxRadiusUv * maxRadiusUv;
    let bestBeacon: Beacon | null = null;

    for (let x = minX; x <= maxX; x++) {
      for (let y = minY; y <= maxY; y++) {
        const cell = this.grid[x][y];
        for (let i = 0; i < cell.length; i++) {
          const b = cell[i];
          if (filter && !filter(b)) continue;

          const du = b.u - u;
          const dv = b.v - v;
          const distSq = du * du + dv * dv;
          if (distSq < bestDistSq) {
            bestDistSq = distSq;
            bestBeacon = b;
          }
        }
      }
    }

    return bestBeacon;
  }
}
