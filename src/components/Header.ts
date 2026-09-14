import type { MapCamera } from '../lib/map-camera.js';
import type { ThemeManager } from '../lib/theme-manager.js';
import type { Beacon } from '../lib/types.js';
import { i18n } from '../lib/i18n.js';

export interface Bookmark {
  name: string;
  label: string;
  sublabelSv: string;
  sublabelEn: string;
  query: string;
}

export const CURATED_BOOKMARKS: Bookmark[] = [
  { name: 'Vinga', label: 'Vinga', sublabelSv: 'Kattegat / Göteborg', sublabelEn: 'Kattegat / Gothenburg', query: 'vinga' },
  { name: 'Landsort', label: 'Landsort', sublabelSv: 'Stockholms skärgård', sublabelEn: 'Stockholm Archipelago', query: 'landsort' },
  { name: 'Kullen', label: 'Kullen', sublabelSv: 'Öresund / Höganäs', sublabelEn: 'The Sound / Höganäs', query: 'kullen' },
  { name: 'Öland', label: 'Långe Jan', sublabelSv: 'Ölands södra', sublabelEn: 'South Öland', query: 'ölands södra' },
  { name: 'Pater Noster', label: 'Pater Noster', sublabelSv: 'Bohuslän / Hamneskär', sublabelEn: 'Bohuslän / Hamneskär', query: 'pater' },
  { name: 'Smygehuk', label: 'Smygehuk', sublabelSv: 'Sveriges sydspets', sublabelEn: "Sweden's southernmost point", query: 'smygehuk' },
  { name: 'Malören', label: 'Malören', sublabelSv: 'Bottenviken / Haparanda', sublabelEn: 'Gulf of Bothnia / Haparanda', query: 'malören' },
  { name: 'Hoburg', label: 'Hoburg', sublabelSv: 'Gotlands sydspets', sublabelEn: 'South Gotland', query: 'hoburg' },
  { name: 'Måseskär', label: 'Måseskär', sublabelSv: 'Orust / Bohuslän', sublabelEn: 'Orust / Bohuslän', query: 'måseskär' },
  { name: 'Almagrundet', label: 'Almagrundet', sublabelSv: 'Kassunfyr / Öppna havet', sublabelEn: 'Caisson light / Open sea', query: 'almagrundet' },
];

export function createHeader(
  container: HTMLElement,
  camera: MapCamera,
  theme: ThemeManager,
  beacons: Beacon[]
): { header: HTMLElement; settingsBtn: HTMLButtonElement; langBtn: HTMLButtonElement } {
  const header = document.createElement('header');
  header.className = 'site-header';

  // Title section
  const titleGroup = document.createElement('div');
  titleGroup.className = 'title-group';

  const kickerEl = document.createElement('div');
  kickerEl.className = 'kicker';
  kickerEl.textContent = i18n.t.kicker;

  const mainTitleEl = document.createElement('h1');
  mainTitleEl.className = 'main-title';
  mainTitleEl.textContent = i18n.t.title;

  titleGroup.appendChild(kickerEl);
  titleGroup.appendChild(mainTitleEl);

  // Bookmarks dropdown / quick select
  const bookmarkNav = document.createElement('nav');
  bookmarkNav.className = 'bookmark-nav';
  bookmarkNav.setAttribute('aria-label', i18n.t.bookmarksAria);

  const bookmarkLabel = document.createElement('span');
  bookmarkLabel.className = 'bookmark-label';
  bookmarkLabel.textContent = i18n.t.bookmarksLabel;
  bookmarkNav.appendChild(bookmarkLabel);

  const bookmarkList = document.createElement('div');
  bookmarkList.className = 'bookmark-list';

  const bookmarkButtons: { btn: HTMLButtonElement; bm: Bookmark }[] = [];

  for (const bm of CURATED_BOOKMARKS) {
    const btn = document.createElement('button');
    btn.className = 'bookmark-btn';
    btn.textContent = bm.label;

    const sub = i18n.lang === 'sv' ? bm.sublabelSv : bm.sublabelEn;
    btn.title = `${bm.label} (${sub})`;

    btn.addEventListener('click', () => {
      const match = beacons.find((b) => (b.name || '').toLowerCase().includes(bm.query.toLowerCase()));
      if (match) {
        camera.flyTo(match.u, match.v, 7.5, 900);
      }
    });

    bookmarkButtons.push({ btn, bm });
    bookmarkList.appendChild(btn);
  }
  bookmarkNav.appendChild(bookmarkList);

  // Actions group (SWE/ENG toggle, settings gear, theme toggle)
  const actionGroup = document.createElement('div');
  actionGroup.className = 'action-group';

  // SWE / ENG language toggle button (same 34x34px size, placed next to gear)
  const langBtn = document.createElement('button');
  langBtn.className = 'icon-action-btn lang-toggle-btn';
  langBtn.textContent = i18n.lang === 'en' ? 'ENG' : 'SWE';
  langBtn.setAttribute('aria-label', i18n.t.langBtnAria);
  langBtn.title = i18n.t.langBtnTitle;

  langBtn.addEventListener('click', () => {
    i18n.toggle();
  });

  // Gear / settings button
  const settingsBtn = document.createElement('button');
  settingsBtn.className = 'icon-action-btn settings-btn';
  settingsBtn.setAttribute('aria-label', i18n.t.settingsBtnAria);
  settingsBtn.setAttribute('aria-expanded', 'false');
  settingsBtn.title = i18n.t.settingsBtnTitle;
  settingsBtn.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>`;

  const themeBtn = document.createElement('button');
  themeBtn.className = 'icon-action-btn theme-toggle-btn';
  themeBtn.setAttribute('aria-label', i18n.t.themeBtnAria);
  themeBtn.title = i18n.t.themeBtnDarkTitle;

  function updateThemeIcon(): void {
    const isDark = theme.mode === 'dark';
    themeBtn.innerHTML = isDark
      ? `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/></svg>`
      : `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/></svg>`;
  }

  themeBtn.addEventListener('click', () => {
    theme.toggle();
    updateThemeIcon();
  });
  updateThemeIcon();
  theme.onThemeChange(() => updateThemeIcon());

  function updateTexts(): void {
    kickerEl.textContent = i18n.t.kicker;
    mainTitleEl.textContent = i18n.t.title;
    bookmarkLabel.textContent = i18n.t.bookmarksLabel;
    bookmarkNav.setAttribute('aria-label', i18n.t.bookmarksAria);

    for (const { btn, bm } of bookmarkButtons) {
      const sub = i18n.lang === 'sv' ? bm.sublabelSv : bm.sublabelEn;
      btn.title = `${bm.label} (${sub})`;
    }

    langBtn.textContent = i18n.lang === 'en' ? 'ENG' : 'SWE';
    langBtn.setAttribute('aria-label', i18n.t.langBtnAria);
    langBtn.title = i18n.t.langBtnTitle;

    settingsBtn.setAttribute('aria-label', i18n.t.settingsBtnAria);
    settingsBtn.title = i18n.t.settingsBtnTitle;

    themeBtn.setAttribute('aria-label', i18n.t.themeBtnAria);
    themeBtn.title = i18n.t.themeBtnDarkTitle;
  }

  i18n.onChange(updateTexts);

  actionGroup.appendChild(langBtn);
  actionGroup.appendChild(settingsBtn);
  actionGroup.appendChild(themeBtn);

  header.appendChild(titleGroup);
  header.appendChild(bookmarkNav);
  header.appendChild(actionGroup);
  container.appendChild(header);

  return { header, settingsBtn, langBtn };
}
