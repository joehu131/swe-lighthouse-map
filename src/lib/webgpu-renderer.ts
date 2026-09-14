import type { Manifest } from './types.js';
import { MapCamera } from './map-camera.js';
import { ThemeManager } from './theme-manager.js';

import beamWebShader from '../shaders/beam_web.wgsl?raw';
import beamSectorShader from '../shaders/beam_sector_sdf.wgsl?raw';
import mipmapShader from '../shaders/mipmap.wgsl?raw';

export class WebGPURenderer {
  private canvas: HTMLCanvasElement;
  private manifest: Manifest;
  private camera: MapCamera;
  private theme: ThemeManager;

  private device!: GPUDevice;
  private context!: GPUCanvasContext;
  private format!: GPUTextureFormat;

  private uniformBuffer!: GPUBuffer;
  private sectorBuffer!: GPUBuffer;
  private instanceBuffer!: GPUBuffer;
  private plateTexture!: GPUTexture;
  private demTexture!: GPUTexture;
  private plateSampler!: GPUSampler;

  private reliefPipeline!: GPURenderPipeline;
  private reliefBindGroup!: GPUBindGroup;

  private sectorPipeline!: GPURenderPipeline;
  private sectorBindGroup!: GPUBindGroup;

  private isRunning = false;
  private animFrameId = 0;
  private speedMult = 0.25;
  private isPaused = false;
  private accumulatedTimeSec = 0;
  private lastTimestamp = 0;

  constructor(
    canvas: HTMLCanvasElement,
    manifest: Manifest,
    camera: MapCamera,
    theme: ThemeManager
  ) {
    this.canvas = canvas;
    this.manifest = manifest;
    this.camera = camera;
    this.theme = theme;
  }

  static isSupported(): boolean {
    return typeof navigator !== 'undefined' && 'gpu' in navigator;
  }

  async init(): Promise<void> {
    if (!WebGPURenderer.isSupported()) {
      throw new Error('WebGPU is not supported by your browser or hardware.');
    }

    const adapter = await navigator.gpu.requestAdapter({
      powerPreference: 'high-performance',
    });
    if (!adapter) throw new Error('No appropriate GPUAdapter found.');

    this.device = await adapter.requestDevice();

    this.device.addEventListener('uncapturederror', (event: any) => {
      const msg = event.error?.message || String(event.error);
      console.error('[WebGPU Error Message]: ' + msg);
    });

    const ctx = this.canvas.getContext('webgpu');
    if (!ctx) throw new Error('Failed to get webgpu canvas context.');
    this.context = ctx;

    this.format = navigator.gpu.getPreferredCanvasFormat();
    this.context.configure({
      device: this.device,
      format: this.format,
      alphaMode: 'opaque',
    });

    await this.initResources();
  }

  private async initResources(): Promise<void> {
    const dev = this.device;

    // 1. Uniform Buffer: 160 bytes (10 x vec4<f32>)
    this.uniformBuffer = dev.createBuffer({
      size: 160,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });

    // 2. Sectors Storage Buffer
    const sectorFloatCount = Math.max(4, this.manifest.sectors.length * 4);
    const sectorData = new Float32Array(sectorFloatCount);
    for (let i = 0; i < this.manifest.sectors.length; i++) {
      const s = this.manifest.sectors[i];
      sectorData[i * 4 + 0] = s[0]; // start_deg
      sectorData[i * 4 + 1] = s[1]; // end_deg
      sectorData[i * 4 + 2] = s[2]; // color_code
      sectorData[i * 4 + 3] = s[3]; // pad
    }

    this.sectorBuffer = dev.createBuffer({
      size: sectorData.byteLength,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
    });
    dev.queue.writeBuffer(this.sectorBuffer, 0, sectorData);

    // 3. Beacons Instance Buffer
    // 16 floats = 64 bytes per instance (16-byte aligned):
    // beacon_uv (vec2, offset 0)
    // reach_period (vec2, offset 8)
    // phase_rot (vec2, offset 16)
    // sec_info (vec2<u32>, offset 24)
    // primary_rgb (vec3, offset 32)
    // pad0 (1 float, offset 44)
    // optic_tier (vec2<u32>, offset 48)
    // pad1 (vec2, offset 56)
    const floatsPerInstance = 16;
    const instanceData = new ArrayBuffer(this.manifest.beacons.length * floatsPerInstance * 4);
    const f32View = new Float32Array(instanceData);
    const u32View = new Uint32Array(instanceData);

    for (let i = 0; i < this.manifest.beacons.length; i++) {
      const b = this.manifest.beacons[i];
      const offset = i * floatsPerInstance;

      f32View[offset + 0] = b.u;
      f32View[offset + 1] = b.v;
      f32View[offset + 2] = b.reach;
      f32View[offset + 3] = b.period;
      f32View[offset + 4] = b.phase;
      f32View[offset + 5] = b.rotates;
      u32View[offset + 6] = b.sec_offset;
      u32View[offset + 7] = b.nsec;
      f32View[offset + 8] = b.rgb[0];
      f32View[offset + 9] = b.rgb[1];
      f32View[offset + 10] = b.rgb[2];
      f32View[offset + 11] = 0.0;
      u32View[offset + 12] = b.optic_type === 'havsfyr' ? 0 : b.optic_type === 'sektorfyr' ? 1 : 2;
      u32View[offset + 13] = b.tier === 'major' ? 1 : b.tier === 'sector' ? 2 : 3;
      u32View[offset + 14] = i + 1;
      u32View[offset + 15] = 0;
    }

    this.instanceBuffer = dev.createBuffer({
      size: instanceData.byteLength,
      usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
    });
    dev.queue.writeBuffer(this.instanceBuffer, 0, instanceData);

    // 4. Load Plate & Generate Mipmaps
    const baseUrl = import.meta.env.BASE_URL.endsWith('/')
      ? import.meta.env.BASE_URL
      : `${import.meta.env.BASE_URL}/`;
    await this.loadPlateAndGenerateMipmaps(`${baseUrl}data/plate.png`);

    // 5. Build Render Pipelines
    await this.buildPipelines();
  }

