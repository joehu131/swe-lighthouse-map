// BEAM SECTOR SDF WGSL
// Instanced bounding quad rasterizer with volumetric lighting, terrain response, and water specular glints
// Matches mapped.earth atmospheric lighting model adapted for Swedish & Nordic archipelago coastline

struct GlobalUniforms {
  camera_pos: vec4<f32>,     // viewportWidth, viewportHeight, centerU, centerV
  camera_params: vec4<f32>,  // zoom, aspectH, timeSec, speedMult
  render_knobs: vec4<f32>,   // ve, height_boost, exposure, beam_gain
  theme_knobs: vec4<f32>,    // themeMix, sea_gain, ao, ambient
  sea_night: vec4<f32>,
  land_night: vec4<f32>,
  sea_day: vec4<f32>,
  land_day: vec4<f32>,
  filter_knobs: vec4<f32>,   // active_tier (0=all, 1=major, 2=sector, 3=minor), _, _, _
};

struct SectorData {
  start_deg: f32,
  end_deg: f32,
  color_code: f32,
  pad: f32,
};

struct VertexInput {
  @builtin(vertex_index) vertex_idx: u32,
  // Instance attributes (64 bytes = 16 floats stride)
  @location(0) beacon_uv: vec2<f32>,      // u, v on plate
  @location(1) reach_period: vec2<f32>,   // reach (norm UV), period (s)
  @location(2) phase_rot: vec2<f32>,      // phase (0..1), rotates (1=sweep, 0=fixed)
  @location(3) sec_info: vec2<u32>,       // sec_offset, nsec
  @location(4) primary_rgb: vec3<f32>,    // fallback / primary rgb
  @location(5) optic_tier: vec2<u32>,     // optic_type (0,1,2), tier (1=major, 2=sector, 3=minor)
  @location(6) beacon_meta: vec2<u32>,    // x: 1-based beacon_id (1..N), y: pad
};

struct VertexOutput {
  @builtin(position) clip_pos: vec4<f32>,
  @location(0) local_pos: vec2<f32>,      // [-1, 1] inside bounding quad
  @location(1) @interpolate(flat) period: f32,
  @location(2) @interpolate(flat) phase: f32,
  @location(3) @interpolate(flat) rotates: f32,
  @location(4) @interpolate(flat) sec_offset: u32,
  @location(5) @interpolate(flat) nsec: u32,
  @location(6) @interpolate(flat) primary_rgb: vec3<f32>,
  @location(7) @interpolate(flat) optic_tier: vec2<u32>,
  @location(8) @interpolate(flat) reach_screen: f32,
  @location(9) frag_uv: vec2<f32>,
  @location(10) @interpolate(flat) beacon_uv: vec2<f32>,
};

@group(0) @binding(0) var<uniform> u_globals: GlobalUniforms;
@group(0) @binding(1) var<storage, read> u_sectors: array<SectorData>;
@group(0) @binding(2) var u_sampler: sampler;
@group(0) @binding(3) var u_plate: texture_2d<f32>;
@group(0) @binding(4) var u_dem: texture_2d<f32>;

const PI: f32 = 3.141592653589793;
const TAU: f32 = 6.283185307179586;

