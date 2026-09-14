import './style.css';
import type { Manifest } from './lib/types.js';
import { MapCamera } from './lib/map-camera.js';
import { ThemeManager } from './lib/theme-manager.js';
import { LighthouseProbe } from './lib/lighthouse-probe.js';
import { WebGPURenderer } from './lib/webgpu-renderer.js';

import { createHeader } from './components/Header.js';
import { createControls } from './components/Controls.js';
import { createInspector } from './components/Inspector.js';
import { createSearch } from './components/Search.js';
import { createLightSettings } from './components/LightSettings.js';

import { i18n } from './lib/i18n.js';

async function bootstrap() {
  const appContainer = document.getElementById('app');
  const canvas = document.getElementById('map-canvas') as HTMLCanvasElement;
  if (!appContainer || !canvas) return;

  // 1. Require WebGPU before doing anything else
  if (!WebGPURenderer.isSupported()) {
    showWebGPUError(appContainer);
    return;
  }

  // 2. Fetch Swedish Lighthouse Manifest
  const baseUrl = import.meta.env.BASE_URL.endsWith('/')
    ? import.meta.env.BASE_URL
    : `${import.meta.env.BASE_URL}/`;
  const res = await fetch(`${baseUrl}data/manifest.json`);
  if (!res.ok) {
    throw new Error(`Failed to load manifest.json (${res.status})`);
  }
  const manifest: Manifest = await res.json();

  // 3. Initialize Core Systems
  const theme = new ThemeManager();
  const camera = new MapCamera(manifest.aspect_h);
  const probe = new LighthouseProbe(camera, manifest.beacons);

  // Resize handler
  function handleResize(): void {
    const dpr = Math.min(2.0, window.devicePixelRatio || 1.0);
    const w = window.innerWidth;
    const h = window.innerHeight;

    canvas.width = Math.floor(w * dpr);
    canvas.height = Math.floor(h * dpr);
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;

    camera.resize(canvas.width, canvas.height);
  }
  window.addEventListener('resize', handleResize);
  handleResize();

  // 4. Initialize WebGPU Renderer
  let renderer: WebGPURenderer;
  try {
    renderer = new WebGPURenderer(canvas, manifest, camera, theme);
    await renderer.init();
    console.log('[engine] WebGPU hardware rendering initialized at 60 FPS.');
  } catch (err) {
    console.error('[engine] WebGPU initialization failed:', err);
    showWebGPUError(
      appContainer,
      undefined,
      err instanceof Error ? err.message : String(err)
    );
    return;
  }

  renderer.setOnFrame(() => {
    probe.updateCameraMotion();
  });
  renderer.start();

  // 5. Mount UI Components
  const { settingsBtn } = createHeader(appContainer, camera, theme, manifest.beacons);
  createLightSettings(appContainer, settingsBtn, ({ warmFactor, beamGain, reachMult, bgBrightness }) => {
    renderer.setLightSettings(warmFactor, beamGain, reachMult, bgBrightness);
  });
  const controls = createControls(
    appContainer,
    camera,
    manifest,
    (speed) => renderer.setSpeed(speed),
    (paused) => renderer.setPaused(paused),
    (tier) => {
      renderer.setTierFilter(tier);
      probe.setTierFilter(tier);
    }
  ) as HTMLElement & { setSoloState?: (name: string | null, onReset: () => void) => void };

  createInspector(
    appContainer,
    probe,
    (soloId) => {
      renderer.setSoloBeacon(soloId);
      if (soloId) {
        const beacon = manifest.beacons.find((b) => b.id === soloId);
        const fallback = i18n.lang === 'sv' ? 'vald fyr' : 'selected light';
        controls.setSoloState?.(beacon ? beacon.name : fallback, () => {
          renderer.setSoloBeacon(null);
          probe.updateCameraMotion();
        });
      } else {
        controls.setSoloState?.(null, () => {});
      }
    },
    () => renderer.getSoloBeacon()
  );
  createSearch(appContainer, camera, probe, manifest.beacons);

  // 6. Setup Pointer & Gesture Interaction
  setupInteraction(canvas, camera, probe);
}

function showWebGPUError(container: HTMLElement, headline?: string, detail?: string): void {
  // Hide canvas so the background is visible
  const canvas = container.querySelector('canvas');
  if (canvas) canvas.style.display = 'none';

  const card = document.createElement('div');
  card.className = 'webgpu-error-card';
  card.innerHTML = `
    <div class="webgpu-error-icon">
      <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
        <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
      </svg>
    </div>
    <h2 class="webgpu-error-title">${i18n.t.webgpuErrorTitle}</h2>
    <p class="webgpu-error-body">${headline || i18n.t.webgpuErrorBody}</p>
    ${detail ? `<p class="webgpu-error-detail">${i18n.t.webgpuErrorDetail} ${detail}</p>` : ''}
    <div class="webgpu-error-browsers">
      <p class="webgpu-error-hint">${i18n.t.webgpuErrorHint}</p>
      <ul>
        <li>Google Chrome 113+</li>
        <li>Microsoft Edge 113+</li>
        <li>Firefox Nightly</li>
      </ul>
    </div>
  `;
  container.appendChild(card);
}