  private async loadPlateAndGenerateMipmaps(url: string): Promise<void> {
    const dev = this.device;

    const res = await fetch(url);
    if (!res.ok) throw new Error(`Failed to load plate from ${url}`);
    const blob = await res.blob();
    const bitmap = await createImageBitmap(blob);

    const w = bitmap.width;
    const h = bitmap.height;
    const mipLevelCount = Math.floor(Math.log2(Math.max(w, h))) + 1;

    this.plateTexture = dev.createTexture({
      size: [w, h, 1],
      mipLevelCount,
      format: 'rgba8unorm',
      usage:
        GPUTextureUsage.TEXTURE_BINDING |
        GPUTextureUsage.COPY_DST |
        GPUTextureUsage.RENDER_ATTACHMENT,
    });

    dev.queue.copyExternalImageToTexture(
      { source: bitmap },
      { texture: this.plateTexture, mipLevel: 0 },
      [w, h]
    );
    bitmap.close();

    this.plateSampler = dev.createSampler({
      magFilter: 'linear',
      minFilter: 'linear',
      mipmapFilter: 'linear',
      addressModeU: 'clamp-to-edge',
      addressModeV: 'clamp-to-edge',
    });

    // Run custom WebGPU Mipmap Blit Pass for plateTexture (levels 1 through mipLevelCount-1)
    this.generateMipmaps(this.plateTexture, mipLevelCount, 'rgba8unorm');

    // Create native r16float DEM texture for true floating-point elevation
    this.demTexture = dev.createTexture({
      size: [w, h, 1],
      mipLevelCount,
      format: 'r16float',
      usage:
        GPUTextureUsage.TEXTURE_BINDING |
        GPUTextureUsage.RENDER_ATTACHMENT,
    });

    // Unpack R+G 16-bit elevation from plateTexture level 0 to demTexture level 0
    this.unpackDemTexture();

    // Generate mipmaps for demTexture using r16float linear downsampling
    this.generateMipmaps(this.demTexture, mipLevelCount, 'r16float');
  }

