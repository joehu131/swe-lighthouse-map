import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('Swedish Lighthouse Manifest Data Integrity', () => {
  const manifestPath = path.join(__dirname, '..', 'public', 'data', 'manifest.json');
  expect(fs.existsSync(manifestPath)).toBe(true);

  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

  it('contains valid root metadata', () => {
    expect(manifest.subject).toBe('sweden');
    expect(manifest.label).toContain('Sverige');
    expect(manifest.plate).toEqual([4096, 6144]);
    expect(manifest.aspect_h).toBeCloseTo(1.5, 2);
    expect(manifest.n_beacons).toBeGreaterThan(1500);
    expect(manifest.beacons.length).toBe(manifest.n_beacons);
    expect(manifest.sectors.length).toBeGreaterThan(3000);
  });

  it('guarantees all beacons are within Swedish territorial bounds', () => {
    for (const b of manifest.beacons) {
      expect(b.u).toBeGreaterThanOrEqual(0.0);
      expect(b.u).toBeLessThanOrEqual(1.0);
      expect(b.v).toBeGreaterThanOrEqual(0.0);
      expect(b.v).toBeLessThanOrEqual(1.0);

      expect(b.facts.lat).toBeGreaterThanOrEqual(55.0);
      expect(b.facts.lat).toBeLessThanOrEqual(69.5);
      expect(b.facts.lon).toBeGreaterThanOrEqual(10.5);
      expect(b.facts.lon).toBeLessThanOrEqual(24.5);
    }
  });

  it('guarantees light periods, ranges, and focal heights are physically positive', () => {
    for (const b of manifest.beacons) {
      expect(b.period).toBeGreaterThan(0.0);
      expect(b.reach).toBeGreaterThan(0.0);
      expect(b.height_m).toBeGreaterThan(0.0);
      expect(b.range_nm).toBeGreaterThan(0.0);
    }
  });

  it('guarantees every beacon has a valid maritime tier classification', () => {
    const counts: Record<string, number> = { major: 0, sector: 0, minor: 0 };
    for (const b of manifest.beacons) {
      expect(['major', 'sector', 'minor']).toContain(b.tier);
      expect(b.facts.tier).toBe(b.tier);
      counts[b.tier]++;
    }
    expect(counts.major).toBeGreaterThan(100);
    expect(counts.sector).toBeGreaterThan(500);
    expect(counts.minor).toBeGreaterThan(500);
  });

  it('guarantees all sector angles are valid in [0, 360) and correctly packed', () => {
    for (const sec of manifest.sectors) {
      const [startDeg, endDeg, colorCode] = sec;
      expect(startDeg).toBeGreaterThanOrEqual(0.0);
      expect(startDeg).toBeLessThanOrEqual(360.0);
      expect(endDeg).toBeGreaterThanOrEqual(0.0);
      expect(endDeg).toBeLessThanOrEqual(360.0);
      expect([0, 1, 2, 3]).toContain(colorCode);
    }

    // Verify offset continuity
    for (const b of manifest.beacons) {
      expect(b.sec_offset + b.nsec).toBeLessThanOrEqual(manifest.sectors.length);
    }
  });

  it('includes iconic Swedish historic coastal lights', () => {
    const names = manifest.beacons.map((b: { name: string }) => (b.name || '').toLowerCase());

    const requiredLights = [
      'vinga',
      'landsort',
      'kullen',
      'öland',
      'pater',
      'smygehuk',
      'malören',
      'hoburg',
      'måseskär',
      'understen',
      'almagrundet',
      'eggegrund',
    ];

    for (const req of requiredLights) {
      const found = names.some((n: string) => n.includes(req));
      expect(found, `Iconic light '${req}' must exist in manifest`).toBe(true);
    }
  });
});
