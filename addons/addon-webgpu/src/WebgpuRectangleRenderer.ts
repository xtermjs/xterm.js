/**
 * Copyright (c) 2026 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import { IRenderDimensions } from 'browser/renderer/shared/Types';
import { IThemeService } from 'browser/services/Services';
import { ReadonlyColorSet } from 'browser/Types';
import { Attributes, FgFlags } from 'common/buffer/Constants';
import { IColor } from 'common/Types';
import { Terminal } from '@xterm/xterm';
import { Disposable, toDisposable } from 'common/Lifecycle';
import { RENDER_MODEL_BG_OFFSET, RENDER_MODEL_FG_OFFSET, RENDER_MODEL_INDICIES_PER_CELL } from '../../addon-webgl/src/RenderModel';
import { IRenderModel } from '../../addon-webgl/src/Types';
import { expandFloat32Array } from '../../addon-webgl/src/WebglUtils';
import type { IGPUDevice, IGPURenderPassEncoder, IGPUTextureFormat, IGPURenderPipeline, IGPUBuffer } from './WebgpuTypes';
import { WebgpuBufferUsage, WebgpuColorWriteMask } from './WebgpuUtils';

const enum VertexAttribLocations {
  UNIT_QUAD = 0,
  POSITION = 1,
  SIZE = 2,
  COLOR = 3
}

const INDICES_PER_RECTANGLE = 8;
const BYTES_PER_RECTANGLE = INDICES_PER_RECTANGLE * Float32Array.BYTES_PER_ELEMENT;
const INITIAL_BUFFER_RECTANGLE_CAPACITY = 20 * INDICES_PER_RECTANGLE;

class Vertices {
  public attributes: Float32Array;
  public count: number;

  constructor() {
    this.attributes = new Float32Array(INITIAL_BUFFER_RECTANGLE_CAPACITY);
    this.count = 0;
  }
}

// Work variables to avoid garbage collection
let $rgba = 0;
let $x1 = 0;
let $y1 = 0;
let $r = 0;
let $g = 0;
let $b = 0;
let $a = 0;

function createRectangleShaderSource(): string {
  return `
struct VertexIn {
  @location(${VertexAttribLocations.UNIT_QUAD}) unitQuad: vec2<f32>,
  @location(${VertexAttribLocations.POSITION}) position: vec2<f32>,
  @location(${VertexAttribLocations.SIZE}) size: vec2<f32>,
  @location(${VertexAttribLocations.COLOR}) color: vec4<f32>,
};

struct VertexOut {
  @builtin(position) position: vec4<f32>,
  @location(0) color: vec4<f32>,
};

@vertex
fn vs_main(input: VertexIn) -> VertexOut {
  var out: VertexOut;
  let zeroToOne = input.position + (input.unitQuad * input.size);
  let clip = vec2<f32>(zeroToOne.x * 2.0 - 1.0, 1.0 - zeroToOne.y * 2.0);
  out.position = vec4<f32>(clip, 0.0, 1.0);
  out.color = input.color;
  return out;
}

@fragment
fn fs_main(input: VertexOut) -> @location(0) vec4<f32> {
  return input.color;
}
`;
}

export class WebgpuRectangleRenderer extends Disposable {
  private readonly _pipeline: IGPURenderPipeline;
  private readonly _unitQuadBuffer: IGPUBuffer;
  private _instanceBuffer: IGPUBuffer | undefined;
  private _instanceBufferSize: number = 0;

  private _bgFloat!: Float32Array;
  private _cursorFloat!: Float32Array;

  private _vertices: Vertices = new Vertices();
  private _verticesCursor: Vertices = new Vertices();

  constructor(
    private readonly _terminal: Terminal,
    private readonly _device: IGPUDevice,
    private readonly _format: IGPUTextureFormat,
    private _dimensions: IRenderDimensions,
    private readonly _themeService: IThemeService
  ) {
    super();
    const unitQuadVertices = new Float32Array([0, 0, 1, 0, 0, 1, 1, 1]);
    this._unitQuadBuffer = this._device.createBuffer({
      size: unitQuadVertices.byteLength,
      usage: WebgpuBufferUsage.VERTEX | WebgpuBufferUsage.COPY_DST
    });
    this._device.queue.writeBuffer(this._unitQuadBuffer, 0, unitQuadVertices);

    const shaderModule = this._device.createShaderModule({ code: createRectangleShaderSource() });
    this._pipeline = this._device.createRenderPipeline({
      layout: 'auto',
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
            arrayStride: BYTES_PER_RECTANGLE,
            stepMode: 'instance',
            attributes: [
              { shaderLocation: VertexAttribLocations.POSITION, offset: 0, format: 'float32x2' },
              { shaderLocation: VertexAttribLocations.SIZE, offset: 8, format: 'float32x2' },
              { shaderLocation: VertexAttribLocations.COLOR, offset: 16, format: 'float32x4' }
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

    this._updateCachedColors(_themeService.colors);
    this._register(this._themeService.onChangeColors(e => {
      this._updateCachedColors(e);
      this._updateViewportRectangle();
    }));

    this._register(toDisposable(() => {
      this._unitQuadBuffer.destroy?.();
      this._instanceBuffer?.destroy?.();
    }));
  }

  public renderBackgrounds(passEncoder: IGPURenderPassEncoder): void {
    this._renderVertices(passEncoder, this._vertices);
  }

  public renderCursor(passEncoder: IGPURenderPassEncoder): void {
    this._renderVertices(passEncoder, this._verticesCursor);
  }

  private _renderVertices(passEncoder: IGPURenderPassEncoder, vertices: Vertices): void {
    if (vertices.count === 0) {
      return;
    }

    const byteLength = vertices.count * INDICES_PER_RECTANGLE * Float32Array.BYTES_PER_ELEMENT;
    this._ensureInstanceBuffer(byteLength);
    if (!this._instanceBuffer) {
      return;
    }
    this._device.queue.writeBuffer(this._instanceBuffer, 0, vertices.attributes.subarray(0, vertices.count * INDICES_PER_RECTANGLE));

    passEncoder.setPipeline(this._pipeline);
    passEncoder.setVertexBuffer(0, this._unitQuadBuffer);
    passEncoder.setVertexBuffer(1, this._instanceBuffer);
    passEncoder.draw(4, vertices.count, 0, 0);
  }

  public handleResize(): void {
    this._updateViewportRectangle();
  }

  public setDimensions(dimensions: IRenderDimensions): void {
    this._dimensions = dimensions;
  }

  private _updateCachedColors(colors: ReadonlyColorSet): void {
    this._bgFloat = this._colorToFloat32Array(colors.background);
    this._cursorFloat = this._colorToFloat32Array(colors.cursor);
  }

  private _updateViewportRectangle(): void {
    this._addRectangleFloat(
      this._vertices.attributes,
      0,
      0,
      0,
      this._terminal.cols * this._dimensions.device.cell.width,
      this._terminal.rows * this._dimensions.device.cell.height,
      this._bgFloat
    );
  }

  public updateBackgrounds(model: IRenderModel): void {
    const terminal = this._terminal;
    const vertices = this._vertices;

    let rectangleCount = 1;
    let y: number;
    let x: number;
    let currentStartX: number;
    let currentBg: number;
    let currentFg: number;
    let currentInverse: boolean;
    let modelIndex: number;
    let bg: number;
    let fg: number;
    let inverse: boolean;
    let offset: number;

    for (y = 0; y < terminal.rows; y++) {
      currentStartX = -1;
      currentBg = 0;
      currentFg = 0;
      currentInverse = false;
      for (x = 0; x < terminal.cols; x++) {
        modelIndex = ((y * terminal.cols) + x) * RENDER_MODEL_INDICIES_PER_CELL;
        bg = model.cells[modelIndex + RENDER_MODEL_BG_OFFSET];
        fg = model.cells[modelIndex + RENDER_MODEL_FG_OFFSET];
        inverse = !!(fg & FgFlags.INVERSE);
        if (bg !== currentBg || (fg !== currentFg && (currentInverse || inverse))) {
          if (currentBg !== 0 || (currentInverse && currentFg !== 0)) {
            offset = rectangleCount++ * INDICES_PER_RECTANGLE;
            this._updateRectangle(vertices, offset, currentFg, currentBg, currentStartX, x, y);
          }
          currentStartX = x;
          currentBg = bg;
          currentFg = fg;
          currentInverse = inverse;
        }
      }
      if (currentBg !== 0 || (currentInverse && currentFg !== 0)) {
        offset = rectangleCount++ * INDICES_PER_RECTANGLE;
        this._updateRectangle(vertices, offset, currentFg, currentBg, currentStartX, terminal.cols, y);
      }
    }
    vertices.count = rectangleCount;
  }

  public updateCursor(model: IRenderModel): void {
    const vertices = this._verticesCursor;
    const cursor = model.cursor;
    if (!cursor || cursor.style === 'block') {
      vertices.count = 0;
      return;
    }

    let offset: number;
    let rectangleCount = 0;

    if (cursor.style === 'bar' || cursor.style === 'outline') {
      offset = rectangleCount++ * INDICES_PER_RECTANGLE;
      this._addRectangleFloat(
        vertices.attributes,
        offset,
        cursor.x * this._dimensions.device.cell.width,
        cursor.y * this._dimensions.device.cell.height,
        cursor.style === 'bar' ? cursor.dpr * cursor.cursorWidth : cursor.dpr,
        this._dimensions.device.cell.height,
        this._cursorFloat
      );
    }
    if (cursor.style === 'underline' || cursor.style === 'outline') {
      offset = rectangleCount++ * INDICES_PER_RECTANGLE;
      this._addRectangleFloat(
        vertices.attributes,
        offset,
        cursor.x * this._dimensions.device.cell.width,
        (cursor.y + 1) * this._dimensions.device.cell.height - cursor.dpr,
        cursor.width * this._dimensions.device.cell.width,
        cursor.dpr,
        this._cursorFloat
      );
    }
    if (cursor.style === 'outline') {
      offset = rectangleCount++ * INDICES_PER_RECTANGLE;
      this._addRectangleFloat(
        vertices.attributes,
        offset,
        cursor.x * this._dimensions.device.cell.width,
        cursor.y * this._dimensions.device.cell.height,
        cursor.width * this._dimensions.device.cell.width,
        cursor.dpr,
        this._cursorFloat
      );
      offset = rectangleCount++ * INDICES_PER_RECTANGLE;
      this._addRectangleFloat(
        vertices.attributes,
        offset,
        (cursor.x + cursor.width) * this._dimensions.device.cell.width - cursor.dpr,
        cursor.y * this._dimensions.device.cell.height,
        cursor.dpr,
        this._dimensions.device.cell.height,
        this._cursorFloat
      );
    }

    vertices.count = rectangleCount;
  }

  private _updateRectangle(vertices: Vertices, offset: number, fg: number, bg: number, startX: number, endX: number, y: number): void {
    if (fg & FgFlags.INVERSE) {
      switch (fg & Attributes.CM_MASK) {
        case Attributes.CM_P16:
        case Attributes.CM_P256:
          $rgba = this._themeService.colors.ansi[fg & Attributes.PCOLOR_MASK].rgba;
          break;
        case Attributes.CM_RGB:
          $rgba = (fg & Attributes.RGB_MASK) << 8;
          break;
        case Attributes.CM_DEFAULT:
        default:
          $rgba = this._themeService.colors.foreground.rgba;
      }
    } else {
      switch (bg & Attributes.CM_MASK) {
        case Attributes.CM_P16:
        case Attributes.CM_P256:
          $rgba = this._themeService.colors.ansi[bg & Attributes.PCOLOR_MASK].rgba;
          break;
        case Attributes.CM_RGB:
          $rgba = (bg & Attributes.RGB_MASK) << 8;
          break;
        case Attributes.CM_DEFAULT:
        default:
          $rgba = this._themeService.colors.background.rgba;
      }
    }

    if (vertices.attributes.length < offset + 4) {
      vertices.attributes = expandFloat32Array(vertices.attributes, this._terminal.rows * this._terminal.cols * INDICES_PER_RECTANGLE);
    }
    $x1 = startX * this._dimensions.device.cell.width;
    $y1 = y * this._dimensions.device.cell.height;
    $r = (($rgba >> 24) & 0xFF) / 255;
    $g = (($rgba >> 16) & 0xFF) / 255;
    $b = (($rgba >> 8 ) & 0xFF) / 255;
    $a = 1;

    this._addRectangle(vertices.attributes, offset, $x1, $y1, (endX - startX) * this._dimensions.device.cell.width, this._dimensions.device.cell.height, $r, $g, $b, $a);
  }

  private _addRectangle(array: Float32Array, offset: number, x1: number, y1: number, width: number, height: number, r: number, g: number, b: number, a: number): void {
    array[offset    ] = x1 / this._dimensions.device.canvas.width;
    array[offset + 1] = y1 / this._dimensions.device.canvas.height;
    array[offset + 2] = width / this._dimensions.device.canvas.width;
    array[offset + 3] = height / this._dimensions.device.canvas.height;
    array[offset + 4] = r;
    array[offset + 5] = g;
    array[offset + 6] = b;
    array[offset + 7] = a;
  }

  private _addRectangleFloat(array: Float32Array, offset: number, x1: number, y1: number, width: number, height: number, color: Float32Array): void {
    array[offset    ] = x1 / this._dimensions.device.canvas.width;
    array[offset + 1] = y1 / this._dimensions.device.canvas.height;
    array[offset + 2] = width / this._dimensions.device.canvas.width;
    array[offset + 3] = height / this._dimensions.device.canvas.height;
    array[offset + 4] = color[0];
    array[offset + 5] = color[1];
    array[offset + 6] = color[2];
    array[offset + 7] = color[3];
  }

  private _colorToFloat32Array(color: IColor): Float32Array {
    return new Float32Array([
      ((color.rgba >> 24) & 0xFF) / 255,
      ((color.rgba >> 16) & 0xFF) / 255,
      ((color.rgba >> 8 ) & 0xFF) / 255,
      ((color.rgba      ) & 0xFF) / 255
    ]);
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
}
