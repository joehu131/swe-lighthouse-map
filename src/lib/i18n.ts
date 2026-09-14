export type Language = 'en' | 'sv';

export const LANG_STORAGE_KEY = 'swe_fyrar_lang_v1';

export const DICTIONARY = {
  sv: {
    kicker: 'Svenskt Farvatten',
    title: 'Svenska Fyrar',
    bookmarksLabel: 'Fyrplatser:',
    bookmarksAria: 'Kända fyrplatser',
    settingsBtnTitle: 'Inställningar',
    settingsBtnAria: 'Inställningar',
    themeBtnDarkTitle: 'Växla nattläge (Night Relief) / dagläge (Sjökort)',
    themeBtnAria: 'Växla natt- och dagläge',
    langBtnTitle: 'Byt till engelska (ENG)',
    langBtnAria: 'Växla språk mellan svenska och engelska',
    loadingTitle: 'Läser in sjökort och fyrar...',

    searchPlaceholder: 'Sök fyr (t.ex. Vinga, Kullen, Långe Jan)...',
    searchAria: 'Sök fyr',
    searchClearAria: 'Rensa sökning',
    searchEmpty: 'Inga fyrar matchade sökningen',

    playPauseAria: 'Pausa/Spela',
    pauseTitle: 'Pausa animation',
    resumeTitle: 'Återuppta animation',
    speedAria: (s: string) => `Hastighet ${s}`,
    tierAria: 'Filtrera fyrkategori',
    tierAll: 'Alla',
    tierMajor: 'Kustfyrar',
    tierSector: 'Ledfyrar',
    tierMinor: 'Hamnfyrar',
    zoomInTitle: 'Zooma in',
    zoomOutTitle: 'Zooma ut',
    resetViewTitle: 'Återställ vy till hela Sverige',
    resetViewText: 'Hela Sverige',
    soloActiveText: (name: string) => `Endast ${name}`,
    soloActiveTitle: 'Klicka för att visa alla fyrars sken igen',

    settingsTitle: 'Inställningar',
    settingsResetBtn: 'Återställ',
    settingsResetTitle: 'Återställ till standardvärden',
    warmthLabel: 'Färgvärme',
    brightnessLabel: 'Ljusstyrka',
    reachLabel: 'Skenvidd',
    bgLightLabel: 'Bakgrundsljus',

    inspectorAria: 'Fyrdetaljer',
    closeCardAria: 'Stäng popup',
    isolateBeam: 'Isolera sken',
    showAllBeams: 'Visa alla',
    isolateBeamTitle: 'Visa endast denna fyrs sken på kartan',
    isolateBeamActiveTitle: 'Visa alla fyrars sken igen',
    opticCoastal: 'Kustfyr',
    opticCoastalSub: 'Roterande ljuskägla',
    opticSector: 'Ledfyr',
    opticSectorSub: 'Navigationssektorer',
    opticLeading: 'Ensfyr',
    opticLeadingSub: 'Riktad enslinje',
    opticMinor: 'Hamnfyr',
    opticMinorSub: 'Positions- och ledfyr',
    metricCharacter: 'Fyrkaraktär',
    metricRange: 'Lysvidd',
    metricHeight: 'Lyshöjd (MSL)',
    metricPeriod: 'Period',
    sectorsTitle: 'Fyrsektordiagram',
    sectorsCount: (n: number) => `${n} sektorer`,
    showTable: (n: number) => `Visa alla ${n} sektorer som tabell`,
    hideTable: 'Dölj sektortabell',
    admiraltyNo: 'Admiralty / Fyrlista nr:',
    compassNorth: 'N',
    compassEast: 'O',
    compassSouth: 'S',
    compassWest: 'V',
    colorRed: 'Röd',
    colorGreen: 'Grön',
    colorAmber: 'Gul',
    colorWhite: 'Vit',
    noSectorData: 'Inga sektordata tillgängliga (rundstrålande)',

    webgpuErrorTitle: 'WebGPU krävs',
    webgpuErrorBody: 'WebGPU stöds inte av den här webbläsaren.',
    webgpuErrorHint: 'Prova med en av dessa webbläsare:',
    webgpuErrorDetail: 'Teknisk detalj:',
  },
  en: {
    kicker: 'Swedish Waters',
    title: 'Swedish Lighthouses',
    bookmarksLabel: 'Lighthouses:',
    bookmarksAria: 'Notable lighthouses',
    settingsBtnTitle: 'Settings',
    settingsBtnAria: 'Settings',
    themeBtnDarkTitle: 'Toggle night mode (Night Relief) / day mode (Nautical Chart)',
    themeBtnAria: 'Toggle night and day mode',
    langBtnTitle: 'Switch language to Swedish (SWE)',
    langBtnAria: 'Toggle language between Swedish and English',
    loadingTitle: 'Loading nautical chart & lights...',

    searchPlaceholder: 'Search lighthouse (e.g. Vinga, Kullen, Långe Jan)...',
    searchAria: 'Search lighthouse',
    searchClearAria: 'Clear search',
    searchEmpty: 'No lighthouses matched the search',

    playPauseAria: 'Pause/Play',
    pauseTitle: 'Pause animation',
    resumeTitle: 'Resume animation',
    speedAria: (s: string) => `Speed ${s}`,
    tierAria: 'Filter lighthouse category',
    tierAll: 'All',
    tierMajor: 'Coastal Lights',
    tierSector: 'Sector Lights',
    tierMinor: 'Harbour Lights',
    zoomInTitle: 'Zoom in',
    zoomOutTitle: 'Zoom out',
    resetViewTitle: 'Reset view to all Sweden',
    resetViewText: 'All Sweden',
    soloActiveText: (name: string) => `Only ${name}`,
    soloActiveTitle: 'Click to show all lighthouse beams again',

    settingsTitle: 'Settings',
    settingsResetBtn: 'Reset',
    settingsResetTitle: 'Reset to default values',
    warmthLabel: 'Color Warmth',
    brightnessLabel: 'Brightness',
    reachLabel: 'Beam Reach',
    bgLightLabel: 'Background Light',

    inspectorAria: 'Lighthouse details',
    closeCardAria: 'Close popup',
    isolateBeam: 'Isolate beam',
    showAllBeams: 'Show all',
    isolateBeamTitle: 'Show only this lighthouse beam on map',
    isolateBeamActiveTitle: 'Show all lighthouse beams again',
    opticCoastal: 'Coastal Light',
    opticCoastalSub: 'Rotating beam',
    opticSector: 'Sector Light',
    opticSectorSub: 'Navigation sectors',
    opticLeading: 'Leading Light',
    opticLeadingSub: 'Directional lead line',
    opticMinor: 'Harbour Light',
    opticMinorSub: 'Position & harbour light',
    metricCharacter: 'Light Character',
    metricRange: 'Range',
    metricHeight: 'Height (MSL)',
    metricPeriod: 'Period',
    sectorsTitle: 'Sector Diagram',
    sectorsCount: (n: number) => `${n} sectors`,
    showTable: (n: number) => `Show all ${n} sectors as table`,
    hideTable: 'Hide sector table',
    admiraltyNo: 'Admiralty / Light list no:',
    compassNorth: 'N',
    compassEast: 'E',
    compassSouth: 'S',
    compassWest: 'W',
    colorRed: 'Red',
    colorGreen: 'Green',
    colorAmber: 'Amber',
    colorWhite: 'White',
    noSectorData: 'No sector data available (all-round light)',

    webgpuErrorTitle: 'WebGPU Required',
    webgpuErrorBody: 'WebGPU is not supported by this browser.',
    webgpuErrorHint: 'Please try one of these browsers:',
    webgpuErrorDetail: 'Technical detail:',
  },
} as const;

