import type { MapCamera } from '../lib/map-camera.js';
import type { Manifest } from '../lib/types.js';
import { i18n } from '../lib/i18n.js';

export function createControls(
  container: HTMLElement,
  camera: MapCamera,
  manifest: Manifest,
  onSpeedChange: (speed: number) => void,
  onPauseToggle: (paused: boolean) => void,
  onTierFilterChange?: (tier: 'all' | 'major' | 'sector' | 'minor') => void
): HTMLElement {
  const controls = document.createElement('footer');
  controls.className = 'site-controls';

  let isPaused = false;
  let currentSoloName: string | null = null;

  // Tier counts calculation
  let majorCount = 0;
  let sectorCount = 0;
  let minorCount = 0;

  for (const b of manifest.beacons) {
    if (b.tier === 'major') majorCount++;
    else if (b.tier === 'sector') sectorCount++;
    else minorCount++;
  }

  // Row container
  const row = document.createElement('div');
  row.className = 'controls-row';

  // 1. Play / Pause & Speed group
  const timeGroup = document.createElement('div');
  timeGroup.className = 'time-group';

  const playPauseBtn = document.createElement('button');
  playPauseBtn.className = 'control-btn play-btn';
  playPauseBtn.setAttribute('aria-label', i18n.t.playPauseAria);
  playPauseBtn.title = isPaused ? i18n.t.resumeTitle : i18n.t.pauseTitle;
  playPauseBtn.innerHTML = `
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>
  `;

  playPauseBtn.addEventListener('click', () => {
    isPaused = !isPaused;
    onPauseToggle(isPaused);
    playPauseBtn.title = isPaused ? i18n.t.resumeTitle : i18n.t.pauseTitle;
    playPauseBtn.innerHTML = isPaused
      ? `<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>`
      : `<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>`;
  });

  const SPEED_CONFIGS = [
    { label: '0.5x', mult: 0.125 },
    { label: '1.0x', mult: 0.25, isDefault: true },
    { label: '2.0x', mult: 0.50 },
  ];

  const speedBtns = SPEED_CONFIGS.map((cfg) => {
    const btn = document.createElement('button');
    btn.className = `control-btn speed-btn ${cfg.isDefault ? 'active' : ''}`;
    btn.textContent = cfg.label;
    btn.setAttribute('aria-label', i18n.t.speedAria(cfg.label));
    btn.setAttribute('aria-pressed', cfg.isDefault ? 'true' : 'false');
    btn.addEventListener('click', () => {
      speedBtns.forEach((b) => {
        b.classList.remove('active');
        b.setAttribute('aria-pressed', 'false');
      });
      btn.classList.add('active');
      btn.setAttribute('aria-pressed', 'true');
      onSpeedChange(cfg.mult);
    });
    return btn;
  });

  timeGroup.appendChild(playPauseBtn);
  speedBtns.forEach((b) => timeGroup.appendChild(b));

  // 2. Interactive Tier Filter Segmented Control
  const filterGroup = document.createElement('nav');
  filterGroup.className = 'tier-filter-nav';
  filterGroup.setAttribute('aria-label', i18n.t.tierAria);

  const filterConfigs: { tier: 'all' | 'major' | 'sector' | 'minor'; getLabel: () => string; count: number }[] = [
    { tier: 'all', getLabel: () => i18n.t.tierAll, count: manifest.n_beacons },
    { tier: 'major', getLabel: () => i18n.t.tierMajor, count: majorCount },
    { tier: 'sector', getLabel: () => i18n.t.tierSector, count: sectorCount },
    { tier: 'minor', getLabel: () => i18n.t.tierMinor, count: minorCount },
  ];

  const filterBtnEntries: { btn: HTMLButtonElement; labelSpan: HTMLElement; getLabel: () => string }[] = [];

  const filterBtns = filterConfigs.map((cfg, idx) => {
    const btn = document.createElement('button');
    btn.className = `filter-pill-btn ${idx === 0 ? 'active' : ''}`;
    btn.setAttribute('data-tier', cfg.tier);
    btn.setAttribute('aria-pressed', idx === 0 ? 'true' : 'false');

    const labelSpan = document.createElement('span');
    labelSpan.className = 'pill-label';
    labelSpan.textContent = cfg.getLabel();

    const countSpan = document.createElement('span');
    countSpan.className = 'pill-count font-mono';
    countSpan.textContent = String(cfg.count);

    btn.appendChild(labelSpan);
    btn.appendChild(document.createTextNode(' '));
    btn.appendChild(countSpan);

    btn.addEventListener('click', () => {
      filterBtns.forEach((b) => {
        b.classList.remove('active');
        b.setAttribute('aria-pressed', 'false');
      });
      btn.classList.add('active');
      btn.setAttribute('aria-pressed', 'true');
      if (onTierFilterChange) {
        onTierFilterChange(cfg.tier);
      }
    });

    filterBtnEntries.push({ btn, labelSpan, getLabel: cfg.getLabel });
    return btn;
  });

  filterBtns.forEach((b) => filterGroup.appendChild(b));

  // Solo mode indicator button
  const soloResetBtn = document.createElement('button');
  soloResetBtn.className = 'filter-pill-btn solo-active-btn hidden';
  const soloLabelSpan = document.createElement('span');
  soloLabelSpan.className = 'pill-label';
  const soloCloseSpan = document.createElement('span');
  soloCloseSpan.className = 'pill-count';
  soloCloseSpan.textContent = '✕';
  soloResetBtn.appendChild(soloLabelSpan);
  soloResetBtn.appendChild(document.createTextNode(' '));
  soloResetBtn.appendChild(soloCloseSpan);
  soloResetBtn.title = i18n.t.soloActiveTitle;
  filterGroup.appendChild(soloResetBtn);

  // 3. Zoom group (+, -, fit, zoom level indicator)
  const zoomGroup = document.createElement('div');
  zoomGroup.className = 'zoom-group';

  const zoomOutBtn = document.createElement('button');
  zoomOutBtn.className = 'control-btn zoom-btn';
  zoomOutBtn.textContent = '−';
  zoomOutBtn.setAttribute('aria-label', i18n.t.zoomOutTitle);
  zoomOutBtn.title = i18n.t.zoomOutTitle;
  zoomOutBtn.addEventListener('click', () => {
    camera.zoomAt(1.0 / 1.5, camera.viewportWidth / 2, camera.viewportHeight / 2);
    updateZoomDisplay();
  });

  const zoomDisplay = document.createElement('span');
  zoomDisplay.className = 'zoom-level-display';
  zoomDisplay.textContent = `${camera.zoom.toFixed(1)}×`;

  const zoomInBtn = document.createElement('button');
  zoomInBtn.className = 'control-btn zoom-btn';
  zoomInBtn.textContent = '+';
  zoomInBtn.setAttribute('aria-label', i18n.t.zoomInTitle);
  zoomInBtn.title = i18n.t.zoomInTitle;
  zoomInBtn.addEventListener('click', () => {
    camera.zoomAt(1.5, camera.viewportWidth / 2, camera.viewportHeight / 2);
    updateZoomDisplay();
  });

  const fitBtn = document.createElement('button');
  fitBtn.className = 'control-btn fit-btn';
  fitBtn.textContent = i18n.t.resetViewText;
  fitBtn.title = i18n.t.resetViewTitle;
  fitBtn.addEventListener('click', () => {
    camera.fitBounds();
    updateZoomDisplay();
  });

  zoomGroup.appendChild(zoomOutBtn);
  zoomGroup.appendChild(zoomDisplay);
  zoomGroup.appendChild(zoomInBtn);
  zoomGroup.appendChild(fitBtn);

  row.appendChild(timeGroup);
  row.appendChild(filterGroup);
  row.appendChild(zoomGroup);

  function updateZoomDisplay(): void {
    const text = `${camera.zoom.toFixed(1)}×`;
    if (zoomDisplay.textContent !== text) {
      zoomDisplay.textContent = text;
    }
  }

  function updateTexts(): void {
    playPauseBtn.setAttribute('aria-label', i18n.t.playPauseAria);
    playPauseBtn.title = isPaused ? i18n.t.resumeTitle : i18n.t.pauseTitle;

    speedBtns.forEach((b, i) => {
      b.setAttribute('aria-label', i18n.t.speedAria(SPEED_CONFIGS[i].label));
    });

    filterGroup.setAttribute('aria-label', i18n.t.tierAria);
    for (const entry of filterBtnEntries) {
      entry.labelSpan.textContent = entry.getLabel();
    }

    soloResetBtn.title = i18n.t.soloActiveTitle;
    if (currentSoloName) {
      soloLabelSpan.textContent = i18n.t.soloActiveText(currentSoloName);
    }

    zoomOutBtn.setAttribute('aria-label', i18n.t.zoomOutTitle);
    zoomOutBtn.title = i18n.t.zoomOutTitle;
    zoomInBtn.setAttribute('aria-label', i18n.t.zoomInTitle);
    zoomInBtn.title = i18n.t.zoomInTitle;
    fitBtn.textContent = i18n.t.resetViewText;
    fitBtn.title = i18n.t.resetViewTitle;
  }

  const unsubscribeI18n = i18n.onChange(updateTexts);
  const timerId = setInterval(updateZoomDisplay, 200);

  const controlsEl = controls as HTMLElement & {
    destroy?: () => void;
    setSoloState?: (name: string | null, onReset: () => void) => void;
  };

  controlsEl.destroy = () => {
    clearInterval(timerId);
    unsubscribeI18n();
  };

  controlsEl.setSoloState = (name: string | null, onReset: () => void) => {
    currentSoloName = name;
    if (name) {
      soloResetBtn.classList.remove('hidden');
      soloLabelSpan.textContent = i18n.t.soloActiveText(name);
      soloResetBtn.onclick = () => {
        onReset();
        currentSoloName = null;
        soloResetBtn.classList.add('hidden');
      };
    } else {
      soloResetBtn.classList.add('hidden');
    }
  };

  updateZoomDisplay();

  controls.appendChild(row);
  container.appendChild(controls);

  return controls;
}
