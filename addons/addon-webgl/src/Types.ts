/**
 * Copyright (c) 2018 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import { FontWeight } from '@xterm/xterm';
import { IColorSet } from 'browser/Types';
import { ISelectionRenderModel } from 'browser/renderer/shared/Types';
import { CursorInactiveStyle, CursorStyle, type IDisposable } from 'common/Types';
import type { IEvent } from 'common/Event';

export interface IRenderModel {
  cells: Uint32Array;
  lineLengths: Uint32Array;
  selection: ISelectionRenderModel;
  cursor?: ICursorRenderModel;
}

export interface ICursorRenderModel {
  x: number;
  y: number;
  width: number;
  style: CursorStyle | CursorInactiveStyle;
  cursorWidth: number;
  dpr: number;
}

export interface IWebGL2RenderingContext extends WebGLRenderingContext {
  vertexAttribDivisor(index: number, divisor: number): void;
  createVertexArray(): IWebGLVertexArrayObject;
  deleteVertexArray(vao: IWebGLVertexArrayObject): void;
  bindVertexArray(vao: IWebGLVertexArrayObject): void;
  drawElementsInstanced(mode: number, count: number, type: number, offset: number, instanceCount: number): void;
}

export interface IWebGLVertexArrayObject {
}

export interface ICharAtlasConfig {
  customGlyphs: boolean;
  devicePixelRatio: number;
  deviceMaxTextureSize: number;
  letterSpacing: number;
  lineHeight: number;
  fontSize: number;
  fontFamily: string;
  fontWeight: FontWeight;
  fontWeightBold: FontWeight;
  deviceCellWidth: number;
  deviceCellHeight: number;
  deviceCharWidth: number;
  deviceCharHeight: number;
  allowTransparency: boolean;
  drawBoldTextInBrightColors: boolean;
  minimumContrastRatio: number;
  colors: IColorSet;
}

export interface ITextureAtlas extends IDisposable {
  readonly pages: { canvas: HTMLCanvasElement, version: number }[];

  onAddTextureAtlasCanvas: IEvent<HTMLCanvasElement>;
  onRemoveTextureAtlasCanvas: IEvent<HTMLCanvasElement>;

  /**
   * Warm up the texture atlas, adding common glyphs to avoid slowing early frame.
   */
  warmUp(): void;

  /**
   * Bumped when atlas page layout changes require renderer models to clear.
   * Renderers compare this against their last handled generation.
   */
  readonly clearModelGeneration: number;

  /**
   * Clear all glyphs from the texture atlas.
   */
  clearTexture(): void;
  getRasterizedGlyph(code: number, bg: number, fg: number, ext: number, restrictToCellHeight: boolean, domContainer: HTMLElement | undefined): IRasterizedGlyph;
  getRasterizedGlyphCombinedChar(chars: string, bg: number, fg: number, ext: number, restrictToCellHeight: boolean, domContainer: HTMLElement | undefined): IRasterizedGlyph;
}

/**
 * Represents a rasterized glyph within a texture atlas. Some numbers are
 * tracked in CSS pixels as well in order to reduce calculations during the
 * render loop.
 */
export interface IRasterizedGlyph {
  /**
   * The x and y offset between the glyph's top/left and the top/left of a cell
   * in pixels.
   */
  offset: IVector;
  /**
   * The index of the texture page that the glyph is on.
   */
  texturePage: number;
  /**
   * the x and y position of the glyph in the texture in pixels.
   */
  texturePosition: IVector;
  /**
   * the x and y position of the glyph in the texture in clip space coordinates.
   */
  texturePositionClipSpace: IVector;
  /**
   * The width and height of the glyph in the texture in pixels.
   */
  size: IVector;
  /**
   * The width and height of the glyph in the texture in clip space coordinates.
   */
  sizeClipSpace: IVector;
}

export interface IVector {
  x: number;
  y: number;
}

export interface IBoundingBox {
  top: number;
  left: number;
  right: number;
  bottom: number;
}
