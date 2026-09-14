import { describe, it, expect } from 'vitest';
import {
  invertBearing,
  isAngleInSector,
  normalizeAngle,
  parseSeamarkTags,
  MARITIME_COLORS,
} from '../pipeline/parse_iala.js';

describe('IALA Parser & Sector Geometry', () => {
  it('correctly inverts seaward bearings by 180 degrees', () => {
    expect(invertBearing(0)).toBe(180);
    expect(invertBearing(90)).toBe(270);
    expect(invertBearing(180)).toBe(0);
    expect(invertBearing(270)).toBe(90);
    expect(invertBearing(350)).toBe(170);
  });

  it('correctly normalizes angles to [0, 360)', () => {
    expect(normalizeAngle(360)).toBe(0);
    expect(normalizeAngle(-90)).toBe(270);
    expect(normalizeAngle(725)).toBe(5);
  });

  it('handles sectors that cross the 0°/360° north meridian', () => {
    // Sector spanning 340° to 20° (across North)
    expect(isAngleInSector(350, 340, 20)).toBe(true);
    expect(isAngleInSector(0, 340, 20)).toBe(true);
    expect(isAngleInSector(10, 340, 20)).toBe(true);
    expect(isAngleInSector(180, 340, 20)).toBe(false);
    expect(isAngleInSector(300, 340, 20)).toBe(false);
  });

  it('handles normal sectors contained within a quadrant', () => {
    // Sector from 90° to 180°
    expect(isAngleInSector(120, 90, 180)).toBe(true);
    expect(isAngleInSector(80, 90, 180)).toBe(false);
    expect(isAngleInSector(200, 90, 180)).toBe(false);
  });

  it('parses Swedish sector light tags and identifies sektorfyr', () => {
    const rawTags = {
      'name': 'Eggegrunds fyr',
      'seamark:light:1:character': 'Fl',
      'seamark:light:1:group': '4',
      'seamark:light:1:period': '12',
      'seamark:light:1:colour': 'red',
      'seamark:light:1:sector_start': '150',
      'seamark:light:1:sector_end': '204',
      'seamark:light:2:character': 'Fl',
      'seamark:light:2:group': '4',
      'seamark:light:2:period': '12',
      'seamark:light:2:colour': 'white',
      'seamark:light:2:sector_start': '204',
      'seamark:light:2:sector_end': '150',
      'seamark:light:reference': 'C 6172',
      'height': '26',
    };

    const parsed = parseSeamarkTags(rawTags, '12345');
    expect(parsed.name).toBe('Eggegrunds fyr');
    expect(parsed.optic_type).toBe('sektorfyr');
    expect(parsed.rotates).toBe(false); // Sektorfyrar pulse in place, don't sweep
    expect(parsed.period_s).toBe(12);
    expect(parsed.character).toBe('Fl(4) WR 12s');
    expect(parsed.sectors.length).toBe(2);

    // Verify 180° inversion on sectors
    // Seaward: 150° -> Beam: 330°
    expect(parsed.sectors[0].start_deg).toBe(330);
    // Seaward: 204° -> Beam: 24°
    expect(parsed.sectors[0].end_deg).toBe(24);
    expect(parsed.sectors[0].colour).toBe('red');
    expect(parsed.sectors[0].rgb).toEqual(MARITIME_COLORS.red);
  });

  it('identifies havsfyr for single all-round white light', () => {
    const rawTags = {
      'name': 'Vinga fyr',
      'seamark:light:character': 'Fl',
      'seamark:light:group': '2',
      'seamark:light:period': '30',
      'seamark:light:colour': 'white',
      'seamark:light:range': '12',
      'seamark:light:height': '46',
    };

    const parsed = parseSeamarkTags(rawTags, '999');
    expect(parsed.name).toBe('Vinga fyr');
    expect(parsed.optic_type).toBe('havsfyr');
    expect(parsed.rotates).toBe(true); // Havsfyr sweeps 360°
    expect(parsed.character).toBe('Fl(2) W 30s');
    expect(parsed.sectors.length).toBe(1);
    expect(parsed.sectors[0].start_deg).toBe(0);
    expect(parsed.sectors[0].end_deg).toBe(360);
  });

  it('identifies ensfyr for leading light with narrow angle', () => {
    const rawTags = {
      'name': 'Styrsö Nedre Ensfyr',
      'seamark:type': 'leading_light',
      'seamark:light:character': 'Q',
      'seamark:light:period': '1',
      'seamark:light:colour': 'yellow',
    };

    const parsed = parseSeamarkTags(rawTags, '555');
    expect(parsed.optic_type).toBe('ensfyr');
    expect(parsed.rotates).toBe(false);
  });
});
