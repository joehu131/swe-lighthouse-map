import type { Beacon } from './types.js';
import { SpatialHashGrid } from './spatial-hash.js';
import { MapCamera } from './map-camera.js';

export interface ProbeState {
  hovered: Beacon | null;
  selected: Beacon | null;
  screenPos: [number, number] | null;
}

export class LighthouseProbe {
  private grid: SpatialHashGrid;
  private camera: MapCamera;
  private hoveredBeacon: Beacon | null = null;
  private selectedBeacon: Beacon | null = null;
  private listeners: ((state: ProbeState) => void)[] = [];

  constructor(camera: MapCamera, beacons: Beacon[]) {
    this.camera = camera;
    this.grid = new SpatialHashGrid(64, 128);
    this.grid.insertAll(beacons);
  }

  get state(): ProbeState {
    let screenPos: [number, number] | null = null;
    const active = this.selectedBeacon || this.hoveredBeacon;
    if (active) {
      screenPos = this.camera.uvToScreen(active.u, active.v);
    }

    return {
      hovered: this.hoveredBeacon,
      selected: this.selectedBeacon,
      screenPos,
    };
  }

  private activeTier: 'all' | 'major' | 'sector' | 'minor' = 'all';

  setTierFilter(tier: 'all' | 'major' | 'sector' | 'minor'): void {
    this.activeTier = tier;
    if (this.selectedBeacon && this.activeTier !== 'all' && this.selectedBeacon.tier !== this.activeTier) {
      this.selectedBeacon = null;
    }
    if (this.hoveredBeacon && this.activeTier !== 'all' && this.hoveredBeacon.tier !== this.activeTier) {
      this.hoveredBeacon = null;
    }
    this.notify();
  }

  private matchesTier(b: Beacon): boolean {
    return this.activeTier === 'all' || b.tier === this.activeTier;
  }

  /**
   * Pointer move handler.
   * Only performs hit-testing if camera zoom is >= HIT_TEST_MIN_ZOOM (2.5x).
   */
  onPointerMove(clientX: number, clientY: number): boolean {
    if (!this.camera.isHitTestAllowed()) {
      if (this.hoveredBeacon !== null) {
        this.hoveredBeacon = null;
        this.notify();
      }
      return false;
    }

    const [u, v] = this.camera.screenToUv(clientX, clientY);

    // 24 pixels radius converted to UV space
    const baseScale = Math.min(this.camera.viewportWidth, this.camera.viewportHeight / this.camera.aspectH);
    const scale = baseScale * this.camera.zoom;
    const maxRadiusUv = 24.0 / scale;

    const hit = this.grid.findNearest(u, v, maxRadiusUv, (b) => this.matchesTier(b));

    if (hit !== this.hoveredBeacon) {
      this.hoveredBeacon = hit;
      this.notify();
      return true;
    }
    return false;
  }

  /**
   * Pointer click handler.
   * Selects or deselects the clicked beacon.
   */
  onPointerClick(clientX: number, clientY: number): boolean {
    if (!this.camera.isHitTestAllowed()) {
      return false;
    }

    const [u, v] = this.camera.screenToUv(clientX, clientY);
    const baseScale = Math.min(this.camera.viewportWidth, this.camera.viewportHeight / this.camera.aspectH);
    const scale = baseScale * this.camera.zoom;
    const maxRadiusUv = 28.0 / scale;

    const hit = this.grid.findNearest(u, v, maxRadiusUv, (b) => this.matchesTier(b));

    if (hit) {
      this.selectedBeacon = hit;
      this.notify();
      return true;
    } else if (this.selectedBeacon !== null) {
      this.selectedBeacon = null;
      this.notify();
      return true;
    }

    return false;
  }

  select(beacon: Beacon | null): void {
    this.selectedBeacon = beacon;
    this.notify();
  }

  clearSelection(): void {
    if (this.selectedBeacon !== null) {
      this.selectedBeacon = null;
      this.notify();
    }
  }

  subscribe(listener: (state: ProbeState) => void): () => void {
    this.listeners.push(listener);
    listener(this.state);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  updateCameraMotion(): void {
    if (this.selectedBeacon || this.hoveredBeacon) {
      this.notify();
    }
  }

  notify(): void {
    const s = this.state;
    for (const listener of this.listeners) {
      listener(s);
    }
  }
}
