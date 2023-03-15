/**
 * Copyright (c) 2019 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import { IDisposable } from 'common/Types';
import { IEvent } from 'common/EventEmitter';
import { IRenderDimensions } from 'browser/renderer/shared/Types';

export interface IRequestRedrawEvent {
  start: number;
  end: number;
}

/**
 * Note that IRenderer implementations should emit the refresh event after
 * rendering rows to the screen.
 */
export interface IRenderer extends IDisposable {
  readonly dimensions: IRenderDimensions;

  /**
   * Fires when the renderer is requesting to be redrawn on the next animation
   * frame but is _not_ a result of content changing (eg. selection changes).
   */
  readonly onRequestRedraw: IEvent<IRequestRedrawEvent>;

  handleDevicePixelRatioChange(): void;
  handleResize(cols: number, rows: number): void;
  handleCharSizeChanged(): void;
  handleBlur(): void;
  handleFocus(): void;
  handleSelectionChanged(start: [number, number] | undefined, end: [number, number] | undefined, columnSelectMode: boolean): void;
  handleCursorMove(): void;
  handleOptionsChanged(): void;
  clear(): void;
  renderRows(start: number, end: number): void;
  clearTextureAtlas?(): void;
}

export interface IRenderLayer extends IDisposable {
  readonly canvas: HTMLCanvasElement;
  readonly cacheCanvas: HTMLCanvasElement;

  readonly onAddTextureAtlasCanvas: IEvent<HTMLCanvasElement>;
  /**
   * Called when the terminal loses focus.
   */
  handleBlur(): void;

  /**
   * Called when the terminal gets focus.
   */
  handleFocus(): void;

  /**
   * Called when the cursor is moved.
   */
  handleCursorMove(): void;

  /**
   * Called when the data in the grid has changed (or needs to be rendered
   * again).
   */
  handleGridChanged(startRow: number, endRow: number): void;

  /**
   * Calls when the selection changes.
   */
  handleSelectionChanged(start: [number, number] | undefined, end: [number, number] | undefined, columnSelectMode: boolean): void;

  /**
   * Resize the render layer.
   */
  resize(dim: IRenderDimensions): void;

  /**
   * Clear the state of the render layer.
   */
  reset(): void;

  /**
   * Clears the texture atlas.
   */
  clearTextureAtlas(): void;
}