@vertex
fn vs_main(in: VertexInput) -> VertexOutput {
  var out: VertexOutput;

  // Solo beacon filter: if solo_id > 0, only render the selected beacon
  let solo_id = u32(u_globals.filter_knobs.y + 0.1);
  if (solo_id > 0u && in.beacon_meta.x != solo_id) {
    out.clip_pos = vec4<f32>(0.0, 0.0, 0.0, 1.0);
    return out;
  }

  // GPU Tier filter: cull instance immediately if not in active tier
  let active_tier = u32(u_globals.filter_knobs.x + 0.1);
  let is_active = (active_tier == 0u) || (in.optic_tier.y == active_tier);
  if (!is_active && solo_id == 0u) {
    out.clip_pos = vec4<f32>(0.0, 0.0, 0.0, 1.0);
    return out;
  }

  // 6 vertices for 2 triangles of quad
  var quad = array<vec2<f32>, 6>(
    vec2<f32>(-1.0, -1.0),
    vec2<f32>( 1.0, -1.0),
    vec2<f32>(-1.0,  1.0),
    vec2<f32>(-1.0,  1.0),
    vec2<f32>( 1.0, -1.0),
    vec2<f32>( 1.0,  1.0)
  );
  let q = quad[in.vertex_idx];

  let vp_w = u_globals.camera_pos.x;
  let vp_h = u_globals.camera_pos.y;
  let center_u = u_globals.camera_pos.z;
  let center_v = u_globals.camera_pos.w;
  let zoom = u_globals.camera_params.x;
  let aspect_h = u_globals.camera_params.y;

  let base_scale = min(vp_w, vp_h / aspect_h);
  let scale = base_scale * zoom;

  // Beacon center in screen pixels
  let center_screen_x = vp_w * 0.5 + (in.beacon_uv.x - center_u) * scale;
  let center_screen_y = vp_h * 0.5 + (in.beacon_uv.y - center_v) * (scale * aspect_h);

  // Radius in screen pixels (reach_mult from settings panel, default 1.0)
  let reach_mult = max(0.1, u_globals.filter_knobs.w);
  let reach_screen_px = in.reach_period.x * scale * reach_mult;
  let base_min = select(2.5, 7.0, in.optic_tier.y == 2u);
  let min_reach_cap = select(base_min, 28.0, in.optic_tier.y == 1u);
  let min_reach_px = max(min_reach_cap, reach_screen_px);

  // Position vertex in screen pixels
  let vertex_screen_x = center_screen_x + q.x * min_reach_px;
  let vertex_screen_y = center_screen_y + q.y * min_reach_px;

  // Convert screen pixels to clip space [-1, 1]
  let clip_x = (vertex_screen_x / vp_w) * 2.0 - 1.0;
  let clip_y = 1.0 - (vertex_screen_y / vp_h) * 2.0;

  out.clip_pos = vec4<f32>(clip_x, clip_y, 0.0, 1.0);
  out.local_pos = q;
  out.period = in.reach_period.y;
  out.phase = in.phase_rot.x;
  out.rotates = in.phase_rot.y;
  out.sec_offset = in.sec_info.x;
  out.nsec = in.sec_info.y;
  out.primary_rgb = in.primary_rgb;
  out.optic_tier = in.optic_tier;
  out.reach_screen = min_reach_px;
  out.beacon_uv = in.beacon_uv;

  // Plate UV for this vertex
  let reach_u = min_reach_px / scale;
  let reach_v = min_reach_px / (scale * aspect_h);
  out.frag_uv = in.beacon_uv + vec2<f32>(q.x * reach_u, q.y * reach_v);

  return out;
}

fn ang_diff(a: f32, b: f32) -> f32 {
  var e = a - b;
  e = e - TAU * floor((e + PI) / TAU);
  return e;
}

fn flash_env(t: f32, period: f32, on_dur: f32, n: f32, kind: f32) -> f32 {
  if (kind < 0.5) { return 1.0; }
  let per = max(period, 0.5);
  let tp = fract(t / per) * per;
  let ramp = 0.06;
  var e = 0.0;
  let cnt = i32(clamp(n, 1.0, 4.0));
  for (var k = 0; k < cnt; k = k + 1) {
    let s = f32(k) * 2.0 * on_dur;
    let up = smoothstep(s - ramp, s + ramp, tp);
    let dn = 1.0 - smoothstep(s + on_dur - ramp, s + on_dur + ramp, tp);
    e = max(e, up * dn);
  }
  return e;
}

fn wave_slope(uv: vec2<f32>, t: f32, dir: vec2<f32>, freq: f32, speed: f32, amp: f32) -> vec2<f32> {
  let d = normalize(dir);
  let ph = dot(uv, d) * freq + t * speed;
  return amp * cos(ph) * freq * d;
}

