import type { LighthouseProbe, ProbeState } from '../lib/lighthouse-probe.js';
import { createSectorRose } from './SectorRose.js';
import { i18n } from '../lib/i18n.js';

const ICON_CLOSE = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12"/></svg>`;

export function createInspector(
  container: HTMLElement,
  probe: LighthouseProbe,
  onSoloToggle?: (beaconId: string | null) => void,
  getSoloBeaconId?: () => string | null
): HTMLElement {
  const card = document.createElement('aside');
  card.className = 'nautical-inspector-card hidden';
  card.setAttribute('aria-label', i18n.t.inspectorAria);

  let currentBeaconId: string | null = null;

  function updateSoloBtn(btn: HTMLButtonElement, isSolo: boolean): void {
    btn.classList.toggle('active', isSolo);
    btn.setAttribute('aria-pressed', isSolo ? 'true' : 'false');
    btn.title = isSolo ? i18n.t.isolateBeamActiveTitle : i18n.t.isolateBeamTitle;
    btn.innerHTML = isSolo
      ? `${ICON_CLOSE}<span>${i18n.t.showAllBeams}</span>`
      : `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="3"/><path d="M12 2v3m0 14v3M2 12h3m14 0h3"/></svg><span>${i18n.t.isolateBeam}</span>`;
  }

  function renderCard(state: ProbeState): void {
    const beacon = state.selected || state.hovered;

    if (!beacon) {
      currentBeaconId = null;
      card.classList.add('hidden');
      return;
    }

    card.classList.remove('hidden');

    // Re-render HTML content only if beacon identity changed
    if (beacon.id !== currentBeaconId) {
      currentBeaconId = beacon.id;

      const f = beacon.facts;
      // Derive a single accurate label from optic_type (the ground truth from OSM/IALA data).
      // tier is a rough bucketing used for filtering; optic_type is the actual optical classification.
      const opticLabel =
        f.optic_type === 'havsfyr'
          ? i18n.t.opticCoastal
          : f.optic_type === 'sektorfyr'
            ? i18n.t.opticSector
            : f.optic_type === 'ensfyr'
              ? i18n.t.opticLeading
              : i18n.t.opticMinor;
      const opticSub =
        f.optic_type === 'havsfyr'
          ? i18n.t.opticCoastalSub
          : f.optic_type === 'sektorfyr'
            ? i18n.t.opticSectorSub
            : f.optic_type === 'ensfyr'
              ? i18n.t.opticLeadingSub
              : i18n.t.opticMinorSub;

      card.innerHTML = `
        <div class="inspector-header">
          <div class="inspector-title-wrap">
            <h2 class="inspector-title">${f.name}</h2>
            <div class="inspector-coords">${f.lat.toFixed(4)}°N, ${f.lon.toFixed(4)}°E</div>
          </div>
          <button class="inspector-close-btn" type="button" aria-label="${i18n.t.closeCardAria}">${ICON_CLOSE}</button>
        </div>

        <div class="inspector-badge-row">
          <p class="optic-badge">
            <span class="optic-label">${opticLabel}</span>
            <span class="optic-sub">${opticSub}</span>
          </p>
          ${
            onSoloToggle
              ? `<button class="inspector-solo-btn" type="button" aria-label="${i18n.t.isolateBeamTitle}"></button>`
              : ''
          }
        </div>

        <dl class="inspector-metrics-grid">
          <div class="metric-cell">
            <dt class="metric-label">${i18n.t.metricCharacter}</dt>
            <dd class="metric-value metric-character">${f.character}</dd>
          </div>
          <div class="metric-cell">
            <dt class="metric-label">${i18n.t.metricRange}</dt>
            <dd class="metric-value">${f.range_nm} M</dd>
          </div>
          <div class="metric-cell">
            <dt class="metric-label">${i18n.t.metricHeight}</dt>
            <dd class="metric-value">${Math.round(f.height_m)} m</dd>
          </div>
          <div class="metric-cell">
            <dt class="metric-label">${i18n.t.metricPeriod}</dt>
            <dd class="metric-value">${f.period_s} s</dd>
          </div>
        </dl>

        <section class="inspector-sectors-section">
          <h3 class="sectors-title">${i18n.t.sectorsTitle}</h3>
          <div class="inspector-rose-mount"></div>
        </section>

        ${f.ref ? `<p class="inspector-ref-footer">${i18n.t.admiraltyNo} ${f.ref}</p>` : ''}
      `;

      // Mount SectorRose component
      const roseMount = card.querySelector('.inspector-rose-mount');
      if (roseMount) {
        roseMount.appendChild(createSectorRose(f.sectors));
      }

      const closeBtn = card.querySelector('.inspector-close-btn');
      closeBtn?.addEventListener('click', (e) => {
        e.stopPropagation();
        probe.clearSelection();
      });

      // Solo button listener
      const soloBtn = card.querySelector('.inspector-solo-btn') as HTMLButtonElement | null;
      if (soloBtn && onSoloToggle && getSoloBeaconId) {
        const isCurrentlySolo = getSoloBeaconId() === beacon.id;
        updateSoloBtn(soloBtn, isCurrentlySolo);
        soloBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          const isSolo = getSoloBeaconId() === beacon.id;
          const nextSoloId = isSolo ? null : beacon.id;
          onSoloToggle(nextSoloId);
          updateSoloBtn(soloBtn, !isSolo);
        });
      }
    }

    // Keep solo button UI in sync with global state if externally changed
    const soloBtn = card.querySelector('.inspector-solo-btn') as HTMLButtonElement | null;
    if (soloBtn && getSoloBeaconId) {
      updateSoloBtn(soloBtn, getSoloBeaconId() === beacon.id);
    }

  }

  probe.subscribe(renderCard);

  i18n.onChange(() => {
    card.setAttribute('aria-label', i18n.t.inspectorAria);
    if (currentBeaconId) {
      currentBeaconId = null;
      renderCard(probe.state);
    }
  });

  container.appendChild(card);

  return card;
}
