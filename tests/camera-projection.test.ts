import { describe, it, expect } from 'vitest';
import { MapCamera, HIT_TEST_MIN_ZOOM, MIN_ZOOM, MAX_ZOOM } from '../src/lib/map-camera.ts';

describe('Map Camera & Coordinate Projection', () => {
  it('initializes at national overview with zoom 1.0', () => {
    const camera = new MapCamera(2.275);
    camera.resize(1000, 800);

    expect(camera.zoom).toBe(1.0);
    expect(camera.centerU).toBe(0.5);
    expect(camera.centerV).toBe(0.5);
    // Hit testing must be disabled when zoomed out
    expect(camera.isHitTestAllowed()).toBe(false);
  });

  it('enforces zoom bounds between MIN_ZOOM and MAX_ZOOM', () => {
    const camera = new MapCamera(2.275);
    camera.resize(1000, 800);

    // Zoom out past min
    camera.zoomAt(0.1, 500, 400);
    expect(camera.zoom).toBe(MIN_ZOOM);

    // Zoom in past max
    camera.zoomAt(1000.0, 500, 400);
    expect(camera.zoom).toBe(MAX_ZOOM);
  });

  it('enables hit testing only when zoomed in (Z >= HIT_TEST_MIN_ZOOM)', () => {
    const camera = new MapCamera(2.275);
    camera.resize(1000, 800);

    camera.zoom = 2.0;
    expect(camera.isHitTestAllowed()).toBe(false);

    camera.zoom = HIT_TEST_MIN_ZOOM;
    expect(camera.isHitTestAllowed()).toBe(true);

    camera.zoom = 8.0;
    expect(camera.isHitTestAllowed()).toBe(true);
  });

  it('converts between screen coordinates and UV space reversibly', () => {
    const camera = new MapCamera(2.275);
    camera.resize(1200, 900);
    camera.zoom = 3.5;
    camera.centerU = 0.35;
    camera.centerV = 0.65;

    const testScreenX = 450;
    const testScreenY = 320;

    const [u, v] = camera.screenToUv(testScreenX, testScreenY);
    const [reScreenX, reScreenY] = camera.uvToScreen(u, v);

    expect(reScreenX).toBeCloseTo(testScreenX, 4);
    expect(reScreenY).toBeCloseTo(testScreenY, 4);
  });

  it('smoothly interpolates flyTo animation', () => {
    const camera = new MapCamera(2.275);
    camera.resize(1000, 800);

    camera.flyTo(0.25, 0.75, 5.0, 500);
    expect(camera.updateAnimation()).toBe(true);

    // Target values registered
    expect(camera.zoom).toBeGreaterThan(1.0);
  });
});
