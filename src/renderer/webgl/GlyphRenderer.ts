/**
 * Copyright (c) 2018 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import { createProgram, PROJECTION_MATRIX } from './WebglUtils';
import { IRenderDimensions } from '../Types';
import { ITerminal, IBufferLine } from '../../Types';
import { NULL_CELL_CODE, CHAR_DATA_CHAR_INDEX } from '../../Buffer';
import WebglCharAtlas from './WebglCharAtlas';
import { IWebGL2RenderingContext, IWebGLVertexArrayObject, IRenderModel, IRasterizedGlyph } from './Types';
import { INDICIES_PER_CELL } from './WebglRenderer';
import { COMBINED_CHAR_BIT_MASK } from './RenderModel';

interface IVertices {
  attributes: Float32Array;
  selectionAttributes: Float32Array;
  cellPosition: Float32Array;
  count: number;
}

const enum VertexAttribLocations {
  UNIT_QUAD = 0,
  CELL_POSITION = 1,
  OFFSET = 2,
  SIZE = 3,
  TEXCOORD = 4,
  TEXSIZE = 5
}

const vertexShaderSource = `#version 300 es
layout (location = ${VertexAttribLocations.UNIT_QUAD}) in vec2 a_unitquad;
layout (location = ${VertexAttribLocations.CELL_POSITION}) in vec2 a_cellpos;
layout (location = ${VertexAttribLocations.OFFSET}) in vec2 a_offset;
layout (location = ${VertexAttribLocations.SIZE}) in vec2 a_size;
layout (location = ${VertexAttribLocations.TEXCOORD}) in vec2 a_texcoord;
layout (location = ${VertexAttribLocations.TEXSIZE}) in vec2 a_texsize;

uniform mat4 u_projection;
uniform vec2 u_resolution;

out vec2 v_texcoord;

void main() {
  vec2 zeroToOne = (a_offset / u_resolution) + a_cellpos + (a_unitquad * a_size);
  gl_Position = u_projection * vec4(zeroToOne, 0.0, 1.0);
  v_texcoord = a_texcoord + a_unitquad * a_texsize;
}`;

const fragmentShaderSource = `#version 300 es
precision mediump float;

in vec2 v_texcoord;

uniform sampler2D u_texture;

out vec4 outColor;

void main() {
  outColor = texture(u_texture, v_texcoord);
}`;

const INDICES_PER_CELL = 8;
const BYTES_PER_CELL = INDICES_PER_CELL * Float32Array.BYTES_PER_ELEMENT;

export class GlyphRenderer {
  private _atlas: WebglCharAtlas;

  private _program: WebGLProgram;
  private _vertexArrayObject: IWebGLVertexArrayObject;
  private _projectionLocation: WebGLUniformLocation;
  private _resolutionLocation: WebGLUniformLocation;
  private _textureLocation: WebGLUniformLocation;
  private _atlasTexture: WebGLTexture;
  private _attributesBuffer: WebGLBuffer;
  private _cellPositionBuffer: WebGLBuffer;

  private _lineLengths: Int16Array = new Int16Array(0);
  private _vertices: IVertices = {
    count: 0,
    attributes: new Float32Array(0),
    selectionAttributes: new Float32Array(0),
    cellPosition: new Float32Array(0)
  };

  constructor(
    private _terminal: ITerminal,
    private _gl: IWebGL2RenderingContext,
    private _dimensions: IRenderDimensions
  ) {
    const gl = this._gl;

    this._program = createProgram(gl, vertexShaderSource, fragmentShaderSource);

    // Uniform locations
    this._projectionLocation = gl.getUniformLocation(this._program, 'u_projection');
    this._resolutionLocation = gl.getUniformLocation(this._program, 'u_resolution');
    this._textureLocation = gl.getUniformLocation(this._program, 'u_texture');

    // Create and set the vertex array object
    this._vertexArrayObject = gl.createVertexArray();
    gl.bindVertexArray(this._vertexArrayObject);

    // Setup a_unitquad, this defines the 4 vertices of a rectangle
    const unitQuadVertices = new Float32Array([0, 0, 1, 0, 0, 1, 1, 1]);
    const unitQuadVerticesBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, unitQuadVerticesBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, unitQuadVertices, gl.STATIC_DRAW);
    gl.enableVertexAttribArray(VertexAttribLocations.UNIT_QUAD);
    gl.vertexAttribPointer(VertexAttribLocations.UNIT_QUAD, 2, this._gl.FLOAT, false, 0, 0);

    // Setup the unit quad element array buffer, this points to indices in
    // unitQuadVertuces to allow is to draw 2 triangles from the vertices
    const unitQuadElementIndices = new Uint8Array([0, 1, 3, 0, 2, 3]);
    const elementIndicesBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, elementIndicesBuffer);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, unitQuadElementIndices, gl.STATIC_DRAW);

    // Setup a_cellpos, this is separate as it rarely changed
    this._cellPositionBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this._cellPositionBuffer);
    gl.enableVertexAttribArray(VertexAttribLocations.CELL_POSITION);
    gl.vertexAttribPointer(VertexAttribLocations.CELL_POSITION, 2, gl.FLOAT, false, 0, 0);
    gl.vertexAttribDivisor(VertexAttribLocations.CELL_POSITION, 1);

    // Setup attributes
    this._attributesBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this._attributesBuffer);
    gl.enableVertexAttribArray(VertexAttribLocations.OFFSET);
    gl.vertexAttribPointer(VertexAttribLocations.OFFSET, 2, gl.FLOAT, false, BYTES_PER_CELL, 0);
    gl.vertexAttribDivisor(VertexAttribLocations.OFFSET, 1);
    gl.enableVertexAttribArray(VertexAttribLocations.SIZE);
    gl.vertexAttribPointer(VertexAttribLocations.SIZE, 2, gl.FLOAT, false, BYTES_PER_CELL, 2 * Float32Array.BYTES_PER_ELEMENT);
    gl.vertexAttribDivisor(VertexAttribLocations.SIZE, 1);
    gl.enableVertexAttribArray(VertexAttribLocations.TEXCOORD);
    gl.vertexAttribPointer(VertexAttribLocations.TEXCOORD, 2, gl.FLOAT, false, BYTES_PER_CELL, 4 * Float32Array.BYTES_PER_ELEMENT);
    gl.vertexAttribDivisor(VertexAttribLocations.TEXCOORD, 1);
    gl.enableVertexAttribArray(VertexAttribLocations.TEXSIZE);
    gl.vertexAttribPointer(VertexAttribLocations.TEXSIZE, 2, gl.FLOAT, false, BYTES_PER_CELL, 6 * Float32Array.BYTES_PER_ELEMENT);
    gl.vertexAttribDivisor(VertexAttribLocations.TEXSIZE, 1);

    // Setup empty texture atlas
    this._atlasTexture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, this._atlasTexture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([0, 0, 255, 255]));
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

    // Allow drawing of transparent texture
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

    // Set viewport
    this.onResize();
  }

  public beginFrame(): boolean {
    return this._atlas.beginFrame();
  }

  public updateCell(x: number, y: number, code: number, attr: number, bg: number, fg: number, chars: string): void {
    this._updateCell(this._vertices.attributes, x, y, code, attr, bg, fg, chars);
  }

  private _updateCell(array: Float32Array, x: number, y: number, code: number | undefined, attr: number, bg: number, fg: number, chars?: string): void {
    const terminal = this._terminal;

    const i = ((y * terminal.cols) + x) * INDICES_PER_CELL;

    // Exit early if this is a null/space character
    if (code === NULL_CELL_CODE || code === undefined/* This is used for the right side of wide chars */) {
      array.fill(0, i, i + INDICES_PER_CELL - 1);
      return;
    }

    let rasterizedGlyph: IRasterizedGlyph;
    if (chars && chars.length > 1) {
      rasterizedGlyph = this._atlas.getRasterizedGlyphCombinedChar(chars, attr, bg, fg, this._terminal.options.enableBold);
    } else {
      rasterizedGlyph = this._atlas.getRasterizedGlyph(code, attr, bg, fg, this._terminal.options.enableBold);
    }

    // Fill empty if no glyph was found
    if (!rasterizedGlyph) {
      array.fill(0, i, i + INDICES_PER_CELL - 1);
      return;
    }

    // a_origin
    array[i    ] = -rasterizedGlyph.offset.x + this._dimensions.scaledCharLeft;
    array[i + 1] = -rasterizedGlyph.offset.y + this._dimensions.scaledCharTop;
    // a_size
    array[i + 2] = rasterizedGlyph.size.x / this._dimensions.scaledCanvasWidth;
    array[i + 3] = rasterizedGlyph.size.y / this._dimensions.scaledCanvasHeight;
    // a_texcoord
    array[i + 4] = rasterizedGlyph.texturePositionClipSpace.x;
    array[i + 5] = rasterizedGlyph.texturePositionClipSpace.y;
    // a_texsize
    array[i + 6] = rasterizedGlyph.sizeClipSpace.x;
    array[i + 7] = rasterizedGlyph.sizeClipSpace.y;
  }

  public updateLineEnd(x: number, y: number): void {
    // Clears all cells to the right of the line end
    const i = (y * this._terminal.cols + x + 1) * INDICES_PER_CELL;
    this._vertices.attributes.fill(0, i, i + (this._terminal.cols - this._lineLengths[y]) * INDICES_PER_CELL - 1);
  }

  public updateSelection(model: IRenderModel, columnSelectMode: boolean): void {
    const terminal = this._terminal;

    this._vertices.selectionAttributes = this._vertices.attributes.slice(0);

    // TODO: Make fg and bg configurable, currently since the buffer doesn't
    // support truecolor the char atlas cannot store it.
    const fg = 0;
    const bg = 7;

    if (columnSelectMode) {
      const startCol = model.selection.startCol;
      const width = model.selection.endCol - startCol;
      const height = model.selection.viewportCappedEndRow - model.selection.viewportCappedStartRow + 1;
      for (let y = model.selection.viewportCappedStartRow; y < model.selection.viewportCappedStartRow + height; y++) {
        this._updateSelectionRange(startCol, startCol + width, y, model, bg, fg);
      }
    } else {
      // Draw first row
      const startCol = model.selection.viewportStartRow === model.selection.viewportCappedStartRow ? model.selection.startCol : 0;
      const startRowEndCol = model.selection.viewportCappedStartRow === model.selection.viewportCappedEndRow ? model.selection.endCol : terminal.cols;
      this._updateSelectionRange(startCol, startRowEndCol, model.selection.viewportCappedStartRow, model, bg, fg);

      // Draw middle rows
      const middleRowsCount = Math.max(model.selection.viewportCappedEndRow - model.selection.viewportCappedStartRow - 1, 0);
      for (let y = (model.selection.viewportCappedStartRow + 1); y <= model.selection.viewportCappedStartRow + middleRowsCount; y++) {
        this._updateSelectionRange(0, startRowEndCol, y, model, bg, fg);
      }

      // Draw final row
      if (model.selection.viewportCappedStartRow !== model.selection.viewportCappedEndRow) {
        // Only draw viewportEndRow if it's not the same as viewportStartRow
        const endCol = model.selection.viewportEndRow === model.selection.viewportCappedEndRow ? model.selection.endCol : terminal.cols;
        this._updateSelectionRange(0, endCol, model.selection.viewportCappedEndRow, model, bg, fg);
      }
    }
  }

  private _updateSelectionRange(startCol: number, endCol: number, y: number, model: IRenderModel, bg: number, fg: number): void {
    const terminal = this._terminal;
    const row = y + terminal.buffer.ydisp;
    let line: IBufferLine;
    for (let x = startCol; x < endCol; x++) {
      const offset = (y * this._terminal.cols + x) * INDICIES_PER_CELL;
      // Because the cache uses attr as a lookup key it needs to contain the selection colors as well
      let attr = model.cells[offset + 1];
      attr = attr & ~0x3ffff | bg << 9 | fg;
      const code = model.cells[offset];
      if (code & COMBINED_CHAR_BIT_MASK) {
        if (!line) {
          line = terminal.buffer.lines.get(row);
        }
        const charData = line.get(x);
        const chars = charData[CHAR_DATA_CHAR_INDEX];
        this._updateCell(this._vertices.selectionAttributes, x, y, model.cells[offset], attr, bg, fg, chars);
      } else {
        this._updateCell(this._vertices.selectionAttributes, x, y, model.cells[offset], attr, bg, fg);
      }
    }
  }

  public onResize(): void {
    const terminal = this._terminal;
    const gl = this._gl;

    gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);

    // Update vertices
    const newCount = terminal.cols * terminal.rows * INDICES_PER_CELL;
    if (this._vertices.count !== newCount) {
      this._vertices.count = newCount;
      this._vertices.attributes = new Float32Array(newCount);
      this._lineLengths = new Int16Array(terminal.rows);

      this._vertices.cellPosition = new Float32Array(terminal.cols * terminal.rows * 2);

      let i = 0;
      for (let y = 0; y < terminal.rows; y++) {
        for (let x = 0; x < terminal.cols; x++) {
          this._vertices.cellPosition[i++] = x / terminal.cols;
          this._vertices.cellPosition[i++] = y / terminal.rows;
        }
      }
    }
  }

  public onThemeChanged(): void {
  }

  public render(isSelectionVisible: boolean): void {
    if (!this._atlas) {
      return;
    }

    const gl = this._gl;

    gl.useProgram(this._program);
    gl.bindVertexArray(this._vertexArrayObject);

    gl.bindBuffer(gl.ARRAY_BUFFER, this._cellPositionBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, this._vertices.cellPosition, gl.STATIC_DRAW);
    gl.bindBuffer(gl.ARRAY_BUFFER, this._attributesBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, isSelectionVisible ? this._vertices.selectionAttributes : this._vertices.attributes, gl.DYNAMIC_DRAW);

    // Bind the texture atlas if it's changed
    if (this._atlas.hasCanvasChanged) {
      this._atlas.hasCanvasChanged = false;
      gl.uniform1i(this._textureLocation, 0);
      gl.activeTexture(gl.TEXTURE0 + 0);
      gl.bindTexture(gl.TEXTURE_2D, this._atlasTexture);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, this._atlas.cacheCanvas);
      gl.generateMipmap(gl.TEXTURE_2D);
    }

    // Set uniforms
    gl.uniformMatrix4fv(this._projectionLocation, false, PROJECTION_MATRIX);
    gl.uniform2f(this._resolutionLocation, gl.canvas.width, gl.canvas.height);

    // Draw the viewport
    gl.drawElementsInstanced(gl.TRIANGLES, 6, gl.UNSIGNED_BYTE, 0, this._vertices.count / INDICES_PER_CELL);
  }

  public setAtlas(atlas: WebglCharAtlas): void {
    const gl = this._gl;
    this._atlas = atlas;

    gl.bindTexture(gl.TEXTURE_2D, this._atlasTexture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, atlas.cacheCanvas);
    gl.generateMipmap(gl.TEXTURE_2D);
  }

  public setDimensions(dimensions: IRenderDimensions): void {
    this._dimensions = dimensions;
  }
}
