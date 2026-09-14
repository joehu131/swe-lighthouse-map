import { i18n } from '../lib/i18n.js';

export interface LightSettingsOutput {
  warmFactor: number;   // 0.0 = arctic, 1.0 = deep amber (default 1.0)
  beamGain: number;     // beam brightness physical gain (default 3.0)
  reachMult: number;    // beam radius physical multiplier (default 0.70)
  bgBrightness: number; // background exposure multiplier (default 1.20)
}

// User-facing normalized UI slider values
export interface LightSettingsValues {
  warmFactor: number;   // 0.0 to 1.0 (displayed 0% to 100%, default 0.5 -> 50%)
  brightness: number;   // normalized multiplier around baseline 3.0 (default 1.0x)
  reach: number;        // normalized multiplier around baseline 0.70 (default 1.0x)
  background: number;   // normalized multiplier around baseline 1.20 (default 1.0x)
}

const BASELINES = {
  beamGain: 3.0,
  reachMult: 0.70,
  bgBrightness: 1.20,
};

const DEFAULTS: LightSettingsValues = {
  warmFactor: 0.5,
  brightness: 1.0,
  reach: 1.0,
  background: 1.0,
};

const STORAGE_KEY = 'swe_fyrar_settings_v3';

function loadSavedSettings(): LightSettingsValues {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        warmFactor: typeof parsed.warmFactor === 'number' ? parsed.warmFactor : DEFAULTS.warmFactor,
        brightness: typeof parsed.brightness === 'number' ? parsed.brightness : DEFAULTS.brightness,
        reach: typeof parsed.reach === 'number' ? parsed.reach : DEFAULTS.reach,
        background: typeof parsed.background === 'number' ? parsed.background : DEFAULTS.background,
      };
    }
  } catch (e) {
    console.warn('[settings] Failed to read localStorage:', e);
  }
  return { ...DEFAULTS };
}

function saveSettings(values: LightSettingsValues): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(values));
  } catch (e) {
    console.warn('[settings] Failed to save localStorage:', e);
  }
}

function toOutput(v: LightSettingsValues): LightSettingsOutput {
  return {
    warmFactor: v.warmFactor,
    beamGain: v.brightness * BASELINES.beamGain,
    reachMult: v.reach * BASELINES.reachMult,
    bgBrightness: v.background * BASELINES.bgBrightness,
  };
}

export function createLightSettings(
  container: HTMLElement,
  anchorBtn: HTMLElement,
  onChange: (v: LightSettingsOutput) => void
): { destroy: () => void } {
  const values: LightSettingsValues = loadSavedSettings();

  const panel = document.createElement('div');
  panel.className = 'light-settings-panel hidden';
  panel.setAttribute('aria-label', i18n.t.settingsTitle);
  panel.setAttribute('role', 'dialog');

  function buildSlider(
    labelText: string,
    key: keyof LightSettingsValues,
    min: number,
    max: number,
    step: number,
    toDisplay: (v: number) => string
  ): HTMLElement {
    const row = document.createElement('div');
    row.className = 'lsp-row';

    const labelRow = document.createElement('div');
    labelRow.className = 'lsp-label-row';

    const label = document.createElement('span');
    label.className = 'lsp-label';
    label.textContent = labelText;

    const valueDisplay = document.createElement('span');
    valueDisplay.className = 'lsp-value';
    valueDisplay.textContent = toDisplay(values[key]);

    labelRow.appendChild(label);
    labelRow.appendChild(valueDisplay);

    const slider = document.createElement('input');
    slider.type = 'range';
    slider.className = 'lsp-slider';
    slider.min = String(min);
    slider.max = String(max);
    slider.step = String(step);
    slider.value = String(values[key]);

    slider.addEventListener('input', () => {
      const v = parseFloat(slider.value);
      (values as unknown as Record<string, number>)[key] = v;
      valueDisplay.textContent = toDisplay(v);
      saveSettings(values);
      onChange(toOutput(values));
    });

    row.appendChild(labelRow);
    row.appendChild(slider);
    return row;
  }

  const header = document.createElement('div');
  header.className = 'lsp-header';

  const titleEl = document.createElement('span');
  titleEl.className = 'lsp-title';
  titleEl.textContent = i18n.t.settingsTitle;
  header.appendChild(titleEl);

  const resetBtn = document.createElement('button');
  resetBtn.className = 'lsp-reset-btn';
  resetBtn.textContent = i18n.t.settingsResetBtn;
  resetBtn.title = i18n.t.settingsResetTitle;
  header.appendChild(resetBtn);

  panel.appendChild(header);

  let sliderContainer: HTMLElement | null = null;

  function buildSliders(): void {
    if (sliderContainer) sliderContainer.remove();
    sliderContainer = document.createElement('div');
    sliderContainer.className = 'lsp-sliders';

    sliderContainer.appendChild(
      buildSlider(i18n.t.warmthLabel, 'warmFactor', 0.0, 1.0, 0.01, (v) => Math.round(v * 100) + '%')
    );
    sliderContainer.appendChild(
      buildSlider(i18n.t.brightnessLabel, 'brightness', 0.2, 2.5, 0.05, (v) => v.toFixed(1) + '×')
    );
    sliderContainer.appendChild(
      buildSlider(i18n.t.reachLabel, 'reach', 0.3, 2.5, 0.05, (v) => v.toFixed(1) + '×')
    );
    sliderContainer.appendChild(
      buildSlider(i18n.t.bgLightLabel, 'background', 0.2, 2.5, 0.05, (v) => v.toFixed(1) + '×')
    );

    panel.appendChild(sliderContainer);
  }

  buildSliders();

  resetBtn.addEventListener('click', () => {
    Object.assign(values, DEFAULTS);
    saveSettings(values);
    buildSliders();
    onChange(toOutput(values));
  });

  function updateTexts(): void {
    panel.setAttribute('aria-label', i18n.t.settingsTitle);
    titleEl.textContent = i18n.t.settingsTitle;
    resetBtn.textContent = i18n.t.settingsResetBtn;
    resetBtn.title = i18n.t.settingsResetTitle;
    buildSliders();
  }

  const unsubscribeI18n = i18n.onChange(updateTexts);

  container.appendChild(panel);

  function positionPanel(): void {
    const rect = anchorBtn.getBoundingClientRect();
    panel.style.top = (rect.bottom + 8) + 'px';
    panel.style.right = (window.innerWidth - rect.right) + 'px';
    panel.style.left = 'auto';
  }

  function outsideClick(e: MouseEvent): void {
    if (!panel.contains(e.target as Node) && e.target !== anchorBtn) {
      panel.classList.add('hidden');
      anchorBtn.setAttribute('aria-expanded', 'false');
      document.removeEventListener('click', outsideClick);
    }
  }

  function toggle(): void {
    const isHidden = panel.classList.contains('hidden');
    panel.classList.toggle('hidden', !isHidden);
    anchorBtn.setAttribute('aria-expanded', isHidden ? 'true' : 'false');
    if (isHidden) {
      positionPanel();
      setTimeout(() => document.addEventListener('click', outsideClick), 0);
    } else {
      document.removeEventListener('click', outsideClick);
    }
  }

  anchorBtn.addEventListener('click', toggle);
  onChange(toOutput(values));

  return {
    destroy: () => {
      anchorBtn.removeEventListener('click', toggle);
      document.removeEventListener('click', outsideClick);
      unsubscribeI18n();
      panel.remove();
    },
  };
}
