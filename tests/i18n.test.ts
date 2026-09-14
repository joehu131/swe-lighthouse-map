import { describe, it, expect } from 'vitest';
import { DICTIONARY, i18n, LANG_STORAGE_KEY } from '../src/lib/i18n.ts';

describe('i18n dictionary and manager', () => {
  it('defines the expected storage key', () => {
    expect(LANG_STORAGE_KEY).toBe('swe_fyrar_lang_v1');
  });

  it('guarantees key parity between Swedish and English dictionaries', () => {
    const svKeys = Object.keys(DICTIONARY.sv).sort();
    const enKeys = Object.keys(DICTIONARY.en).sort();

    expect(svKeys).toEqual(enKeys);
    expect(svKeys.length).toBeGreaterThan(30);

    for (const key of svKeys) {
      const svVal = (DICTIONARY.sv as Record<string, unknown>)[key];
      const enVal = (DICTIONARY.en as Record<string, unknown>)[key];

      expect(svVal).toBeDefined();
      expect(enVal).toBeDefined();
      expect(typeof svVal).toBe(typeof enVal);
    }
  });

  it('evaluates string interpolation functions accurately without placeholders', () => {
    expect(DICTIONARY.sv.soloActiveText('Vinga')).toBe('Endast Vinga');
    expect(DICTIONARY.en.soloActiveText('Vinga')).toBe('Only Vinga');

    expect(DICTIONARY.sv.sectorsCount(5)).toBe('5 sektorer');
    expect(DICTIONARY.en.sectorsCount(5)).toBe('5 sectors');

    expect(DICTIONARY.sv.showTable(3)).toBe('Visa alla 3 sektorer som tabell');
    expect(DICTIONARY.en.showTable(3)).toBe('Show all 3 sectors as table');

    expect(DICTIONARY.sv.speedAria('1.0x')).toBe('Hastighet 1.0x');
    expect(DICTIONARY.en.speedAria('1.0x')).toBe('Speed 1.0x');
  });

  it('defaults to English as the standard language', () => {
    // If not overridden, current language should default to 'en'
    expect(['en', 'sv']).toContain(i18n.lang);
    i18n.setLanguage('en');
    expect(i18n.lang).toBe('en');
    expect(i18n.t.title).toBe('Swedish Lighthouses');
    expect(i18n.t.tierMajor).toBe('Coastal Lights');
  });

  it('toggles cleanly between English and Swedish and notifies subscribers', () => {
    i18n.setLanguage('en');
    expect(i18n.lang).toBe('en');

    let notifiedLang = '';
    const unsubscribe = i18n.onChange((lang) => {
      notifiedLang = lang;
    });

    const nextLang = i18n.toggle();
    expect(nextLang).toBe('sv');
    expect(i18n.lang).toBe('sv');
    expect(notifiedLang).toBe('sv');
    expect(i18n.t.title).toBe('Svenska Fyrar');
    expect(i18n.t.tierMajor).toBe('Kustfyrar');

    i18n.toggle();
    expect(i18n.lang).toBe('en');
    expect(notifiedLang).toBe('en');

    unsubscribe();
  });
});
