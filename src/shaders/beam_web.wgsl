// BEAM WEB WGSL
// Full-screen relief shader for both Night Relief and Nautical Sea Chart modes
// Samples 16-bit DEM plate (4096 x 6144) with hardware mipmapping and evaluates hillshading & water mask

struct GlobalUniforms {
  camera_pos: vec4<f32>,     // viewportWidth, viewportHeight, centerU, centerV
  camera_params: vec4<f32>,  // zoom, aspectH, timeSec, speedMult
  render_knobs: vec4<f32>,   // ve, height_boost, exposure, beam_gain
  theme_knobs: vec4<f32>,    // themeMix (0=night, 1=day), sea_gain, ao, ambient
  sea_night: vec4<f32>,
  land_night: vec4<f32>,
  sea_day: vec4<f32>,
  land_day: vec4<f32>,
  filter_knobs: vec4<f32>,   // active_tier (0=all, 1=major, 2=sector, 3=minor), _, _, _
};

struct VertexOutput {
  @builtin(position) position: vec4<f32>,
  @location(0) uv: vec2<f32>,
};

@vertex
fn vs_main(@builtin(vertex_index) vertex_index: u32) -> VertexOutput {
  var pos = array<vec2<f32>, 4>(
    vec2<f32>(-1.0, -1.0),
    vec2<f32>( 1.0, -1.0),
    vec2<f32>(-1.0,  1.0),
    vec2<f32>( 1.0,  1.0)
  );

  var out: VertexOutput;
  out.position = vec4<f32>(pos[vertex_index], 0.0, 1.0);

  let vp_w = u_globals.camera_pos.x;
  let vp_h = u_globals.camera_pos.y;
  let center_u = u_globals.camera_pos.z;
  let center_v = u_globals.camera_pos.w;
  let zoom = u_globals.camera_params.x;
  let aspect_h = u_globals.camera_params.y;

  let base_scale = min(vp_w, vp_h / aspect_h);
  let scale = base_scale * zoom;

  let screen_x = (pos[vertex_index].x * 0.5 + 0.5) * vp_w;
  let screen_y = (1.0 - (pos[vertex_index].y * 0.5 + 0.5)) * vp_h;

  let rel_x = screen_x - vp_w * 0.5;
  let rel_y = screen_y - vp_h * 0.5;

  out.uv = vec2<f32>(
    center_u + rel_x / scale,
    center_v + rel_y / (scale * aspect_h)
  );

  return out;
}

@group(0) @binding(0) var<uniform> u_globals: GlobalUniforms;
@group(0) @binding(1) var u_sampler: sampler;
@group(0) @binding(2) var u_plate: texture_2d<f32>;
@group(0) @binding(3) var u_dem: texture_2d<f32>;

