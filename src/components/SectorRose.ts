import type { BeaconSector } from '../lib/types.js';
import { i18n } from '../lib/i18n.js';

export function createSectorRose(sectors: BeaconSector[]): HTMLElement {
  const container = document.createElement('div');
  container.className = 'sector-rose-container';

  if (!sectors || sectors.length === 0) {
    container.innerHTML = `<div class="sector-rose-empty">${i18n.t.noSectorData}</div>`;
    return container;
  }

  const cx = 80;
  const cy = 80;
  const radius = 62;

  // Polar to Cartesian (0° = North, clockwise)
  function polarToCartesian(deg: number, r: number): [number, number] {
    const rad = ((deg - 90) * Math.PI) / 180.0;
    return [cx + r * Math.cos(rad), cy + r * Math.sin(rad)];
  }

  function getSectorColor(colour: string): { fill: string; stroke: string; label: string } {
    const c = (colour || '').toLowerCase();
    if (c === 'red' || c === 'r') {
      return { fill: 'rgba(239, 68, 68, 0.75)', stroke: '#ef4444', label: i18n.t.colorRed };
    }
    if (c === 'green' || c === 'g') {
      return { fill: 'rgba(16, 185, 129, 0.75)', stroke: '#10b981', label: i18n.t.colorGreen };
    }
    if (c === 'amber' || c === 'yellow' || c === 'y') {
      return { fill: 'rgba(245, 158, 11, 0.8)', stroke: '#f59e0b', label: i18n.t.colorAmber };
    }
    return { fill: 'rgba(254, 240, 138, 0.85)', stroke: '#fef08a', label: i18n.t.colorWhite };
  }

  // Generate SVG path for each sector wedge
  const wedgesSvg = sectors
    .map((sec, idx) => {
      let span = (sec.end_deg - sec.start_deg + 360.0) % 360.0;
      if (span === 0 && sec.start_deg !== sec.end_deg) {
        span = 360.0;
      }

      const colors = getSectorColor(sec.colour);

      if (span >= 359.5 || (sectors.length === 1 && span === 0)) {
        // Full circle
        return `
          <circle
            cx="${cx}" cy="${cy}" r="${radius}"
            fill="${colors.fill}"
            stroke="${colors.stroke}"
            stroke-width="1.5"
            class="sector-wedge"
            data-index="${idx}"
            data-start="${sec.start_deg.toFixed(1)}"
            data-end="${sec.end_deg.toFixed(1)}"
            data-color="${colors.label}"
          />
        `;
      }

      const [x1, y1] = polarToCartesian(sec.start_deg, radius);
      const [x2, y2] = polarToCartesian(sec.end_deg, radius);
      const largeArcFlag = span > 180 ? 1 : 0;

      const pathData = `M ${cx} ${cy} L ${x1.toFixed(2)} ${y1.toFixed(2)} A ${radius} ${radius} 0 ${largeArcFlag} 1 ${x2.toFixed(2)} ${y2.toFixed(2)} Z`;

      return `
        <path
          d="${pathData}"
          fill="${colors.fill}"
          stroke="${colors.stroke}"
          stroke-width="1"
          stroke-linejoin="round"
          class="sector-wedge"
          data-index="${idx}"
          data-start="${sec.start_deg.toFixed(1)}"
          data-end="${sec.end_deg.toFixed(1)}"
          data-span="${span.toFixed(1)}"
          data-color="${colors.label}"
          style="cursor: pointer; transition: opacity 0.15s, fill 0.15s;"
        />
      `;
    })
    .join('');

  // Cardinal compass marks (N, E/O, S, W/V)
  const cardinals = [
    { label: i18n.t.compassNorth, deg: 0, x: cx, y: cy - radius - 6 },
    { label: i18n.t.compassEast, deg: 90, x: cx + radius + 7, y: cy + 4 },
    { label: i18n.t.compassSouth, deg: 180, x: cx, y: cy + radius + 11 },
    { label: i18n.t.compassWest, deg: 270, x: cx - radius - 7, y: cy + 4 },
  ];

  const cardinalsSvg = cardinals
    .map(
      (c) =>
        `<text x="${c.x}" y="${c.y}" text-anchor="middle" class="compass-cardinal">${c.label}</text>`
    )
    .join('');

  // Compass tick lines at 30 degree intervals
  let ticksSvg = '';
  for (let d = 0; d < 360; d += 30) {
    const isMajor = d % 90 === 0;
    const r1 = radius + 1;
    const r2 = radius + (isMajor ? 4 : 2);
    const [tx1, ty1] = polarToCartesian(d, r1);
    const [tx2, ty2] = polarToCartesian(d, r2);
    ticksSvg += `<line x1="${tx1.toFixed(1)}" y1="${ty1.toFixed(1)}" x2="${tx2.toFixed(1)}" y2="${ty2.toFixed(1)}" stroke="currentColor" stroke-width="${isMajor ? 1.5 : 0.75}" opacity="${isMajor ? 0.6 : 0.3}"/>`;
  }

  container.innerHTML = `
    <div class="sector-rose-wrap">
      <svg class="sector-rose-svg" viewBox="0 0 160 160" width="160" height="160">
        <defs>
          <radialGradient id="compass-bg" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stop-color="rgba(15, 23, 42, 0.95)"/>
            <stop offset="100%" stop-color="rgba(8, 14, 26, 0.98)"/>
          </radialGradient>
        </defs>
        <!-- Background Compass Dial -->
        <circle cx="${cx}" cy="${cy}" r="${radius + 10}" fill="url(#compass-bg)" stroke="rgba(255, 255, 255, 0.12)" stroke-width="1"/>
        <circle cx="${cx}" cy="${cy}" r="${radius}" fill="none" stroke="rgba(255, 255, 255, 0.18)" stroke-width="1"/>
        ${ticksSvg}
        ${cardinalsSvg}

        <!-- Sector Wedges -->
        <g class="sector-wedges-group">
          ${wedgesSvg}
        </g>

        <!-- Center Lamp Position -->
        <circle cx="${cx}" cy="${cy}" r="5" fill="#ffffff" stroke="#0b111e" stroke-width="2"/>
        <circle cx="${cx}" cy="${cy}" r="2" fill="#f59e0b"/>
      </svg>

      <div class="sector-rose-legend">
        <span class="legend-hint">${i18n.t.sectorsCount(sectors.length)}</span>
      </div>
    </div>

    <!-- Collapsible Raw Table for precision enthusiasts -->
    <details class="sector-table-details">
      <summary class="sector-table-summary">${i18n.t.showTable(sectors.length)}</summary>
      <div class="sector-table-content">
        ${sectors
          .map((s) => {
            const colInfo = getSectorColor(s.colour);
            return `
              <div class="sector-table-row">
                <span class="sector-swatch swatch-${s.colour}"></span>
                <span class="sector-degrees font-mono">${s.start_deg.toFixed(1)}° – ${s.end_deg.toFixed(1)}°</span>
                <span class="sector-color-name">${colInfo.label}</span>
              </div>
            `;
          })
          .join('')}
      </div>
    </details>
  `;

  // Attach hover interaction to update legend
  const legendHint = container.querySelector('.legend-hint');
  const wedges = container.querySelectorAll('.sector-wedge');

  wedges.forEach((wedge) => {
    wedge.addEventListener('pointerenter', () => {
      const start = wedge.getAttribute('data-start');
      const end = wedge.getAttribute('data-end');
      const span = wedge.getAttribute('data-span');
      const color = wedge.getAttribute('data-color');
      if (legendHint) {
        legendHint.innerHTML = `<strong style="color: var(--text-main);">${color}</strong>: ${start}° – ${end}° ${span ? `(${span}°)` : ''}`;
      }
      (wedge as SVGElement).style.filter = 'brightness(1.25) drop-shadow(0 0 4px rgba(255,255,255,0.35))';
    });

    wedge.addEventListener('pointerleave', () => {
      if (legendHint) {
        legendHint.innerHTML = i18n.t.sectorsCount(sectors.length);
      }
      (wedge as SVGElement).style.filter = 'none';
    });
  });

  const detailsEl = container.querySelector('.sector-table-details') as HTMLDetailsElement | null;
  const summaryEl = container.querySelector('.sector-table-summary') as HTMLElement | null;
  if (detailsEl && summaryEl) {
    detailsEl.addEventListener('toggle', () => {
      summaryEl.textContent = detailsEl.open
        ? i18n.t.hideTable
        : i18n.t.showTable(sectors.length);
    });
  }

  return container;
}
