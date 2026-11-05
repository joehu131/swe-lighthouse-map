import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { SECTOR_STRIDE_FLOATS } from '../src/lib/sector-blend.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('WGSL Shader Syntax & Struct Alignment', () => {
  const shadersDir = path.join(__dirname, '..', 'src', 'shaders');

  const requiredShaders = [
    'beam_common.wgsl',
    'mipmap.wgsl',
    'beam_sector_sdf.wgsl',
    'beam_web.wgsl',
  ];

  it('verifies all essential WGSL shader files exist', () => {
    for (const file of requiredShaders) {
      const fullPath = path.join(shadersDir, file);
      expect(fs.existsSync(fullPath), `Shader ${file} must exist`).toBe(true);
      const content = fs.readFileSync(fullPath, 'utf8');
      expect(content.length).toBeGreaterThan(50);
    }
  });

  it('validates GlobalUniforms byte alignment in beam_common and renderers', () => {
    const commonPath = path.join(shadersDir, 'beam_common.wgsl');
    const commonCode = fs.readFileSync(commonPath, 'utf8');

    // GlobalUniforms must have 8 vec4<f32> members = 8 * 16 = 128 bytes (multiple of 16)
    expect(commonCode).toContain('struct GlobalUniforms');
    expect(commonCode).toContain('camera_pos: vec4<f32>');
    expect(commonCode).toContain('camera_params: vec4<f32>');
    expect(commonCode).toContain('render_knobs: vec4<f32>');
    expect(commonCode).toContain('theme_knobs: vec4<f32>');
    expect(commonCode).toContain('sea_night: vec4<f32>');
    expect(commonCode).toContain('land_night: vec4<f32>');
    expect(commonCode).toContain('sea_day: vec4<f32>');
    expect(commonCode).toContain('land_day: vec4<f32>');
  });

  it('validates SectorData layout in beam_sector_sdf.wgsl matches the CPU buffer', () => {
    const sdfPath = path.join(shadersDir, 'beam_sector_sdf.wgsl');
    const sdfCode = fs.readFileSync(sdfPath, 'utf8');

    expect(sdfCode).toContain('struct SectorData');
    const body = sdfCode.split('struct SectorData {')[1].split('};')[0];
    const fields = body
      .split('\n')
      .map((line) => line.replace(/\/\/.*$/, '').trim())
      .filter((line) => line.length > 0);

    // 8 x f32 = 32 bytes per sector, written in this order by buildSectorBuffer()
    expect(fields).toEqual([
      'start_deg: f32,',
      'end_deg: f32,',
      'color_code: f32,',
      'pad: f32,',
      'blend_start_deg: f32,',
      'blend_end_deg: f32,',
      'pad2: f32,',
      'pad3: f32,',
    ]);
    expect(SECTOR_STRIDE_FLOATS).toBe(fields.length);
  });

  it('verifies standard vertex and fragment entry points', () => {
    const mipmapCode = fs.readFileSync(path.join(shadersDir, 'mipmap.wgsl'), 'utf8');
    expect(mipmapCode).toContain('@vertex\nfn vs_main');
    expect(mipmapCode).toContain('@fragment\nfn fs_main');

    const sectorCode = fs.readFileSync(path.join(shadersDir, 'beam_sector_sdf.wgsl'), 'utf8');
    expect(sectorCode).toContain('@vertex\nfn vs_main');
    expect(sectorCode).toContain('@fragment\nfn fs_main');

    const webCode = fs.readFileSync(path.join(shadersDir, 'beam_web.wgsl'), 'utf8');
    expect(webCode).toContain('@vertex\nfn vs_main');
    expect(webCode).toContain('@fragment\nfn fs_main');
  });
});