@fragment
fn fs_main(in: VertexOutput) -> @location(0) vec4<f32> {
  let theme_mix = u_globals.theme_knobs.x;
  let sample_uv = clamp(in.uv, vec2<f32>(0.0), vec2<f32>(1.0));

  // 1. Narrow-band Signed Distance Field (Channel B) and Ambient Occlusion (Channel A)
  // Channel B: 0.0 = open sea, 0.5 = coastline, 1.0 = deep land
  let plate_sample = textureSample(u_plate, u_sampler, sample_uv);
  let sdf_val = plate_sample.b;
  let ao_map = plate_sample.a;

  // Sub-pixel vector anti-aliased land coverage factor:
  let dist = sdf_val - 0.5;
  let delta = max(fwidth(dist) * 0.707, 1e-4);
  let land_factor = smoothstep(-delta, delta, dist);

  // 2. Native floating-point DEM elevation in meters
  let elev = textureSample(u_dem, u_sampler, sample_uv).r;

  // Multi-tap normal gradient on 4096 x 6144 plate
  let texel = vec2<f32>(1.0 / 4096.0, 1.0 / 6144.0);
  let h_l = textureSample(u_dem, u_sampler, clamp(sample_uv - vec2<f32>(texel.x, 0.0), vec2<f32>(0.0), vec2<f32>(1.0))).r;
  let h_r = textureSample(u_dem, u_sampler, clamp(sample_uv + vec2<f32>(texel.x, 0.0), vec2<f32>(0.0), vec2<f32>(1.0))).r;
  let h_u = textureSample(u_dem, u_sampler, clamp(sample_uv - vec2<f32>(0.0, texel.y), vec2<f32>(0.0), vec2<f32>(1.0))).r;
  let h_d = textureSample(u_dem, u_sampler, clamp(sample_uv + vec2<f32>(0.0, texel.y), vec2<f32>(0.0), vec2<f32>(1.0))).r;

  let ve = u_globals.render_knobs.x; // vertical exaggeration factor (~7.0)
  let dx = (h_r - h_l) * ve * 0.003;
  let dy = (h_d - h_u) * ve * 0.003;
  let normal = normalize(vec3<f32>(-dx, -dy, 1.0));

  // Northwest fill light angle for crisp sculptural relief
  let fill = normalize(vec3<f32>(-0.38, -0.48, 0.79));
  let sh = clamp(dot(normal, fill), 0.0, 1.0);

  let ao_strength = u_globals.theme_knobs.z; // ~0.75
  let ao = mix(1.0, ao_map, ao_strength);

  let ambient_land = u_globals.theme_knobs.w; // ~0.45
  let elev_norm = clamp(elev / 1800.0, 0.0, 1.0);

  // Night relief: dusky basalt/charcoal terrain with authentic nocturnal silhouette (175% calibrated)
  let land_base = u_globals.land_night.rgb;
  var land_night = land_base * ((ambient_land + 1.10 * sh) * ao);
  // Mountain ridge highlight for Scandinavian mountain spine under nocturnal starlight
  land_night = land_night + vec3<f32>(0.034, 0.045, 0.060) * elev_norm * sh;

  // Sea depth gradient: deep oceanic midnight navy
  var sea_night = u_globals.sea_night.rgb * (1.0 + 0.12 * (1.0 - sample_uv.y));

  // Day mode colors (Nautical chart)
  let land_day_base = u_globals.land_day.rgb;
  let land_day = mix(land_day_base, vec3<f32>(0.76, 0.80, 0.84), elev_norm) * (0.60 + 0.40 * sh);
  let sea_day = u_globals.sea_day.rgb;

  // Sub-pixel anti-aliased mix of land and sea
  let night_color = mix(sea_night, land_night, land_factor);
  let day_color = mix(sea_day, land_day, land_factor);

  var relief_color = mix(night_color, day_color, theme_mix);

  // Boundless ocean background: continues seamlessly outside the plate bounds
  var ocean_night = u_globals.sea_night.rgb * (1.0 + 0.14 * (1.0 - clamp(in.uv.y, 0.0, 1.0)));
  let ocean_day = u_globals.sea_day.rgb;
  var ocean_color = mix(ocean_night, ocean_day, theme_mix);

  // Soft edge feathering: smoothly blends plate perimeter into boundless ocean
  // Independent x and y feathering with 0.09 width on x ensures continental landmasses (Finland/Russia)
  // fade naturally and smoothly into the boundless sea without forming a visible vertical stripe.
  let fx = smoothstep(0.0, 0.09, min(in.uv.x, 1.0 - in.uv.x));
  let fy = smoothstep(0.0, 0.05, min(in.uv.y, 1.0 - in.uv.y));
  let edge_feather = fx * fy;

  var scene_color = mix(ocean_color, relief_color, edge_feather);

  // Cartographic subtle vignette
  let vd = distance(clamp(in.uv, vec2<f32>(0.0), vec2<f32>(1.0)), vec2<f32>(0.5, 0.5));
  let vig = 1.0 - 0.20 * smoothstep(0.42, 0.95, vd);
  scene_color = scene_color * vig;

  // Exposure tone mapping
  let exposure = u_globals.render_knobs.z;
  let tonemapped = vec3<f32>(1.0) - exp(-scene_color * exposure);

  return vec4<f32>(tonemapped, 1.0);
}