function setupInteraction(
  canvas: HTMLCanvasElement,
  camera: MapCamera,
  probe: LighthouseProbe
): void {
  let isPointerDown = false;
  let hasMovedSignificantly = false;
  let startX = 0;
  let startY = 0;

  // Touch pinch-to-zoom tracking
  let initialPinchDistance = 0;
  let initialZoom = 1.0;

  canvas.addEventListener('pointerdown', (e: PointerEvent) => {
    // Only initiate dragging on the primary pointer (ignore secondary pointers during multi-touch)
    if (!e.isPrimary) return;

    isPointerDown = true;
    hasMovedSignificantly = false;
    startX = e.clientX;
    startY = e.clientY;

    const dpr = Math.min(2.0, window.devicePixelRatio || 1.0);
    camera.startDrag(e.clientX * dpr, e.clientY * dpr);
    canvas.setPointerCapture(e.pointerId);
  });

  canvas.addEventListener('pointermove', (e: PointerEvent) => {
    const dpr = Math.min(2.0, window.devicePixelRatio || 1.0);

    if (isPointerDown && e.isPrimary) {
      const dist = Math.hypot(e.clientX - startX, e.clientY - startY);
      if (dist > 6) {
        hasMovedSignificantly = true;
      }
      camera.drag(e.clientX * dpr, e.clientY * dpr);
      probe.updateCameraMotion();
    } else if (!isPointerDown) {
      probe.onPointerMove(e.clientX * dpr, e.clientY * dpr);
    }
  });

  function endPointer(e: PointerEvent): void {
    if (isPointerDown && e.isPrimary) {
      isPointerDown = false;
      camera.endDrag();
      try {
        canvas.releasePointerCapture(e.pointerId);
      } catch {
        // Ignored if not captured
      }

      // If user clicked without dragging, evaluate click selection
      if (!hasMovedSignificantly) {
        const dpr = Math.min(2.0, window.devicePixelRatio || 1.0);
        probe.onPointerClick(e.clientX * dpr, e.clientY * dpr);
      }
    }
  }

  canvas.addEventListener('pointerup', endPointer);
  canvas.addEventListener('pointercancel', endPointer);

  canvas.addEventListener(
    'wheel',
    (e: WheelEvent) => {
      e.preventDefault();
      const dpr = Math.min(2.0, window.devicePixelRatio || 1.0);
      const factor = e.deltaY < 0 ? 1.25 : 1.0 / 1.25;
      camera.zoomAt(factor, e.clientX * dpr, e.clientY * dpr);
      probe.updateCameraMotion();
    },
    { passive: false }
  );

  // Touch pinch gestures
  canvas.addEventListener(
    'touchstart',
    (e: TouchEvent) => {
      if (e.touches.length >= 2) {
        // Disengage single-finger dragging to prevent conflict with dual-finger pinch
        isPointerDown = false;
        hasMovedSignificantly = true;
        camera.endDrag();

        const dx = e.touches[0].clientX - e.touches[1].clientX;
        const dy = e.touches[0].clientY - e.touches[1].clientY;
        initialPinchDistance = Math.hypot(dx, dy);
        initialZoom = camera.zoom;
      }
    },
    { passive: true }
  );

  canvas.addEventListener(
    'touchmove',
    (e: TouchEvent) => {
      if (e.touches.length >= 2 && initialPinchDistance > 0) {
        // Ensure pointer drag remains inactive during pinch
        isPointerDown = false;
        hasMovedSignificantly = true;

        const dx = e.touches[0].clientX - e.touches[1].clientX;
        const dy = e.touches[0].clientY - e.touches[1].clientY;
        const dist = Math.hypot(dx, dy);
        const factor = dist / initialPinchDistance;

        const centerX = (e.touches[0].clientX + e.touches[1].clientX) / 2.0;
        const centerY = (e.touches[0].clientY + e.touches[1].clientY) / 2.0;
        const dpr = Math.min(2.0, window.devicePixelRatio || 1.0);

        camera.zoomAt(factor / (camera.zoom / initialZoom), centerX * dpr, centerY * dpr);
        probe.updateCameraMotion();
      }
    },
    { passive: true }
  );

  // Keyboard navigation
  window.addEventListener('keydown', (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      probe.clearSelection();
    } else if (e.key === '+' || e.key === '=') {
      camera.zoomAt(1.4, camera.viewportWidth / 2, camera.viewportHeight / 2);
    } else if (e.key === '-' || e.key === '_') {
      camera.zoomAt(1 / 1.4, camera.viewportWidth / 2, camera.viewportHeight / 2);
    } else if (e.key === '0') {
      camera.fitBounds();
    }
  });
}

bootstrap().catch((err) => {
  console.error('[engine] Bootstrap failure:', err);
});
