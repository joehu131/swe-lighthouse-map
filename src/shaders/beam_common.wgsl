// BEAM COMMON WGSL
// Authoritative 16-byte aligned WGSL GlobalUniforms specification & math utilities
// Referenced by beam_web.wgsl, beam_sector_sdf.wgsl, and verified by tests/shader-syntax.test.ts

struct GlobalUniforms {
  // vec4: viewportWidth, viewportHeight, centerU, centerV
  camera_pos: vec4<f32>,
  // vec4: zoom, aspectH, timeSec, speedMult
  camera_params: vec4<f32>,
  // vec4: ve (exaggeration), height_boost, exposure, beam_gain
  render_knobs: vec4<f32>,
  // vec4: themeMix (0 = dark, 1 = light), sea_gain, ao, ambient
  theme_knobs: vec4<f32>,
  // vec4: sea_night (rgb)
  sea_night: vec4<f32>,
  // vec4: land_night (rgb)
  land_night: vec4<f32>,
  // vec4: sea_day (rgb)
  sea_day: vec4<f32>,
  // vec4: land_day (rgb)
  land_day: vec4<f32>,
  // vec4: filter_knobs (active_tier, _, _, _)
  filter_knobs: vec4<f32>,
};

// Decodes 16-bit elevation from RG channels
fn decodeElevation(rg: vec2<f32>, max_elev: f32) -> f32 {
  let r = rg.x * 255.0;
  let g = rg.y * 255.0;
  let raw16 = r * 256.0 + g;
  return (raw16 / 65535.0) * max_elev;
}

// Khronos PBR Neutral Tone Mapping
// Preserves spectral saturation while gracefully compressing high dynamic range cores
fn toneMapPbrNeutral(color: vec3<f32>) -> vec3<f32> {
  let start_compression = 0.8 - 0.04;
  let desaturation = 0.15;

  let x = min(color.r, min(color.g, color.b));
  let offset = select(0.04, x - 6.25 * x * x, x < 0.08);
  var c = color - offset;

  let peak = max(c.r, max(c.g, c.b));
  if (peak < start_compression) {
    return color;
  }

  let d = 1.0 - start_compression;
  let new_peak = 1.0 - d * d / (peak + d - start_compression);
  c = c * (new_peak / peak);

  let g = 1.0 - 1.0 / (desaturation * (peak - new_peak) + 1.0);
  return mix(c, vec3<f32>(new_peak), g);
}

// Retinal core desaturation: high intensity light saturates retinal cones toward warm white
fn applyCoreDesaturation(color: vec3<f32>, luminance: f32) -> vec3<f32> {
  let hot_white = vec3<f32>(1.0, 0.97, 0.92);
  let desat = clamp((luminance - 1.2) * 0.7, 0.0, 1.0);
  return mix(color * luminance, hot_white * luminance, desat);
}
