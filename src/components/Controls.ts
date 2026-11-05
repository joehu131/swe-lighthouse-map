import type { MapCamera } from '../lib/map-camera.js';
import type { Manifest } from '../lib/types.js';
import { i18n } from '../lib/i18n.js';

type Tier = 'all' | 'major' | 'sector' | 'minor';

// Chart-style symbols for the legend rows. Colours come from CSS classes (see .sym-* in style.css).
const LEGEND_SYMBOLS: Record<Tier, string> = {
  all: `<circle cx="9" cy="9" r="6.5" class="sym-ring"/><circle cx="9" cy="9" r="1.8" class="sym-accent"/>`,
  major: `<path d="M9 9 L17 4.5 A9 9 0 0 1 17 13.5 Z" class="sym-accent"/><circle cx="9" cy="9" r="1.8" class="sym-white"/>`,
  sector:
    `<path d="M9 9 L1.5 3 A9.6 9.6 0 0 1 6 0.9 Z" class="sym-red"/>` +
    `<path d="M9 9 L6 0.9 A9.6 9.6 0 0 1 12 0.9 Z" class="sym-white"/>` +
    `<path d="M9 9 L12 0.9 A9.6 9.6 0 0 1 16.5 3 Z" class="sym-green"/>` +
    `<circle cx="9" cy="9" r="1.8" class="sym-white"/>`,
  minor: `<circle cx="9" cy="9" r="4.5" class="sym-amber-ring"/><circle cx="9" cy="9" r="2.2" class="sym-amber"/>`,
};

const ICON_PAUSE = `<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>`;
const ICON_PLAY = `<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><polygon points="6 4 20 12 6 20 6 4"/></svg>`;
const ICON_CLOSE = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12"/></svg>`;

function formatCount(n: number): string {
  return n.toLocaleString(i18n.lang === 'sv' ? 'sv-SE' : 'en-GB');
}

/**
 * Mounts two parts:
 *  - the legend (bottom left): one row per lighthouse category, which also filters the map
 *  - the toolbar (bottom centre): animation playback and zoom
 * Returns the toolbar element, extended with setSoloState() for the "only this light" row.
 */
