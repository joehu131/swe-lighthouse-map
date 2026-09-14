export interface CameraState {
  centerU: number; // [0, 1] normalized plate coordinate
  centerV: number; // [0, 1] normalized plate coordinate
  zoom: number;    // 1.0 (national fit) to 50.0+ (archipelago close-up)
}

export const MIN_ZOOM = 0.85;
export const MAX_ZOOM = 64.0;
export const HIT_TEST_MIN_ZOOM = 2.5; // Zoom gate for lighthouse clickability

export class MapCamera {
  centerU = 0.5;
  centerV = 0.5;
  zoom = 1.0;

  viewportWidth = 1000;
  viewportHeight = 800;
  aspectH = 1.50; // Height/Width ratio of Nordic plate (4096 x 6144 = 1.50)

  private isDragging = false;
  private lastMouseX = 0;
  private lastMouseY = 0;

  private targetU = 0.5;
  private targetV = 0.5;
  private targetZoom = 1.0;
  private isAnimating = false;
  private animStartTime = 0;
  private animDurationMs = 800;
  private startU = 0.5;
  private startV = 0.5;
  private startZoom = 1.0;

  constructor(aspectH = 1.50) {
    this.aspectH = aspectH;
    this.fitBounds();
  }

  resize(width: number, height: number): void {
    this.viewportWidth = Math.max(10, width);
    this.viewportHeight = Math.max(10, height);
    this.clampBounds();
  }

  fitBounds(): void {
    this.centerU = 0.5;
    this.centerV = 0.5;
    this.zoom = 1.0;
    this.targetU = 0.5;
    this.targetV = 0.5;
    this.targetZoom = 1.0;
    this.isAnimating = false;
    this.clampBounds();
  }

  flyTo(u: number, v: number, targetZoom = 5.0, durationMs = 800): void {
    this.startU = this.centerU;
    this.startV = this.centerV;
    this.startZoom = this.zoom;
    this.targetU = Math.min(1.0, Math.max(0.0, u));
    this.targetV = Math.min(1.0, Math.max(0.0, v));
    this.targetZoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, targetZoom));
    this.animDurationMs = durationMs;
    this.animStartTime = performance.now();
    this.isAnimating = true;
  }

  updateAnimation(): boolean {
    if (!this.isAnimating) return false;

    const elapsed = performance.now() - this.animStartTime;
    const t = Math.min(1.0, elapsed / this.animDurationMs);

    // Smooth cubic ease-out
    const ease = 1.0 - Math.pow(1.0 - t, 3);

    this.centerU = this.startU + (this.targetU - this.startU) * ease;
    this.centerV = this.startV + (this.targetV - this.startV) * ease;
    this.zoom = this.startZoom + (this.targetZoom - this.startZoom) * ease;

    this.clampBounds();

    if (t >= 1.0) {
      this.isAnimating = false;
    }
    return true;
  }

  startDrag(clientX: number, clientY: number): void {
    this.isDragging = true;
    this.lastMouseX = clientX;
    this.lastMouseY = clientY;
    this.isAnimating = false;
  }

  drag(clientX: number, clientY: number): void {
    if (!this.isDragging) return;

    const dx = clientX - this.lastMouseX;
    const dy = clientY - this.lastMouseY;
    this.lastMouseX = clientX;
    this.lastMouseY = clientY;

    // Convert pixel delta to UV delta
    // Viewport scale: at zoom 1.0, the plate fits the screen
    const baseScale = Math.min(this.viewportWidth, this.viewportHeight / this.aspectH);
    const scale = baseScale * this.zoom;

    this.centerU -= dx / scale;
    this.centerV -= dy / (scale * this.aspectH);

    this.clampBounds();
  }

  endDrag(): void {
    this.isDragging = false;
  }

  zoomAt(deltaZoom: number, clientX: number, clientY: number): void {
    this.isAnimating = false;
    const oldZoom = this.zoom;
    const newZoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, this.zoom * deltaZoom));
    if (newZoom === oldZoom) return;

    // Zoom anchored to cursor position
    const [cursorU, cursorV] = this.screenToUv(clientX, clientY);

    this.zoom = newZoom;

    // Adjust center so cursor point remains under the cursor
    const [newCursorU, newCursorV] = this.screenToUv(clientX, clientY);
    this.centerU += cursorU - newCursorU;
    this.centerV += cursorV - newCursorV;

    this.clampBounds();
  }

  clampBounds(): void {
    // Generous pan bounding box allows free exploration at all zoom levels,
    // including full zoom-out, without getting stuck or locked at (0.5, 0.5)
    const extraMargin = 0.50; // 50% extra margin around plate
    this.centerU = Math.min(1.0 + extraMargin, Math.max(-extraMargin, this.centerU));
    this.centerV = Math.min(1.0 + extraMargin, Math.max(-extraMargin, this.centerV));
  }

  screenToUv(screenX: number, screenY: number): [number, number] {
    const baseScale = Math.min(this.viewportWidth, this.viewportHeight / this.aspectH);
    const scale = baseScale * this.zoom;

    const relX = screenX - this.viewportWidth / 2.0;
    const relY = screenY - this.viewportHeight / 2.0;

    const u = this.centerU + relX / scale;
    const v = this.centerV + relY / (scale * this.aspectH);

    return [u, v];
  }

  uvToScreen(u: number, v: number): [number, number] {
    const baseScale = Math.min(this.viewportWidth, this.viewportHeight / this.aspectH);
    const scale = baseScale * this.zoom;

    const screenX = this.viewportWidth / 2.0 + (u - this.centerU) * scale;
    const screenY = this.viewportHeight / 2.0 + (v - this.centerV) * (scale * this.aspectH);

    return [screenX, screenY];
  }

  isHitTestAllowed(): boolean {
    return this.zoom >= HIT_TEST_MIN_ZOOM;
  }
}