  private unpackDemTexture(): void {
    const dev = this.device;
    const unpackModule = dev.createShaderModule({
      code: `
        struct VertexOutput {
          @builtin(position) pos: vec4<f32>,
        };

        @vertex
        fn vs_main(@builtin(vertex_index) vid: u32) -> VertexOutput {
          var pos = array<vec2<f32>, 4>(
            vec2<f32>(-1.0, -1.0),
            vec2<f32>( 1.0, -1.0),
            vec2<f32>(-1.0,  1.0),
            vec2<f32>( 1.0,  1.0)
          );
          var out: VertexOutput;
          out.pos = vec4<f32>(pos[vid], 0.0, 1.0);
          return out;
        }

        @group(0) @binding(0) var u_raw: texture_2d<f32>;

        @fragment
        fn fs_main(@builtin(position) pos: vec4<f32>) -> @location(0) vec4<f32> {
          let coords = vec2<i32>(pos.xy);
          let raw = textureLoad(u_raw, coords, 0);
          let r = u32(round(raw.r * 255.0));
          let g = u32(round(raw.g * 255.0));
          let raw16 = (r << 8u) | g;
          let elev = (f32(raw16) / 65535.0) * 2500.0;
          return vec4<f32>(elev, 0.0, 0.0, 1.0);
        }
      `,
    });

    const pipeline = dev.createRenderPipeline({
      layout: 'auto',
      vertex: {
        module: unpackModule,
        entryPoint: 'vs_main',
      },
      fragment: {
        module: unpackModule,
        entryPoint: 'fs_main',
        targets: [{ format: 'r16float' }],
      },
      primitive: { topology: 'triangle-strip' },
    });

    const bindGroup = dev.createBindGroup({
      layout: pipeline.getBindGroupLayout(0),
      entries: [
        {
          binding: 0,
          resource: this.plateTexture.createView({
            baseMipLevel: 0,
            mipLevelCount: 1,
          }),
        },
      ],
    });

    const cmd = dev.createCommandEncoder();
    const pass = cmd.beginRenderPass({
      colorAttachments: [
        {
          view: this.demTexture.createView({
            baseMipLevel: 0,
            mipLevelCount: 1,
          }),
          loadOp: 'clear',
          storeOp: 'store',
        },
      ],
    });

    pass.setPipeline(pipeline);
    pass.setBindGroup(0, bindGroup);
    pass.draw(4);
    pass.end();

    dev.queue.submit([cmd.finish()]);
  }

  private generateMipmaps(
    texture: GPUTexture,
    mipLevelCount: number,
    format: GPUTextureFormat = 'rgba8unorm'
  ): void {
    const dev = this.device;
    const mipmapModule = dev.createShaderModule({ code: mipmapShader });

    const pipeline = dev.createRenderPipeline({
      layout: 'auto',
      vertex: {
        module: mipmapModule,
        entryPoint: 'vs_main',
      },
      fragment: {
        module: mipmapModule,
        entryPoint: 'fs_main',
        targets: [{ format }],
      },
      primitive: { topology: 'triangle-strip' },
    });

    const linearSampler = dev.createSampler({
      minFilter: 'linear',
      magFilter: 'linear',
    });

    const cmd = dev.createCommandEncoder();

    for (let i = 1; i < mipLevelCount; i++) {
      const prevView = texture.createView({
        baseMipLevel: i - 1,
        mipLevelCount: 1,
      });

      const nextView = texture.createView({
        baseMipLevel: i,
        mipLevelCount: 1,
      });

      const pass = cmd.beginRenderPass({
        colorAttachments: [
          {
            view: nextView,
            loadOp: 'clear',
            storeOp: 'store',
          },
        ],
      });

      const bindGroup = dev.createBindGroup({
        layout: pipeline.getBindGroupLayout(0),
        entries: [
          { binding: 0, resource: linearSampler },
          { binding: 1, resource: prevView },
        ],
      });

      pass.setPipeline(pipeline);
      pass.setBindGroup(0, bindGroup);
      pass.draw(4);
      pass.end();
    }

    dev.queue.submit([cmd.finish()]);
  }

