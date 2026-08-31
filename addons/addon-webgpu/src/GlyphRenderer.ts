/**
 * Copyright (c) 2018 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import { allowRescaling } from 'browser/renderer/shared/RendererUtils';
import { IRenderDimensions } from 'browser/renderer/shared/Types';
import { IThemeService } from 'browser/services/Services';
import { FgFlags, NULL_CELL_CODE } from 'common/buffer/Constants';
import { Disposable, toDisposable } from 'common/Lifecycle';
import type { ILogService, IOptionsService } from 'common/services/Services';
import { Terminal } from '@xterm/xterm';
import { TextureAtlas } from './TextureAtlas';
import type { ITextureAtlas, ITextureAtlasPage } from './Types';
import { DirtyCellUploadTracker, planAtlasUploads, type IBufferUploadPlan } from './UploadPlanner';
import { alignBufferSize, createBlendState, GPU_BUFFER_USAGE, GPU_SHADER_STAGE, GPU_TEXTURE_USAGE } from './WebgpuUtils';

export const PACKED_CELL_WORDS = 5;
export const PACKED_CELL_BYTES = PACKED_CELL_WORDS * Uint32Array.BYTES_PER_ELEMENT;
const GLYPH_VISIBLE = 0x80000000;
const BACKGROUND_DEFAULT_FOREGROUND = 0x40000000;
const COLOR_COUNT = 258;

interface IAtlasTexture {
  texture: GPUTexture;
  width: number;
  height: number;
  version: number;
  page?: ITextureAtlasPage;
}

export interface IWebgpuRenderDiagnostics {
  cellUploadBytes: number;
  cellUploadRanges: number;
  cellSourceRanges: number;
  cellPlannedRanges: number;
  cellOverfetchBytes: number;
  cellDirtyCells: number;
  atlasUploadPixels: number;
  atlasFullUploads: number;
  atlasPartialUploads: number;
  atlasSourceRects: number;
  atlasPlannedRects: number;
  bundleRebuilds: number;
  submissions: number;
  cursorUploadBytes: number;
}

function createShaderSource(maxAtlasPages: number): string {
  let textureBindings = '';
  let textureSamples = '';
  let textureDimensionsCases = '';
  for (let i = 0; i < maxAtlasPages; i++) {
    textureBindings += `@group(1) @binding(${i + 1}) var atlas${i}: texture_2d<f32>;\n`;
    textureSamples += `case ${i}u: { return textureSampleLevel(atlas${i}, atlasSampler, uv, 0.0); }\n`;
    textureDimensionsCases += `case ${i}u: { return vec2f(textureDimensions(atlas${i})); }\n`;
  }
  return `
struct GridUniforms {
  viewportAndCell: vec4f,
  grid: vec4u,
}
struct VertexOutput {
  @builtin(position) position: vec4f,
  @location(0) textureCoordinates: vec2f,
  @location(1) @interpolate(flat) texturePage: u32,
  @location(2) @interpolate(flat) color: vec4f,
}
@group(0) @binding(0) var<storage, read> cells: array<u32>;
@group(0) @binding(1) var<uniform> uniforms: GridUniforms;
struct ColorPalette {
  values: array<vec4f, ${COLOR_COUNT}>,
}

@group(0) @binding(2) var<uniform> colors: ColorPalette;
@group(1) @binding(0) var atlasSampler: sampler;
${textureBindings}

fn quad(vertexIndex: u32) -> vec2f {
  return array<vec2f, 4>(vec2f(0.0, 0.0), vec2f(1.0, 0.0), vec2f(0.0, 1.0), vec2f(1.0, 1.0))[vertexIndex];
}
fn signed16(value: u32) -> f32 {
  let raw = i32(value & 0xffffu);
  return f32(select(raw, raw - 65536, raw >= 32768));
}
fn backgroundColor(colorAttribute: u32, useForegroundDefault: bool) -> vec4f {
  let mode = colorAttribute & 0x3000000u;
  if mode == 0x1000000u || mode == 0x2000000u {
    return colors.values[2u + (colorAttribute & 0xffu)];
  }
  if mode == 0x3000000u {
    return vec4f(
      f32((colorAttribute >> 16u) & 0xffu),
      f32((colorAttribute >> 8u) & 0xffu),
      f32(colorAttribute & 0xffu),
      255.0
    ) / 255.0;
  }
  return colors.values[select(0u, 1u, useForegroundDefault)];
}
fn atlasDimensions(page: u32) -> vec2f {
  switch page {
    ${textureDimensionsCases}
    default: { return vec2f(1.0, 1.0); }
  }
}
fn atlasSample(page: u32, uv: vec2f) -> vec4f {
  switch page {
    ${textureSamples}
    default: { return vec4f(0.0); }
  }
}

@vertex
fn backgroundVertex(@builtin(vertex_index) vertexIndex: u32, @builtin(instance_index) instanceIndex: u32) -> VertexOutput {
  let q = quad(vertexIndex);
  let cols = uniforms.grid.x;
  let cell = vec2f(f32(instanceIndex % cols), f32(instanceIndex / cols));
  let pixel = (cell + q) * uniforms.viewportAndCell.zw;
  let clip = pixel / uniforms.viewportAndCell.xy;
  var output: VertexOutput;
  output.position = vec4f(clip.x * 2.0 - 1.0, 1.0 - clip.y * 2.0, 0.0, 1.0);
  output.textureCoordinates = vec2f(0.0);
  output.texturePage = 0u;
  let flags = cells[instanceIndex * ${PACKED_CELL_WORDS}u + 3u];
  output.color = backgroundColor(cells[instanceIndex * ${PACKED_CELL_WORDS}u + 4u], (flags & ${BACKGROUND_DEFAULT_FOREGROUND}u) != 0u);
  return output;
}
@fragment
fn backgroundFragment(input: VertexOutput) -> @location(0) vec4f { return input.color; }

@vertex
fn glyphVertex(@builtin(vertex_index) vertexIndex: u32, @builtin(instance_index) instanceIndex: u32) -> VertexOutput {
  let q = quad(vertexIndex);
  let base = instanceIndex * ${PACKED_CELL_WORDS}u;
  let packedOffset = cells[base];
  let packedSize = cells[base + 1u];
  let packedPosition = cells[base + 2u];
  let packedPage = cells[base + 3u];
  let cols = uniforms.grid.x;
  let cell = vec2f(f32(instanceIndex % cols), f32(instanceIndex / cols));
  let glyphOffset = vec2f(signed16(packedOffset), signed16(packedOffset >> 16u));
  let glyphSize = vec2f(f32(packedSize & 0xffffu), f32(packedSize >> 16u));
  let texturePosition = vec2f(f32(packedPosition & 0xffffu), f32(packedPosition >> 16u));
  let page = packedPage & 0xffffu;
  let visible = select(0.0, 1.0, (packedPage & ${GLYPH_VISIBLE}u) != 0u);
  let pixel = cell * uniforms.viewportAndCell.zw + glyphOffset + q * glyphSize * visible;
  let clip = pixel / uniforms.viewportAndCell.xy;
  var output: VertexOutput;
  output.position = vec4f(clip.x * 2.0 - 1.0, 1.0 - clip.y * 2.0, 0.0, 1.0);
  output.textureCoordinates = (texturePosition + q * glyphSize) / atlasDimensions(page);
  output.texturePage = page;
  output.color = vec4f(1.0);
  return output;
}
@fragment
fn glyphFragment(input: VertexOutput) -> @location(0) vec4f {
  return atlasSample(input.texturePage, input.textureCoordinates);
}`;
}

export function packU16Pair(low: number, high: number): number {
  return (Math.max(0, Math.min(0xffff, low)) & 0xffff) | ((Math.max(0, Math.min(0xffff, high)) & 0xffff) << 16);
}
export function packI16Pair(low: number, high: number): number {
  const x = Math.max(-0x8000, Math.min(0x7fff, low));
  const y = Math.max(-0x8000, Math.min(0x7fff, high));
  return (x & 0xffff) | ((y & 0xffff) << 16);
}
export function unpackI16(value: number): number {
  const raw = value & 0xffff;
  return raw >= 0x8000 ? raw - 0x10000 : raw;
}

export class GlyphRenderer extends Disposable {
  private readonly _backgroundPipeline: GPURenderPipeline;
  private readonly _glyphPipeline: GPURenderPipeline;
  private readonly _cellBindGroupLayout: GPUBindGroupLayout;
  private readonly _textureBindGroupLayout: GPUBindGroupLayout;
  private readonly _uniformBuffer: GPUBuffer;
  private readonly _colorBuffer: GPUBuffer;
  private readonly _sampler: GPUSampler;
  private readonly _atlasTextures: IAtlasTexture[] = [];
  private _cellBuffer: GPUBuffer;
  private _cellBufferSize = 4;
  private _pendingCellUploadPlan: IBufferUploadPlan | undefined;
  private _cellBindGroup!: GPUBindGroup;
  private _atlasBindGroup: GPUBindGroup;
  private _renderBundle: GPURenderBundle | undefined;
  private readonly _renderBundles: GPURenderBundle[] = [];
  private _cells = new Uint32Array(0);
  private _dirtyCells!: DirtyCellUploadTracker;
  private _cellCount = 0;
  private _atlas: ITextureAtlas | undefined;
  private _lastSeenPageLayoutVersion = -1;
  private _pageOverflowWarned = false;
  private readonly _diagnostics: IWebgpuRenderDiagnostics = {
    cellUploadBytes: 0,
    cellUploadRanges: 0,
    cellSourceRanges: 0,
    cellPlannedRanges: 0,
    cellOverfetchBytes: 0,
    cellDirtyCells: 0,
    atlasUploadPixels: 0,
    atlasFullUploads: 0,
    atlasPartialUploads: 0,
    atlasSourceRects: 0,
    atlasPlannedRects: 0,
    bundleRebuilds: 0,
    submissions: 0,
    cursorUploadBytes: 0
  };

  constructor(
    private readonly _terminal: Terminal,
    private readonly _device: GPUDevice,
    private readonly _canvasFormat: GPUTextureFormat,
    private _dimensions: IRenderDimensions,
    private readonly _optionsService: IOptionsService,
    private readonly _themeService: IThemeService,
    private readonly _logService: ILogService
  ) {
    super();
    if (TextureAtlas.maxAtlasPages === undefined) {
      TextureAtlas.maxAtlasPages = Math.min(32, this._device.limits.maxSampledTexturesPerShaderStage);
      TextureAtlas.maxTextureSize = this._device.limits.maxTextureDimension2D;
    }
    const shaderModule = this._device.createShaderModule({ label: 'xterm packed cell shader', code: createShaderSource(TextureAtlas.maxAtlasPages) });
    this._cellBindGroupLayout = this._device.createBindGroupLayout({
      label: 'xterm packed cell layout',
      entries: [
        { binding: 0, visibility: GPU_SHADER_STAGE.VERTEX, buffer: { type: 'read-only-storage' } },
        { binding: 1, visibility: GPU_SHADER_STAGE.VERTEX, buffer: { type: 'uniform' } },
        { binding: 2, visibility: GPU_SHADER_STAGE.VERTEX, buffer: { type: 'uniform' } }
      ]
    });
    const textureEntries: GPUBindGroupLayoutEntry[] = [{ binding: 0, visibility: GPU_SHADER_STAGE.VERTEX | GPU_SHADER_STAGE.FRAGMENT, sampler: { type: 'filtering' } }];
    for (let i = 0; i < TextureAtlas.maxAtlasPages; i++) {
      textureEntries.push({ binding: i + 1, visibility: GPU_SHADER_STAGE.VERTEX | GPU_SHADER_STAGE.FRAGMENT, texture: { sampleType: 'float', viewDimension: '2d' } });
    }
    this._textureBindGroupLayout = this._device.createBindGroupLayout({ label: 'xterm atlas layout', entries: textureEntries });
    const pipelineLayout = this._device.createPipelineLayout({ label: 'xterm packed cell pipeline layout', bindGroupLayouts: [this._cellBindGroupLayout, this._textureBindGroupLayout] });
    this._backgroundPipeline = this._device.createRenderPipeline({
      label: 'xterm cell background pipeline', layout: pipelineLayout,
      vertex: { module: shaderModule, entryPoint: 'backgroundVertex' },
      fragment: { module: shaderModule, entryPoint: 'backgroundFragment', targets: [{ format: this._canvasFormat, blend: createBlendState() }] },
      primitive: { topology: 'triangle-strip' }
    });
    this._glyphPipeline = this._device.createRenderPipeline({
      label: 'xterm cell glyph pipeline', layout: pipelineLayout,
      vertex: { module: shaderModule, entryPoint: 'glyphVertex' },
      fragment: { module: shaderModule, entryPoint: 'glyphFragment', targets: [{ format: this._canvasFormat, blend: createBlendState() }] },
      primitive: { topology: 'triangle-strip' }
    });
    this._uniformBuffer = this._device.createBuffer({ label: 'xterm grid uniforms', size: 32, usage: GPU_BUFFER_USAGE.UNIFORM | GPU_BUFFER_USAGE.COPY_DST });
    this._colorBuffer = this._device.createBuffer({ label: 'xterm color palette', size: COLOR_COUNT * 4 * Float32Array.BYTES_PER_ELEMENT, usage: GPU_BUFFER_USAGE.UNIFORM | GPU_BUFFER_USAGE.COPY_DST });
    this._cellBuffer = this._device.createBuffer({ label: 'xterm packed cells', size: this._cellBufferSize, usage: GPU_BUFFER_USAGE.STORAGE | GPU_BUFFER_USAGE.COPY_DST });
    this._sampler = this._device.createSampler({ label: 'xterm glyph sampler', addressModeU: 'clamp-to-edge', addressModeV: 'clamp-to-edge', magFilter: 'linear', minFilter: 'linear' });
    for (let i = 0; i < TextureAtlas.maxAtlasPages; i++) {
      this._atlasTextures.push(this._createPlaceholderTexture());
    }
    this._atlasBindGroup = this._createAtlasBindGroup();
    this._recreateCellBindGroup();
    this._register(toDisposable(() => {
      this._uniformBuffer.destroy();
      this._colorBuffer.destroy();
      this._cellBuffer.destroy();
      for (const texture of this._atlasTextures) {
        texture.texture.destroy();
      }
    }));
    this._writeColorPalette();
    this._register(this._themeService.onChangeColors(() => this._writeColorPalette()));
    this.handleResize();
  }

  public beginFrame(): boolean {
    if (!this._atlas) {
      return true;
    }
    if (this._atlas.pageLayoutVersion !== this._lastSeenPageLayoutVersion) {
      this._lastSeenPageLayoutVersion = this._atlas.pageLayoutVersion;
      return true;
    }
    return false;
  }

  public updateCell(x: number, y: number, code: number, bg: number, fg: number, ext: number, chars: string, width: number, lastBg: number): void {
    const index = (y * this._terminal.cols + x) * PACKED_CELL_WORDS;
    const inverseBackground = !!(fg & FgFlags.INVERSE);
    const backgroundFlags = inverseBackground ? BACKGROUND_DEFAULT_FOREGROUND : 0;
    let packedOffset = 0;
    let packedSize = 0;
    let packedPosition = 0;
    let packedPage = backgroundFlags;
    const packedBackground = (inverseBackground ? fg : bg) >>> 0;
    if (code !== NULL_CELL_CODE && code !== undefined && this._atlas) {
      const glyph = chars && chars.length > 1
        ? this._atlas.getRasterizedGlyphCombinedChar(chars, bg, fg, ext, false, this._terminal.element)
        : this._atlas.getRasterizedGlyph(code, bg, fg, ext, false, this._terminal.element);
      if (glyph && glyph.size.x !== 0 && glyph.size.y !== 0) {
        const leftCellPadding = Math.floor((this._dimensions.device.cell.width - this._dimensions.device.char.width) / 2);
        const clippedPixels = bg !== lastBg && glyph.offset.x > leftCellPadding ? glyph.offset.x - leftCellPadding : 0;
        const offsetX = -glyph.offset.x + clippedPixels + this._dimensions.device.char.left;
        const offsetY = -glyph.offset.y + this._dimensions.device.char.top;
        let glyphWidth = glyph.size.x - clippedPixels;
        if (allowRescaling(code, width, glyph.size.x, this._dimensions.device.cell.width)) {
          glyphWidth = Math.min(glyphWidth, width * this._dimensions.device.cell.width);
        }
        packedOffset = packI16Pair(offsetX, offsetY);
        packedSize = packU16Pair(glyphWidth, glyph.size.y);
        packedPosition = packU16Pair(glyph.texturePosition.x + clippedPixels, glyph.texturePosition.y);
        packedPage = GLYPH_VISIBLE | backgroundFlags | (glyph.texturePage & 0xffff);
      }
    }
    this._cells[index] = packedOffset;
    this._cells[index + 1] = packedSize;
    this._cells[index + 2] = packedPosition;
    this._cells[index + 3] = packedPage;
    this._cells[index + 4] = packedBackground;
    this._dirtyCells.mark(x, y);
  }

  public clear(): void {
    this._cells.fill(0);
    this._dirtyCells.markAll();
  }

  public handleResize(): void {
    this._cellCount = this._terminal.cols * this._terminal.rows;
    this._cells = new Uint32Array(this._cellCount * PACKED_CELL_WORDS);
    this._dirtyCells = new DirtyCellUploadTracker(this._terminal.cols, this._terminal.rows, PACKED_CELL_BYTES);
    this._dirtyCells.markAll();
    this._ensureCellBuffer(this._cells.byteLength);
    const data = new ArrayBuffer(32);
    const view = new DataView(data);
    view.setFloat32(0, this._dimensions.device.canvas.width, true);
    view.setFloat32(4, this._dimensions.device.canvas.height, true);
    view.setFloat32(8, this._dimensions.device.cell.width, true);
    view.setFloat32(12, this._dimensions.device.cell.height, true);
    view.setUint32(16, this._terminal.cols, true);
    view.setUint32(20, this._terminal.rows, true);
    this._device.queue.writeBuffer(this._uniformBuffer, 0, data);
    this._renderBundle = undefined;
  }

  public prepareFrame(): void {
    if (!this._atlas || this._cellCount === 0) {
      return;
    }
    this._uploadDirtyCells();
    if (this._uploadAtlasChanges()) {
      this._atlasBindGroup = this._createAtlasBindGroup();
      this._renderBundle = undefined;
    }
    if (!this._renderBundle) {
      this._renderBundle = this._createRenderBundle();
      this._renderBundles[0] = this._renderBundle;
    }
  }

  public render(pass: GPURenderPassEncoder): void {
    if (!this._atlas || this._cellCount === 0 || !this._renderBundle) {
      return;
    }
    pass.executeBundles(this._renderBundles);
  }

  public commitFrame(): void {
    const plan = this._pendingCellUploadPlan;
    if (!plan) {
      return;
    }
    this._pendingCellUploadPlan = undefined;
    this._dirtyCells.commit();
    this._diagnostics.cellUploadBytes += plan.uploadByteLength;
    this._diagnostics.cellUploadRanges += plan.ranges.length;
    this._diagnostics.cellSourceRanges += plan.sourceRangeCount;
    this._diagnostics.cellPlannedRanges += plan.ranges.length;
    this._diagnostics.cellOverfetchBytes += plan.overfetchByteLength;
    this._diagnostics.cellDirtyCells += plan.dirtyCellCount;
  }

  public setAtlas(atlas: ITextureAtlas): void {
    if (this._atlas === atlas) {
      return;
    }
    this._atlas = atlas;
    this._lastSeenPageLayoutVersion = -1;
    this.invalidateAtlasTextures();
  }

  public invalidateAtlasTextures(): void {
    for (const texture of this._atlasTextures) {
      texture.version = -1;
      texture.page = undefined;
    }
  }
  public setDimensions(dimensions: IRenderDimensions): void { this._dimensions = dimensions; }
  public markSubmission(): void { this._diagnostics.submissions++; }
  public get diagnostics(): Readonly<IWebgpuRenderDiagnostics> { return this._diagnostics; }

  private _uploadDirtyCells(): void {
    const plan = this._dirtyCells.plan();
    this._pendingCellUploadPlan = plan.ranges.length > 0 ? plan : undefined;
    for (const range of plan.ranges) {
      this._device.queue.writeBuffer(this._cellBuffer, range.byteOffset, this._cells.buffer, range.byteOffset, range.byteLength);
    }
  }

  private _uploadAtlasChanges(): boolean {
    if (!this._atlas) return false;
    const pageCount = Math.min(this._atlas.pages.length, this._atlasTextures.length);
    if (this._atlas.pages.length > this._atlasTextures.length && !this._pageOverflowWarned) {
      this._pageOverflowWarned = true;
      this._logService.warn(`Atlas page count (${this._atlas.pages.length}) exceeds the renderer's texture capacity (${this._atlasTextures.length}), some glyphs will not render correctly`);
    }
    let bindGroupChanged = false;
    for (let i = 0; i < pageCount; i++) {
      const page = this._atlas.pages[i];
      let target = this._atlasTextures[i];
      const pageChanged = target.page !== page;
      if (pageChanged || target.width !== page.canvas.width || target.height !== page.canvas.height) {
        target.texture.destroy();
        target = {
          texture: this._device.createTexture({
            label: `xterm glyph atlas page ${i}`,
            size: [page.canvas.width, page.canvas.height],
            format: 'rgba8unorm',
            usage: GPU_TEXTURE_USAGE.COPY_DST | GPU_TEXTURE_USAGE.TEXTURE_BINDING | GPU_TEXTURE_USAGE.RENDER_ATTACHMENT
          }),
          width: page.canvas.width, height: page.canvas.height, version: -1, page
        };
        this._atlasTextures[i] = target;
        bindGroupChanged = true;
      }
      if (target.version === page.version) continue;
      const rects = pageChanged ? undefined : page.getDirtyRectsSince(target.version);
      const plan = planAtlasUploads(page.canvas.width, page.canvas.height, rects);
      for (const rect of plan.rects) {
        this._copyAtlasRect(page, target, rect.x, rect.y, rect.width, rect.height);
      }
      this._diagnostics.atlasSourceRects += plan.sourceRectCount;
      this._diagnostics.atlasPlannedRects += plan.rects.length;
      if (plan.isFullUpload) {
        this._diagnostics.atlasFullUploads++;
      } else {
        this._diagnostics.atlasPartialUploads += plan.rects.length;
      }
      target.version = page.version;
      target.page = page;
    }
    return bindGroupChanged;
  }

  private _copyAtlasRect(page: ITextureAtlasPage, target: IAtlasTexture, x: number, y: number, width: number, height: number): void {
    if (width <= 0 || height <= 0) return;
    this._device.queue.copyExternalImageToTexture(
      { source: page.canvas, origin: { x, y } },
      { texture: target.texture, origin: { x, y } },
      [width, height]
    );
    this._diagnostics.atlasUploadPixels += width * height;
  }

  private _createRenderBundle(): GPURenderBundle {
    const encoder = this._device.createRenderBundleEncoder({ label: 'xterm cell render bundle', colorFormats: [this._canvasFormat] });
    encoder.setPipeline(this._backgroundPipeline);
    encoder.setBindGroup(0, this._cellBindGroup);
    encoder.setBindGroup(1, this._atlasBindGroup);
    encoder.draw(4, this._cellCount);
    encoder.setPipeline(this._glyphPipeline);
    encoder.setBindGroup(0, this._cellBindGroup);
    encoder.setBindGroup(1, this._atlasBindGroup);
    encoder.draw(4, this._cellCount);
    this._diagnostics.bundleRebuilds++;
    return encoder.finish();
  }

  private _ensureCellBuffer(byteLength: number): void {
    if (byteLength <= this._cellBufferSize) return;
    this._cellBuffer.destroy();
    this._cellBufferSize = alignBufferSize(Math.max(byteLength, this._cellBufferSize * 2));
    this._cellBuffer = this._device.createBuffer({ label: 'xterm packed cells', size: this._cellBufferSize, usage: GPU_BUFFER_USAGE.STORAGE | GPU_BUFFER_USAGE.COPY_DST });
    this._recreateCellBindGroup();
    this._renderBundle = undefined;
  }

  private _recreateCellBindGroup(): void {
    this._cellBindGroup = this._device.createBindGroup({
      label: 'xterm packed cell bind group', layout: this._cellBindGroupLayout,
      entries: [
        { binding: 0, resource: { buffer: this._cellBuffer } },
        { binding: 1, resource: { buffer: this._uniformBuffer } },
        { binding: 2, resource: { buffer: this._colorBuffer } }
      ]
    });
  }

  private _writeColorPalette(): void {
    const data = new Float32Array(COLOR_COUNT * 4);
    const write = (index: number, rgba: number): void => {
      const offset = index * 4;
      data[offset] = (rgba >>> 24) / 255;
      data[offset + 1] = (rgba >>> 16 & 0xff) / 255;
      data[offset + 2] = (rgba >>> 8 & 0xff) / 255;
      data[offset + 3] = (rgba & 0xff) / 255;
    };
    write(0, this._themeService.colors.background.rgba);
    write(1, this._themeService.colors.foreground.rgba);
    for (let i = 0; i < 256; i++) {
      write(i + 2, this._themeService.colors.ansi[i].rgba);
    }
    this._device.queue.writeBuffer(this._colorBuffer, 0, data);
  }

  private _createPlaceholderTexture(): IAtlasTexture {
    const texture = this._device.createTexture({ label: 'xterm glyph atlas placeholder', size: [1, 1], format: 'rgba8unorm', usage: GPU_TEXTURE_USAGE.COPY_DST | GPU_TEXTURE_USAGE.TEXTURE_BINDING | GPU_TEXTURE_USAGE.RENDER_ATTACHMENT });
    this._device.queue.writeTexture({ texture }, new Uint8Array([0, 0, 0, 0]), { bytesPerRow: 4 }, [1, 1]);
    return { texture, width: 1, height: 1, version: -1 };
  }

  private _createAtlasBindGroup(): GPUBindGroup {
    const entries: GPUBindGroupEntry[] = [{ binding: 0, resource: this._sampler }];
    for (let i = 0; i < this._atlasTextures.length; i++) {
      entries.push({ binding: i + 1, resource: this._atlasTextures[i].texture.createView() });
    }
    return this._device.createBindGroup({ label: 'xterm glyph atlas bind group', layout: this._textureBindGroupLayout, entries });
  }
}