fn sea_normal(uv: vec2<f32>, t: f32, amp: f32) -> vec3<f32> {
  var s = vec2<f32>(0.0);
  s = s + wave_slope(uv, t, vec2<f32>(1.0, 0.30), 120.0, 0.9, amp * 1.0);
  s = s + wave_slope(uv, t, vec2<f32>(-0.4, 1.0), 190.0, 1.3, amp * 0.7);
  s = s + wave_slope(uv, t, vec2<f32>(0.8, -0.6), 70.0, 0.6, amp * 0.6);
  s = s + wave_slope(uv, t, vec2<f32>(0.2, 0.95), 250.0, 1.7, amp * 0.4);
  return normalize(vec3<f32>(-s.x, -s.y, 1.0));
}

fn getSectorColor(code: f32, wf: f32) -> vec3<f32> {
  let c = u32(code + 0.1);
  if (c == 1u) {
    // IALA red: cool crimson (0.0) -> current warm red (0.5) -> deep fire red (1.0)
    let cool = vec3<f32>(0.90, 0.10, 0.20);
    let mid  = vec3<f32>(1.00, 0.16, 0.02);
    let hot  = vec3<f32>(1.00, 0.08, 0.00);
    if (wf <= 0.5) {
      return mix(cool, mid, wf * 2.0);
    } else {
      return mix(mid, hot, (wf - 0.5) * 2.0);
    }
  } else if (c == 2u) {
    // IALA green: cool teal-green (0.0) -> current sea-green (0.5) -> warm golden green (1.0)
    let cool = vec3<f32>(0.10, 0.90, 0.60);
    let mid  = vec3<f32>(0.05, 0.72, 0.35);
    let hot  = vec3<f32>(0.18, 0.76, 0.22);
    if (wf <= 0.5) {
      return mix(cool, mid, wf * 2.0);
    } else {
      return mix(mid, hot, (wf - 0.5) * 2.0);
    }
  } else if (c == 3u) {
    // Amber: cool amber (0.0) -> current warm amber (0.5) -> deep orange amber (1.0)
    let cool = vec3<f32>(1.00, 0.78, 0.25);
    let mid  = vec3<f32>(1.00, 0.62, 0.05);
    let hot  = vec3<f32>(1.00, 0.48, 0.00);
    if (wf <= 0.5) {
      return mix(cool, mid, wf * 2.0);
    } else {
      return mix(mid, hot, (wf - 0.5) * 2.0);
    }
  }
  // White: cool near-white (0.0) -> current 2700K incandescent (0.5) -> deep golden candlelight (1.0)
  let cool_white = vec3<f32>(0.95, 0.95, 1.00);
  let mid_white  = vec3<f32>(1.00, 0.78, 0.44);
  let hot_white  = vec3<f32>(1.00, 0.64, 0.26);
  if (wf <= 0.5) {
    return mix(cool_white, mid_white, wf * 2.0);
  } else {
    return mix(mid_white, hot_white, (wf - 0.5) * 2.0);
  }
}