  private async buildPipelines(): Promise<void> {
    const dev = this.device;

    // 1. Background Relief Pipeline
    const reliefModule = dev.createShaderModule({ code: beamWebShader });
    const reliefInfo = await reliefModule.getCompilationInfo();
    for (const msg of reliefInfo.messages) {
      const logStr = `[RELIEF SHADER ${msg.type.toUpperCase()} L${msg.lineNum}:${msg.linePos}]: ${msg.message}`;
      if (msg.type === 'error') console.error(logStr);
      else if (msg.type === 'warning') console.warn(logStr);
      else console.info(logStr);
    }

    this.reliefPipeline = dev.createRenderPipeline({
      layout: 'auto',
      vertex: {
        module: reliefModule,
        entryPoint: 'vs_main',
      },
      fragment: {
        module: reliefModule,
        entryPoint: 'fs_main',
        targets: [{ format: this.format }],
      },
      primitive: { topology: 'triangle-strip' },
    });

    this.reliefBindGroup = dev.createBindGroup({
      layout: this.reliefPipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer: this.uniformBuffer } },
        { binding: 1, resource: this.plateSampler },
        { binding: 2, resource: this.plateTexture.createView() },
        { binding: 3, resource: this.demTexture.createView() },
      ],
    });

    // 2. Instanced Analytical SDF Sector Pipeline
    const sectorModule = dev.createShaderModule({ code: beamSectorShader });
    const sectorInfo = await sectorModule.getCompilationInfo();
    for (const msg of sectorInfo.messages) {
      const logStr = `[SECTOR SHADER ${msg.type.toUpperCase()} L${msg.lineNum}:${msg.linePos}]: ${msg.message}`;
      if (msg.type === 'error') console.error(logStr);
      else if (msg.type === 'warning') console.warn(logStr);
      else console.info(logStr);
    }

    this.sectorPipeline = dev.createRenderPipeline({
      layout: 'auto',
      vertex: {
        module: sectorModule,
        entryPoint: 'vs_main',
        buffers: [
          {
            // Per-instance layout (64 bytes = 16 floats, 16-byte aligned)
            arrayStride: 64,
            stepMode: 'instance',
            attributes: [
              { shaderLocation: 0, offset: 0, format: 'float32x2' },  // beacon_uv
              { shaderLocation: 1, offset: 8, format: 'float32x2' },  // reach_period
              { shaderLocation: 2, offset: 16, format: 'float32x2' }, // phase_rot
              { shaderLocation: 3, offset: 24, format: 'uint32x2' },  // sec_info
              { shaderLocation: 4, offset: 32, format: 'float32x3' }, // primary_rgb
              { shaderLocation: 5, offset: 48, format: 'uint32x2' },  // optic_tier
              { shaderLocation: 6, offset: 56, format: 'uint32x2' },  // beacon_meta
            ],
          },
        ],
      },
      fragment: {
        module: sectorModule,
        entryPoint: 'fs_main',
        targets: [
          {
            format: this.format,
            // Linear premultiplied additive light blending
            blend: {
              color: {
                srcFactor: 'one',
                dstFactor: 'one',
                operation: 'add',
              },
              alpha: {
                srcFactor: 'one',
                dstFactor: 'one',
                operation: 'add',
              },
            },
          },
        ],
      },
      primitive: { topology: 'triangle-list' },
    });

    this.sectorBindGroup = dev.createBindGroup({
      layout: this.sectorPipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer: this.uniformBuffer } },
        { binding: 1, resource: { buffer: this.sectorBuffer } },
        { binding: 2, resource: this.plateSampler },
        { binding: 3, resource: this.plateTexture.createView() },
        { binding: 4, resource: this.demTexture.createView() },
      ],
    });
  }

  private onFrameCallback: (() => void) | null = null;

  private activeTierFilter: 'all' | 'major' | 'sector' | 'minor' = 'all';

  private soloBeaconId: string | null = null;
  private soloBeaconIndex = 0;

  // Light aesthetics settings (from gear panel)
  private warmFactor = 0.5;   // default 0.5 (50% in UI, maps to mid warm incandescent)
  private beamGainOverride: number | null = 3.0; // default 3.0
  private reachMult = 0.70;   // default 0.70
  private bgBrightness = 1.20; // default 1.20

  setTierFilter(tier: 'all' | 'major' | 'sector' | 'minor'): void {
    this.activeTierFilter = tier;
  }

  setSoloBeacon(beaconId: string | null): void {
    this.soloBeaconId = beaconId;
    if (!beaconId) {
      this.soloBeaconIndex = 0;
      return;
    }
    const idx = this.manifest.beacons.findIndex((b) => b.id === beaconId);
    this.soloBeaconIndex = idx >= 0 ? idx + 1 : 0;
  }

  getSoloBeacon(): string | null {
    return this.soloBeaconId;
  }

  setLightSettings(warmFactor = 0.5, beamGain: number, reachMult: number, bgBrightness = 1.20): void {
    this.warmFactor = warmFactor;
    this.beamGainOverride = beamGain;
    this.reachMult = reachMult;
    this.bgBrightness = bgBrightness;
  }

  setSpeed(mult: number): void {
    this.speedMult = mult;
  }

  setPaused(paused: boolean): void {
    this.isPaused = paused;
  }

  setOnFrame(callback: () => void): void {

    this.onFrameCallback = callback;
  }

  start(): void {
    if (this.isRunning) return;
    this.isRunning = true;
    this.lastTimestamp = performance.now();
    this.renderLoop();
  }

  stop(): void {
    this.isRunning = false;
    if (this.animFrameId) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = 0;
    }
  }

  destroy(): void {
    this.stop();
    try {
      this.uniformBuffer?.destroy();
      this.sectorBuffer?.destroy();
      this.instanceBuffer?.destroy();
      this.plateTexture?.destroy();
      this.demTexture?.destroy();
      this.device?.destroy();
    } catch {
      // Ignored if already destroyed
    }
  }

  private renderLoop = (): void => {
    if (!this.isRunning) return;

    const now = performance.now();
    const dt = (now - this.lastTimestamp) / 1000.0;
    this.lastTimestamp = now;

    if (!this.isPaused) {
      this.accumulatedTimeSec += dt * this.speedMult;
    }

    const cameraMoving = this.camera.updateAnimation();
    this.theme.update();

    if (cameraMoving && this.onFrameCallback) {
      this.onFrameCallback();
    }

    this.updateUniforms();
    this.renderFrame();

    this.animFrameId = requestAnimationFrame(this.renderLoop);
  };

  private updateUniforms(): void {
    const uData = new Float32Array(40); // 40 floats = 160 bytes (10 x vec4<f32>)

    const p = this.manifest.palette;
    const l = this.manifest.look;

    // camera_pos (vec4)
    uData[0] = this.canvas.width;
    uData[1] = this.canvas.height;
    uData[2] = this.camera.centerU;
    uData[3] = this.camera.centerV;

    // camera_params (vec4)
    uData[4] = this.camera.zoom;
    uData[5] = this.camera.aspectH;
    uData[6] = this.accumulatedTimeSec;
    uData[7] = 1.0; // speed already baked into accumulatedTimeSec

    // render_knobs (vec4): ve, height_boost, exposure, beam_gain
    uData[8] = l.ve;
    uData[9] = l.height_boost;
    uData[10] = l.exposure * this.bgBrightness;
    uData[11] = this.beamGainOverride !== null ? this.beamGainOverride : l.beam_gain;

    // theme_knobs (vec4)
    uData[12] = this.theme.mix; // 0 = dark, 1 = light
    uData[13] = l.sea_gain;
    uData[14] = l.ao;
    uData[15] = l.ambient;

    // sea_night (vec4)
    uData[16] = p.sea_night[0];
    uData[17] = p.sea_night[1];
    uData[18] = p.sea_night[2];
    uData[19] = 1.0;

    // land_night (vec4)
    uData[20] = p.land_night[0];
    uData[21] = p.land_night[1];
    uData[22] = p.land_night[2];
    uData[23] = 1.0;

    // sea_day (vec4)
    uData[24] = p.sea_day[0];
    uData[25] = p.sea_day[1];
    uData[26] = p.sea_day[2];
    uData[27] = 1.0;

    // land_day (vec4)
    uData[28] = p.land_day[0];
    uData[29] = p.land_day[1];
    uData[30] = p.land_day[2];
    uData[31] = 1.0;

    // filter_knobs (vec4)
    // 0 = all, 1 = major, 2 = sector, 3 = minor
    const tierCode =
      this.activeTierFilter === 'major'
        ? 1.0
        : this.activeTierFilter === 'sector'
          ? 2.0
          : this.activeTierFilter === 'minor'
            ? 3.0
            : 0.0;
    uData[32] = tierCode;
    uData[33] = this.soloBeaconIndex;
    uData[34] = this.warmFactor;
    uData[35] = this.reachMult;

    this.device.queue.writeBuffer(this.uniformBuffer, 0, uData);
  }

  private renderFrame(): void {
    if (this.canvas.width === 0 || this.canvas.height === 0) return;
    const currentTexture = this.context.getCurrentTexture();
    const cmd = this.device.createCommandEncoder();

    const isDay = this.theme.mix;
    const clearR = (0.024 * (1.0 - isDay) + 0.91 * isDay) * this.bgBrightness;
    const clearG = (0.040 * (1.0 - isDay) + 0.94 * isDay) * this.bgBrightness;
    const clearB = (0.073 * (1.0 - isDay) + 0.97 * isDay) * this.bgBrightness;

    const pass = cmd.beginRenderPass({
      colorAttachments: [
        {
          view: currentTexture.createView(),
          loadOp: 'clear',
          clearValue: { r: clearR, g: clearG, b: clearB, a: 1.0 },
          storeOp: 'store',
        },
      ],
    });

    // 1. Draw Background Relief
    pass.setPipeline(this.reliefPipeline);
    pass.setBindGroup(0, this.reliefBindGroup);
    pass.draw(4);

    // 2. Draw Instanced Sector Fans & Lighthouses
    pass.setPipeline(this.sectorPipeline);
    pass.setBindGroup(0, this.sectorBindGroup);
    pass.setVertexBuffer(0, this.instanceBuffer);
    pass.draw(6, this.manifest.beacons.length);

    pass.end();
    this.device.queue.submit([cmd.finish()]);
  }
}