export type TranslationDictionary = typeof DICTIONARY['en'];

class I18nManager {
  private currentLang: Language;
  private listeners: Array<(lang: Language) => void> = [];

  constructor() {
    let saved: string | null = null;
    try {
      saved = localStorage.getItem(LANG_STORAGE_KEY);
    } catch {
      // Ignored
    }
    // English is standard / default as requested
    this.currentLang = saved === 'sv' ? 'sv' : 'en';
    if (typeof document !== 'undefined') {
      document.documentElement.lang = this.currentLang;
    }
  }

  get lang(): Language {
    return this.currentLang;
  }

  get t() {
    return DICTIONARY[this.currentLang];
  }

  toggle(): Language {
    this.setLanguage(this.currentLang === 'en' ? 'sv' : 'en');
    return this.currentLang;
  }

  setLanguage(lang: Language): void {
    if (this.currentLang === lang) return;
    this.currentLang = lang;
    try {
      localStorage.setItem(LANG_STORAGE_KEY, lang);
    } catch {
      // Ignored
    }
    if (typeof document !== 'undefined') {
      document.documentElement.lang = lang;
    }
    const callbacks = [...this.listeners];
    for (const cb of callbacks) {
      try {
        cb(lang);
      } catch (err) {
        console.error('[i18n] Error during listener update:', err);
      }
    }
  }

  onChange(cb: (lang: Language) => void): () => void {
    this.listeners.push(cb);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== cb);
    };
  }
}

export const i18n = new I18nManager();