export function createControls(
  container: HTMLElement,
  camera: MapCamera,
  manifest: Manifest,
  onSpeedChange: (speed: number) => void,
  onPauseToggle: (paused: boolean) => void,
  onTierFilterChange?: (tier: Tier) => void
): HTMLElement {
  let isPaused = false;
  let currentSoloName: string | null = null;

  const counts: Record<Tier, number> = { all: manifest.n_beacons, major: 0, sector: 0, minor: 0 };
  for (const b of manifest.beacons) {
    counts[b.tier] += 1;
  }

  // ---------------------------------------------------------------------------
  // Legend
  // ---------------------------------------------------------------------------
  const legend = document.createElement('section');
  legend.className = 'map-legend';
  legend.setAttribute('aria-labelledby', 'map-legend-title');

  const legendTitle = document.createElement('h2');
  legendTitle.className = 'legend-title';
  legendTitle.id = 'map-legend-title';
  legendTitle.textContent = i18n.t.legendTitle;

  const filterGroup = document.createElement('nav');
  filterGroup.className = 'tier-filter-nav';
  filterGroup.setAttribute('aria-label', i18n.t.tierAria);

  const tierLabels: Record<Tier, () => string> = {
    all: () => i18n.t.tierAll,
    major: () => i18n.t.tierMajor,
    sector: () => i18n.t.tierSector,
    minor: () => i18n.t.tierMinor,
  };

  const rows: { tier: Tier; btn: HTMLButtonElement; label: HTMLElement; count: HTMLElement }[] = [];

  (['all', 'major', 'sector', 'minor'] as Tier[]).forEach((tier, idx) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `legend-row${idx === 0 ? ' active' : ''}`;
    btn.dataset.tier = tier;
    btn.setAttribute('aria-pressed', idx === 0 ? 'true' : 'false');
    btn.innerHTML = `<svg class="legend-symbol" viewBox="0 0 18 18" width="18" height="18" aria-hidden="true">${LEGEND_SYMBOLS[tier]}</svg>`;

    const label = document.createElement('span');
    label.className = 'legend-label';
    label.textContent = tierLabels[tier]();

    const count = document.createElement('span');
    count.className = 'legend-count';
    count.textContent = formatCount(counts[tier]);

    btn.append(label, count);
    btn.addEventListener('click', () => {
      for (const row of rows) {
        row.btn.classList.toggle('active', row.btn === btn);
        row.btn.setAttribute('aria-pressed', row.btn === btn ? 'true' : 'false');
      }
      onTierFilterChange?.(tier);
    });

    rows.push({ tier, btn, label, count });
    filterGroup.appendChild(btn);
  });

  // Shown while one lighthouse is isolated; clicking it shows all beams again
  const soloResetBtn = document.createElement('button');
  soloResetBtn.type = 'button';
  soloResetBtn.className = 'legend-row solo-active-btn hidden';
  const soloLabelSpan = document.createElement('span');
  soloLabelSpan.className = 'legend-label';
  const soloIcon = document.createElement('span');
  soloIcon.className = 'legend-count';
  soloIcon.innerHTML = ICON_CLOSE;
  soloResetBtn.append(soloLabelSpan, soloIcon);
  soloResetBtn.title = i18n.t.soloActiveTitle;
  filterGroup.appendChild(soloResetBtn);

  legend.append(legendTitle, filterGroup);

  // ---------------------------------------------------------------------------
  // Toolbar: playback and zoom
  // ---------------------------------------------------------------------------
  const controls = document.createElement('footer');
  controls.className = 'site-controls';

  const timeGroup = document.createElement('div');
  timeGroup.className = 'time-group';

  const playPauseBtn = document.createElement('button');
  playPauseBtn.type = 'button';
  playPauseBtn.className = 'control-btn play-btn';
  playPauseBtn.setAttribute('aria-label', i18n.t.playPauseAria);
  playPauseBtn.title = i18n.t.pauseTitle;
  playPauseBtn.innerHTML = ICON_PAUSE;

  playPauseBtn.addEventListener('click', () => {
    isPaused = !isPaused;
    onPauseToggle(isPaused);
    playPauseBtn.title = isPaused ? i18n.t.resumeTitle : i18n.t.pauseTitle;
    playPauseBtn.innerHTML = isPaused ? ICON_PLAY : ICON_PAUSE;
  });

  const SPEED_CONFIGS = [
    { label: '0.5×', mult: 0.125 },
    { label: '1×', mult: 0.25, isDefault: true },
    { label: '2×', mult: 0.5 },
  ];

  const speedBtns = SPEED_CONFIGS.map((cfg) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `control-btn speed-btn${cfg.isDefault ? ' active' : ''}`;
    btn.textContent = cfg.label;
    btn.setAttribute('aria-label', i18n.t.speedAria(cfg.label));
    btn.setAttribute('aria-pressed', cfg.isDefault ? 'true' : 'false');
    btn.addEventListener('click', () => {
      for (const other of speedBtns) {
        other.classList.toggle('active', other === btn);
        other.setAttribute('aria-pressed', other === btn ? 'true' : 'false');
      }
      onSpeedChange(cfg.mult);
    });
    return btn;
  });

  timeGroup.append(playPauseBtn, ...speedBtns);

  const zoomGroup = document.createElement('div');
  zoomGroup.className = 'zoom-group';

  const zoomOutBtn = document.createElement('button');
  zoomOutBtn.type = 'button';
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

  const zoomInBtn = document.createElement('button');
  zoomInBtn.type = 'button';
  zoomInBtn.className = 'control-btn zoom-btn';
  zoomInBtn.textContent = '+';
  zoomInBtn.setAttribute('aria-label', i18n.t.zoomInTitle);
  zoomInBtn.title = i18n.t.zoomInTitle;
  zoomInBtn.addEventListener('click', () => {
    camera.zoomAt(1.5, camera.viewportWidth / 2, camera.viewportHeight / 2);
    updateZoomDisplay();
  });

  const fitBtn = document.createElement('button');
  fitBtn.type = 'button';
  fitBtn.className = 'control-btn fit-btn';
  fitBtn.textContent = i18n.t.resetViewText;
  fitBtn.title = i18n.t.resetViewTitle;
  fitBtn.addEventListener('click', () => {
    camera.fitBounds();
    updateZoomDisplay();
  });

  zoomGroup.append(zoomOutBtn, zoomDisplay, zoomInBtn, fitBtn);
  controls.append(timeGroup, zoomGroup);

  function updateZoomDisplay(): void {
    const text = `${camera.zoom.toFixed(1)}×`;
    if (zoomDisplay.textContent !== text) {
      zoomDisplay.textContent = text;
    }
  }

  function updateTexts(): void {
    legendTitle.textContent = i18n.t.legendTitle;
    filterGroup.setAttribute('aria-label', i18n.t.tierAria);
    for (const row of rows) {
      row.label.textContent = tierLabels[row.tier]();
      row.count.textContent = formatCount(counts[row.tier]);
    }

    soloResetBtn.title = i18n.t.soloActiveTitle;
    if (currentSoloName) {
      soloLabelSpan.textContent = i18n.t.soloActiveText(currentSoloName);
    }

    playPauseBtn.setAttribute('aria-label', i18n.t.playPauseAria);
    playPauseBtn.title = isPaused ? i18n.t.resumeTitle : i18n.t.pauseTitle;
    speedBtns.forEach((b, i) => b.setAttribute('aria-label', i18n.t.speedAria(SPEED_CONFIGS[i].label)));

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
    legend.remove();
    controls.remove();
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

  container.append(legend, controls);
  return controls;
}