@fragment
fn fs_main(in: VertexOutput) -> @location(0) vec4<f32> {
  let r = length(in.local_pos);
  if (r > 1.0) {
    discard;
  }

  let time_sec = u_globals.camera_params.z * u_globals.camera_params.w;
  let aspect_h = u_globals.camera_params.y;
  let period = max(0.5, in.period);

  // warm_factor: 0.0 = arctic cool, 1.0 = deep halogen amber. Default ~0.6
  let warm_factor = clamp(u_globals.filter_knobs.z, 0.0, 1.0);

  let dir2 = in.local_pos;
  var body: f32 = 0.0;
  var tier_weight: f32 = 1.0;
  var lamp_pulse: f32 = 1.0;

  // Bearing angle from beacon: 0 = East, PI/2 = South in screen space
  let bearing = atan2(dir2.y, dir2.x);
  // Compass angle (0 = North, clockwise) for sector lookups
  let compass_deg = (atan2(dir2.x, -dir2.y) * 180.0 / PI + 360.0) % 360.0;

  var fan_col = in.primary_rgb;
  // Warm halo color (matches getSectorColor white at same warm_factor)
  let warm = getSectorColor(0.0, warm_factor);

  if (in.rotates > 0.5) {
    // Rotating coastal lighthouse (Havsfyr)
    let beam_ang = in.phase * TAU + time_sec * (TAU / period);
    let da = ang_diff(bearing, beam_ang);
    let hw = 0.22; // ~12.6 degrees half-width
    let fog = 0.70;
    body = exp(-(da * da) / (2.0 * hw * hw * (1.0 + fog * 0.6)));
    tier_weight = select(0.85, 0.45, in.optic_tier.y > 1u);
    lamp_pulse = 1.0;
    fan_col = mix(warm, in.primary_rgb, 0.15);
  } else {
    // Fixed / Sectored / Harbour light (Sektorfyr / Hamnfyr)
    let env = flash_env(time_sec + in.phase * period, period, 0.35, 1.0, 1.0);
    body = mix(0.04, 1.0, env);
    lamp_pulse = mix(0.18, 1.25, env);

    if (in.optic_tier.y == 2u) {
      // Sector fairway light (Ledfyr)
      tier_weight = 0.22;
    } else {
      // Minor harbour light (Hamnfyr) - pinpoint star, subtle ambient
      tier_weight = 0.06;
    }

    if (in.nsec > 0u) {
      // Evaluate sector arcs
      var matched = false;
      for (var i = 0u; i < in.nsec; i = i + 1u) {
        let sec = u_sectors[in.sec_offset + i];
        var span = (sec.end_deg - sec.start_deg + 360.0) % 360.0;
        if (span == 0.0 && sec.start_deg != sec.end_deg) {
          span = 360.0;
        }
        let delta = (compass_deg - sec.start_deg + 360.0) % 360.0;

        if (delta >= 0.0 && delta <= span) {
          fan_col = getSectorColor(sec.color_code, warm_factor);
          matched = true;
          break;
        }
      }
      if (!matched) {
        body = 0.0; // Baffled outside charted navigational sector
      }
    }
  }

  // Radial falloff and soft edge tip fade (dies naturally, no hard cutoff ring)
  let f = clamp(1.0 - r, 0.0, 1.0);
  let fall = f * f;
  let tip = smoothstep(0.0, 0.14, f);
  var fan = body * fall * tip * tier_weight;

  // Sample plate for real landscape & sea surface illumination
  let sample_uv = clamp(in.frag_uv, vec2<f32>(0.0), vec2<f32>(1.0));
  let plate_sample = textureSampleLevel(u_plate, u_sampler, sample_uv, 0.0);
  let sdf_val = plate_sample.b;
  let dist = sdf_val - 0.5;
  // Analytical derivative based on reach and screen scale avoids non-uniform fwidth after discard
  let delta = clamp(0.707 / max(in.reach_screen, 1.0), 0.001, 0.05);
  let land_factor = smoothstep(-delta, delta, dist);

  let to_b = in.beacon_uv - sample_uv;
  let dist_to_b = length(to_b);
  let ldir2 = select(vec2<f32>(0.0, 1.0), to_b / dist_to_b, dist_to_b > 1e-5);
  let ldir = normalize(vec3<f32>(ldir2.x, ldir2.y * aspect_h, 0.08));

  let texel = vec2<f32>(1.0 / 4096.0, 1.0 / 6144.0);
  let hl = textureSampleLevel(u_dem, u_sampler, clamp(sample_uv - vec2<f32>(texel.x, 0.0), vec2<f32>(0.0), vec2<f32>(1.0)), 0.0).r;
  let hr = textureSampleLevel(u_dem, u_sampler, clamp(sample_uv + vec2<f32>(texel.x, 0.0), vec2<f32>(0.0), vec2<f32>(1.0)), 0.0).r;
  let hu = textureSampleLevel(u_dem, u_sampler, clamp(sample_uv - vec2<f32>(0.0, texel.y), vec2<f32>(0.0), vec2<f32>(1.0)), 0.0).r;
  let hd = textureSampleLevel(u_dem, u_sampler, clamp(sample_uv + vec2<f32>(0.0, texel.y), vec2<f32>(0.0), vec2<f32>(1.0)), 0.0).r;
  let dx = (hr - hl) * u_globals.render_knobs.x * 0.003;
  let dy = (hd - hu) * u_globals.render_knobs.x * 0.003;
  let n = normalize(vec3<f32>(-dx, -dy, 1.0));

  // Hills facing the lighthouse catch bright grazing illumination and rock micro-glints
  let land_diffuse = clamp(dot(n, ldir), 0.0, 1.0);
  let land_glint = pow(clamp(reflect(-ldir, n).z, 0.0, 1.0), 20.0);
  let land_resp = 0.85 + 1.35 * land_diffuse + 0.60 * land_glint;

  // Water surface ripples & wave specular glints
  let nw = sea_normal(sample_uv, time_sec, 0.002);
  let sea_facing = clamp(dot(nw, ldir), 0.0, 1.0);
  let sea_glint = pow(clamp(reflect(-ldir, nw).z, 0.0, 1.0), 32.0);
  let sea_resp = u_globals.theme_knobs.y * (0.90 + 0.50 * sea_facing) + 1.40 * sea_glint;

  // Continuous response across land and sea with sub-pixel vector coastline transition
  let resp = mix(sea_resp, land_resp, land_factor);

  // Volumetric atmospheric haze glow (suspended in air across both sea and land)
  let fog = 0.70;
  let fog_glow = fog * fan * (0.50 + 0.50 * f);

  // Central lamp dot (discrete sparkling core that covers uniform screen pixels)
  let r_px = r * in.reach_screen;
  var lamp: f32 = 0.0;

  if (in.optic_tier.y == 1u) {
    // Major havsfyr: crisp bright core with soft golden halo
    let ls = 0.65;
    lamp = (0.60 * smoothstep(2.0 * ls, 0.0, r_px) + 0.25 * exp(-r_px / (2.5 * ls))) * lamp_pulse;
  } else if (in.optic_tier.y == 2u) {
    // Sector light: compact navigational core
    let ls = 0.40;
    lamp = (0.50 * smoothstep(1.5 * ls, 0.0, r_px) + 0.15 * exp(-r_px / (1.8 * ls))) * lamp_pulse;
  } else {
    // Minor harbour light: pin-sharp stellar sparkle
    lamp = (0.70 * smoothstep(1.0, 0.0, r_px) + 0.20 * exp(-r_px * 1.8)) * lamp_pulse;
  }

  let beam_gain = u_globals.render_knobs.w; // ~2.0
  let surface_illumination = fan_col * (fan * resp + fog_glow);
  let lamp_illumination = warm * lamp; // Direct emission towards observer
  var total_light = (surface_illumination + lamp_illumination) * beam_gain;

  // Soft tone-compression prevents additive accumulation blowout:
  let max_lum = max(max(total_light.r, total_light.g), total_light.b);
  if (max_lum > 0.75) {
    total_light = total_light * (0.75 + 0.25 * (1.0 - exp(-(max_lum - 0.75)))) / max_lum;
  }

  let theme_mix = u_globals.theme_knobs.x;
  // Day mode: softer intensity so the paper nautical chart remains legible
  let final_rgb = mix(total_light, total_light * 0.40, theme_mix);
  let alpha = mix(clamp(max_lum * 0.75, 0.0, 0.90), clamp(max_lum * 0.35, 0.0, 0.60), theme_mix);

  if (alpha <= 0.004) {
    discard;
  }

  // Linear premultiplied radiance for additive blending:
  return vec4<f32>(final_rgb * alpha, 0.0);
}
