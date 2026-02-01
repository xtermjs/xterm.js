/**
 * Copyright (c) 2026 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import { IRenderDimensions } from 'browser/renderer/shared/Types';
import { NULL_CELL_CODE } from 'common/buffer/Constants';
import { Disposable, toDisposable } from 'common/Lifecycle';
import { Terminal } from '@xterm/xterm';
import { allowRescaling } from 'browser/renderer/shared/RendererUtils';
import type { IOptionsService } from 'common/services/Services';
import type { IRenderModel, IRasterizedGlyph, ITextureAtlas } from '../../addon-webgl/src/Types';
import type { IGPUDevice, IGPURenderPassEncoder, IGPUSampler, IGPUTexture, IGPUTextureFormat, IGPUTextureView, IGPUBindGroup, IGPUBindGroupLayout, IGPURenderPipeline, IGPUBuffer, IGPUBindGroupLayoutEntry } from './WebgpuTypes';
import { WebgpuBufferUsage, WebgpuShaderStage, WebgpuTextureUsage, WebgpuColorWriteMask } from './WebgpuUtils';

interface IVertices {
  attributes: Float32Array;
  count: number;
}

const enum VertexAttribLocations {
  UNIT_QUAD = 0,
  OFFSET = 1,
  SIZE = 2,
  TEXPAGE = 3,
  TEXCOORD = 4,
  TEXSIZE = 5,
  CELL_POSITION = 6
}

const INDICES_PER_CELL = 11;
const BYTES_PER_CELL = INDICES_PER_CELL * Float32Array.BYTES_PER_ELEMENT;

// Work variables to avoid garbage collection
let $i = 0;
let $glyph: IRasterizedGlyph | undefined = undefined;
let $leftCellPadding = 0;
let $clippedPixels = 0;

function createGlyphShaderSource(maxAtlasPages: number): string {
  let textureBindings = '';
  for (let i = 0; i < maxAtlasPages; i++) {
    textureBindings += `@group(0) @binding(${2 + i}) var atlasTexture${i}: texture_2d<f32>;\n`;
  }

  let sampleChain = '';
  for (let i = 0; i < maxAtlasPages; i++) {
    const prefix = i === 0 ? '' : 'else ';
    sampleChain += `${prefix}if (page == ${i}u) { color = textureSample(atlasTexture${i}, atlasSampler, input.texCoord); }\n`;
  }

  return `
struct Uniforms {
  resolution: vec2<f32>,
  _pad: vec2<f32>,
};

@group(0) @binding(0) var<uniform> uniforms: Uniforms;
@group(0) @binding(1) var atlasSampler: sampler;
${textureBindings}

struct VertexIn {
  @location(${VertexAttribLocations.UNIT_QUAD}) unitQuad: vec2<f32>,
  @location(${VertexAttribLocations.OFFSET}) offset: vec2<f32>,
  @location(${VertexAttribLocations.SIZE}) size: vec2<f32>,
  @location(${VertexAttribLocations.TEXPAGE}) texPage: f32,
  @location(${VertexAttribLocations.TEXCOORD}) texCoord: vec2<f32>,
  @location(${VertexAttribLocations.TEXSIZE}) texSize: vec2<f32>,
  @location(${VertexAttribLocations.CELL_POSITION}) cellPos: vec2<f32>,
};

struct VertexOut {
  @builtin(position) position: vec4<f32>,
  @location(0) texCoord: vec2<f32>,
  @location(1) @interpolate(flat) texPage: u32,
};

@vertex
fn vs_main(input: VertexIn) -> VertexOut {
  var out: VertexOut;
  let zeroToOne = (input.offset / uniforms.resolution) + input.cellPos + (input.unitQuad * input.size);
  let clip = vec2<f32>(zeroToOne.x * 2.0 - 1.0, 1.0 - zeroToOne.y * 2.0);
  out.position = vec4<f32>(clip, 0.0, 1.0);
  out.texCoord = input.texCoord + input.unitQuad * input.texSize;
  out.texPage = u32(input.texPage + 0.5);
  return out;
}

@fragment
fn fs_main(input: VertexOut) -> @location(0) vec4<f32> {
  let page = min(input.texPage, u32(${maxAtlasPages - 1}));
  var color: vec4<f32> = vec4<f32>(1.0, 0.0, 0.0, 1.0);
  ${sampleChain}
  return color;
}
`;
}

interface IAtlasTexture {
  texture: IGPUTexture;
  view: IGPUTextureView;
  version: number;
  width: number;
  height: number;
}

export class WebgpuGlyphRenderer extends Disposable {
  private readonly _uniformData = new Float32Array(4);
  private readonly _unitQuadBuffer: IGPUBuffer;
  private _instanceBuffer: IGPUBuffer | undefined;
  private _instanceBufferSize: number = 0;
  private readonly _sampler: IGPUSampler;
  private readonly _bindGroupLayout: IGPUBindGroupLayout;
  private _bindGroup: IGPUBindGroup | undefined;
  private readonly _pipeline: IGPURenderPipeline;
  private readonly _uniformBuffer: IGPUBuffer;

  private _atlas: ITextureAtlas | undefined;
  private _atlasTextures: IAtlasTexture[] = [];

  private _vertices: IVertices = { attributes: new Float32Array(0), count: 0 };
  private _stagingAttributes: Float32Array = new Float32Array(0);

  constructor(
    private readonly _terminal: Terminal,
    private readonly _device: IGPUDevice,
    private readonly _format: IGPUTextureFormat,
    private _dimensions: IRenderDimensions,
    private readonly _optionsService: IOptionsService,
    private readonly _maxAtlasPages: number
  ) {
    super();
    const unitQuadVertices = new Float32Array([0, 0, 1, 0, 0, 1, 1, 1]);
    this._unitQuadBuffer = this._device.createBuffer({
      size: unitQuadVertices.byteLength,
      usage: WebgpuBufferUsage.VERTEX | WebgpuBufferUsage.COPY_DST
    });
    this._device.queue.writeBuffer(this._unitQuadBuffer, 0, unitQuadVertices);

    this._uniformBuffer = this._device.createBuffer({
      size: this._uniformData.byteLength,
      usage: WebgpuBufferUsage.UNIFORM | WebgpuBufferUsage.COPY_DST
    });
    this._updateResolutionUniform();

    this._sampler = this._device.createSampler({
      minFilter: 'linear',
      magFilter: 'linear',
      mipmapFilter: 'linear',
      addressModeU: 'clamp-to-edge',
      addressModeV: 'clamp-to-edge'
    });

    const bindGroupEntries: IGPUBindGroupLayoutEntry[] = [
      {
        binding: 0,
        visibility: WebgpuShaderStage.VERTEX,
        buffer: { type: 'uniform' }
      },
      {
        binding: 1,
        visibility: WebgpuShaderStage.FRAGMENT,
        sampler: { type: 'filtering' }
      }
    ];
    for (let i = 0; i < this._maxAtlasPages; i++) {
      bindGroupEntries.push({
        binding: 2 + i,
        visibility: WebgpuShaderStage.FRAGMENT,
        texture: { sampleType: 'float', viewDimension: '2d' }
      });
    }

    this._bindGroupLayout = this._device.createBindGroupLayout({ entries: bindGroupEntries });

    const shaderModule = this._device.createShaderModule({ code: createGlyphShaderSource(this._maxAtlasPages) });
    const pipelineLayout = this._device.createPipelineLayout({ bindGroupLayouts: [this._bindGroupLayout] });

    this._pipeline = this._device.createRenderPipeline({
      layout: pipelineLayout,
      vertex: {
        module: shaderModule,
        entryPoint: 'vs_main',
        buffers: [
          {
            arrayStride: 2 * Float32Array.BYTES_PER_ELEMENT,
            stepMode: 'vertex',
            attributes: [
              { shaderLocation: VertexAttribLocations.UNIT_QUAD, offset: 0, format: 'float32x2' }
            ]
          },
          {
            arrayStride: BYTES_PER_CELL,
            stepMode: 'instance',
            attributes: [
              { shaderLocation: VertexAttribLocations.OFFSET, offset: 0, format: 'float32x2' },
              { shaderLocation: VertexAttribLocations.SIZE, offset: 8, format: 'float32x2' },
              { shaderLocation: VertexAttribLocations.TEXPAGE, offset: 16, format: 'float32' },
              { shaderLocation: VertexAttribLocations.TEXCOORD, offset: 20, format: 'float32x2' },
              { shaderLocation: VertexAttribLocations.TEXSIZE, offset: 28, format: 'float32x2' },
              { shaderLocation: VertexAttribLocations.CELL_POSITION, offset: 36, format: 'float32x2' }
            ]
          }
        ]
      },
      fragment: {
        module: shaderModule,
        entryPoint: 'fs_main',
        targets: [
          {
            format: this._format,
            blend: {
              color: { srcFactor: 'src-alpha', dstFactor: 'one-minus-src-alpha', operation: 'add' },
              alpha: { srcFactor: 'src-alpha', dstFactor: 'one-minus-src-alpha', operation: 'add' }
            },
            writeMask: WebgpuColorWriteMask.ALL
          }
        ]
      },
      primitive: {
        topology: 'triangle-strip'
      }
    });

    this._createDefaultAtlasTextures();
    this._bindGroup = this._createBindGroup();
    this.clear();

    this._register(toDisposable(() => {
      this._unitQuadBuffer.destroy?.();
      this._instanceBuffer?.destroy?.();
      this._uniformBuffer.destroy?.();
      for (const tex of this._atlasTextures) {
        tex.texture.destroy?.();
      }
    }));
  }

  public beginFrame(): boolean {
    return this._atlas ? this._atlas.beginFrame() : true;
  }

  public updateCell(x: number, y: number, code: number, bg: number, fg: number, ext: number, chars: string, width: number, lastBg: number): void {
    this._updateCell(this._vertices.attributes, x, y, code, bg, fg, ext, chars, width, lastBg);
  }

  private _updateCell(array: Float32Array, x: number, y: number, code: number | undefined, bg: number, fg: number, ext: number, chars: string, width: number, lastBg: number): void {
    $i = (y * this._terminal.cols + x) * INDICES_PER_CELL;

    if (code === NULL_CELL_CODE || code === undefined) {
      array.fill(0, $i, $i + INDICES_PER_CELL - 2);
      return;
    }

    if (!this._atlas) {
      return;
    }

    if (chars && chars.length > 1) {
      $glyph = this._atlas.getRasterizedGlyphCombinedChar(chars, bg, fg, ext, false, this._terminal.element);
    } else {
      $glyph = this._atlas.getRasterizedGlyph(code, bg, fg, ext, false, this._terminal.element);
    }

    $leftCellPadding = Math.floor((this._dimensions.device.cell.width - this._dimensions.device.char.width) / 2);
    if (bg !== lastBg && $glyph.offset.x > $leftCellPadding) {
      $clippedPixels = $glyph.offset.x - $leftCellPadding;
      array[$i    ] = -($glyph.offset.x - $clippedPixels) + this._dimensions.device.char.left;
      array[$i + 1] = -$glyph.offset.y + this._dimensions.device.char.top;
      array[$i + 2] = ($glyph.size.x - $clippedPixels) / this._dimensions.device.canvas.width;
      array[$i + 3] = $glyph.size.y / this._dimensions.device.canvas.height;
      array[$i + 4] = $glyph.texturePage;
      array[$i + 5] = $glyph.texturePositionClipSpace.x + $clippedPixels / this._atlas.pages[$glyph.texturePage].canvas.width;
      array[$i + 6] = $glyph.texturePositionClipSpace.y;
      array[$i + 7] = $glyph.sizeClipSpace.x - $clippedPixels / this._atlas.pages[$glyph.texturePage].canvas.width;
      array[$i + 8] = $glyph.sizeClipSpace.y;
    } else {
      array[$i    ] = -$glyph.offset.x + this._dimensions.device.char.left;
      array[$i + 1] = -$glyph.offset.y + this._dimensions.device.char.top;
      array[$i + 2] = $glyph.size.x / this._dimensions.device.canvas.width;
      array[$i + 3] = $glyph.size.y / this._dimensions.device.canvas.height;
      array[$i + 4] = $glyph.texturePage;
      array[$i + 5] = $glyph.texturePositionClipSpace.x;
      array[$i + 6] = $glyph.texturePositionClipSpace.y;
      array[$i + 7] = $glyph.sizeClipSpace.x;
      array[$i + 8] = $glyph.sizeClipSpace.y;
    }

    if (this._optionsService.rawOptions.rescaleOverlappingGlyphs) {
      if (allowRescaling(code, width, $glyph.size.x, this._dimensions.device.cell.width)) {
        array[$i + 2] = (this._dimensions.device.cell.width - 1) / this._dimensions.device.canvas.width;
      }
    }
  }

  public clear(): void {
    const terminal = this._terminal;
    const newCount = terminal.cols * terminal.rows * INDICES_PER_CELL;

    if (this._vertices.count !== newCount) {
      this._vertices.attributes = new Float32Array(newCount);
    } else {
      this._vertices.attributes.fill(0);
    }
    this._vertices.count = newCount;

    let i = 0;
    for (let y = 0; y < terminal.rows; y++) {
      for (let x = 0; x < terminal.cols; x++) {
        this._vertices.attributes[i + 9] = x / terminal.cols;
        this._vertices.attributes[i + 10] = y / terminal.rows;
        i += INDICES_PER_CELL;
      }
    }
  }

  public handleResize(): void {
    this._updateResolutionUniform();
    this.clear();
  }

  public render(passEncoder: IGPURenderPassEncoder, renderModel: IRenderModel): void {
    if (!this._atlas || !this._bindGroup) {
      return;
    }

    this._syncAtlasTextures();

    let bufferLength = 0;
    for (let y = 0; y < renderModel.lineLengths.length; y++) {
      const si = y * this._terminal.cols * INDICES_PER_CELL;
      const sub = this._vertices.attributes.subarray(si, si + renderModel.lineLengths[y] * INDICES_PER_CELL);
      this._ensureStagingCapacity(bufferLength + sub.length);
      this._stagingAttributes.set(sub, bufferLength);
      bufferLength += sub.length;
    }

    if (bufferLength === 0) {
      return;
    }

    this._ensureInstanceBuffer(bufferLength * Float32Array.BYTES_PER_ELEMENT);
    if (!this._instanceBuffer) {
      return;
    }
    this._device.queue.writeBuffer(this._instanceBuffer, 0, this._stagingAttributes.subarray(0, bufferLength));

    passEncoder.setPipeline(this._pipeline);
    passEncoder.setBindGroup(0, this._bindGroup);
    passEncoder.setVertexBuffer(0, this._unitQuadBuffer);
    passEncoder.setVertexBuffer(1, this._instanceBuffer);
    passEncoder.draw(4, bufferLength / INDICES_PER_CELL, 0, 0);
  }

  public setAtlas(atlas: ITextureAtlas): void {
    this._atlas = atlas;
    for (const tex of this._atlasTextures) {
      tex.version = -1;
    }
  }

  public setDimensions(dimensions: IRenderDimensions): void {
    this._dimensions = dimensions;
  }

  private _ensureStagingCapacity(requiredLength: number): void {
    if (this._stagingAttributes.length >= requiredLength) {
      return;
    }
    const next = new Float32Array(requiredLength);
    next.set(this._stagingAttributes);
    this._stagingAttributes = next;
  }

  private _ensureInstanceBuffer(requiredBytes: number): void {
    if (this._instanceBufferSize >= requiredBytes) {
      return;
    }
    this._instanceBuffer = this._device.createBuffer({
      size: requiredBytes,
      usage: WebgpuBufferUsage.VERTEX | WebgpuBufferUsage.COPY_DST
    });
    this._instanceBufferSize = requiredBytes;
  }

  private _updateResolutionUniform(): void {
    this._uniformData[0] = this._dimensions.device.canvas.width;
    this._uniformData[1] = this._dimensions.device.canvas.height;
    this._uniformData[2] = 0;
    this._uniformData[3] = 0;
    this._device.queue.writeBuffer(this._uniformBuffer, 0, this._uniformData);
  }

  private _createDefaultAtlasTextures(): void {
    const redPixel = new Uint8Array([255, 0, 0, 255]);
    for (let i = 0; i < this._maxAtlasPages; i++) {
      const texture = this._device.createTexture({
        size: { width: 1, height: 1, depthOrArrayLayers: 1 },
        format: 'rgba8unorm',
        usage: WebgpuTextureUsage.TEXTURE_BINDING | WebgpuTextureUsage.COPY_DST
      });
      const view = texture.createView();
      this._device.queue.writeTexture(
        { texture },
        redPixel,
        { bytesPerRow: 4, rowsPerImage: 1 },
        { width: 1, height: 1, depthOrArrayLayers: 1 }
      );
      this._atlasTextures.push({ texture, view, version: -1, width: 1, height: 1 });
    }
  }

  private _createBindGroup(): IGPUBindGroup {
    const entries = [
      {
        binding: 0,
        resource: { buffer: this._uniformBuffer }
      },
      {
        binding: 1,
        resource: this._sampler
      }
    ];
    for (let i = 0; i < this._maxAtlasPages; i++) {
      entries.push({
        binding: 2 + i,
        resource: this._atlasTextures[i].view
      });
    }
    return this._device.createBindGroup({
      layout: this._bindGroupLayout,
      entries
    });
  }

  private _syncAtlasTextures(): void {
    if (!this._atlas) {
      return;
    }

    let needsBindGroup = false;
    for (let i = 0; i < this._atlas.pages.length && i < this._atlasTextures.length; i++) {
      const page = this._atlas.pages[i];
      const existing = this._atlasTextures[i];
      if (existing.width !== page.canvas.width || existing.height !== page.canvas.height) {
        existing.texture.destroy?.();
        const texture = this._device.createTexture({
          size: { width: page.canvas.width, height: page.canvas.height, depthOrArrayLayers: 1 },
          format: 'rgba8unorm',
          usage: WebgpuTextureUsage.TEXTURE_BINDING | WebgpuTextureUsage.COPY_DST
        });
        existing.texture = texture;
        existing.view = texture.createView();
        existing.width = page.canvas.width;
        existing.height = page.canvas.height;
        existing.version = -1;
        needsBindGroup = true;
      }

      if (existing.version !== page.version) {
        this._device.queue.copyExternalImageToTexture(
          { source: page.canvas },
          { texture: existing.texture },
          { width: page.canvas.width, height: page.canvas.height, depthOrArrayLayers: 1 }
        );
        existing.version = page.version;
      }
    }

    if (needsBindGroup) {
      this._bindGroup = this._createBindGroup();
    }
  }
}
