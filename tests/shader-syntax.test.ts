import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

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

  it('validates SectorData 16-byte alignment in beam_sector_sdf.wgsl', () => {
    const sdfPath = path.join(shadersDir, 'beam_sector_sdf.wgsl');
    const sdfCode = fs.readFileSync(sdfPath, 'utf8');

    expect(sdfCode).toContain('struct SectorData');
    expect(sdfCode).toContain('start_deg: f32');
    expect(sdfCode).toContain('end_deg: f32');
    expect(sdfCode).toContain('color_code: f32');
    expect(sdfCode).toContain('pad: f32'); // Explicit padding for 16-byte alignment
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
