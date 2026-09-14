import type { MapCamera } from '../lib/map-camera.js';
import type { LighthouseProbe } from '../lib/lighthouse-probe.js';
import type { Beacon } from '../lib/types.js';
import { i18n } from '../lib/i18n.js';

export function createSearch(
  container: HTMLElement,
  camera: MapCamera,
  probe: LighthouseProbe,
  beacons: Beacon[]
): HTMLElement {
  const wrap = document.createElement('div');
  wrap.className = 'search-container';

  wrap.innerHTML = `
    <div class="search-input-wrap">
      <svg class="search-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
      <input type="text" class="search-input" placeholder="${i18n.t.searchPlaceholder}" aria-label="${i18n.t.searchAria}">
      <button class="search-clear-btn hidden" aria-label="${i18n.t.searchClearAria}">✕</button>
    </div>
    <ul class="search-results hidden" role="listbox"></ul>
  `;

  const input = wrap.querySelector('.search-input') as HTMLInputElement;
  const clearBtn = wrap.querySelector('.search-clear-btn') as HTMLButtonElement;
  const resultsList = wrap.querySelector('.search-results') as HTMLUListElement;

  function updateTexts(): void {
    input.placeholder = i18n.t.searchPlaceholder;
    input.setAttribute('aria-label', i18n.t.searchAria);
    clearBtn.setAttribute('aria-label', i18n.t.searchClearAria);
  }

  i18n.onChange(updateTexts);

  let currentMatches: Beacon[] = [];
  let selectedIndex = -1;

  function selectBeacon(b: Beacon): void {
    camera.flyTo(b.u, b.v, 7.5, 900);
    probe.select(b);
    resultsList.classList.add('hidden');
    selectedIndex = -1;
  }

  function updateActiveOption(): void {
    const items = resultsList.querySelectorAll('.search-result-item');
    items.forEach((item, idx) => {
      const isSelected = idx === selectedIndex;
      item.classList.toggle('selected', isSelected);
      item.setAttribute('aria-selected', isSelected ? 'true' : 'false');
      if (isSelected) {
        (item as HTMLElement).scrollIntoView({ block: 'nearest' });
      }
    });
  }

  function renderResults(matches: Beacon[]): void {
    currentMatches = matches.slice(0, 6);
    selectedIndex = -1;
    resultsList.innerHTML = '';

    if (currentMatches.length === 0) {
      resultsList.classList.add('hidden');
      return;
    }

    resultsList.classList.remove('hidden');

    for (let i = 0; i < currentMatches.length; i++) {
      const b = currentMatches[i];
      const li = document.createElement('li');
      li.className = 'search-result-item';
      li.setAttribute('role', 'option');
      li.setAttribute('aria-selected', 'false');
      li.setAttribute('id', `search-opt-${i}`);
      li.innerHTML = `
        <div class="result-name">${b.name}</div>
        <div class="result-sub">${b.facts.character} · ${b.facts.lat.toFixed(2)}°N, ${b.facts.lon.toFixed(2)}°E</div>
      `;

      li.addEventListener('click', () => {
        selectBeacon(b);
      });

      li.addEventListener('mouseenter', () => {
        selectedIndex = i;
        updateActiveOption();
      });

      resultsList.appendChild(li);
    }
  }

  input.addEventListener('input', () => {
    const q = input.value.trim().toLowerCase();
    clearBtn.classList.toggle('hidden', q.length === 0);

    if (q.length < 2) {
      currentMatches = [];
      resultsList.classList.add('hidden');
      return;
    }

    const matches = beacons.filter((b) => (b.name || '').toLowerCase().includes(q));
    renderResults(matches);
  });

  input.addEventListener('keydown', (e: KeyboardEvent) => {
    if (resultsList.classList.contains('hidden') || currentMatches.length === 0) {
      if (e.key === 'Escape') {
        input.value = '';
        clearBtn.classList.add('hidden');
        input.blur();
      }
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      selectedIndex = Math.min(selectedIndex + 1, currentMatches.length - 1);
      updateActiveOption();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      selectedIndex = Math.max(selectedIndex - 1, 0);
      updateActiveOption();
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (selectedIndex >= 0 && selectedIndex < currentMatches.length) {
        selectBeacon(currentMatches[selectedIndex]);
      } else if (currentMatches.length > 0) {
        selectBeacon(currentMatches[0]);
      }
    } else if (e.key === 'Escape') {
      resultsList.classList.add('hidden');
      selectedIndex = -1;
    }
  });

  clearBtn.addEventListener('click', () => {
    input.value = '';
    clearBtn.classList.add('hidden');
    resultsList.classList.add('hidden');
    selectedIndex = -1;
    input.focus();
  });

  document.addEventListener('click', (e) => {
    if (!wrap.contains(e.target as Node)) {
      resultsList.classList.add('hidden');
      selectedIndex = -1;
    }
  });

  container.appendChild(wrap);
  return wrap;
}
