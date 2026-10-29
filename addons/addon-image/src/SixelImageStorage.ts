/**
 * Copyright (c) 2020 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import { ImageStorage, CELL_SIZE_DEFAULT } from './ImageStorage';
import { IImageAddonOptions, ITerminalExt, IAddImageOpts } from './Types';
import { ImageRenderer } from './ImageRenderer';

/**
 * Sixel-specific image storage controller.
 *
 * Wraps the shared ImageStorage with sixel protocol semantics:
 * - Cursor behavior governed by DECSET 80 (sixelScrolling option)
 * - advanceCursor for empty sixels carrying only height
 */
export class SixelImageStorage {
  private _addImageOpts: IAddImageOpts = { scrolling: true, layer: 'top', zIndex: 0, cursorPos: 'vt340' };
  constructor(
    private readonly _storage: ImageStorage,
    private readonly _opts: IImageAddonOptions,
    private readonly _renderer: ImageRenderer,
    private readonly _terminal: ITerminalExt
  ) {}

  /**
   * Add a sixel image to storage.
   * Cursor behavior depends on the sixelScrolling option (DECSET 80).
   */
  public addImage(img: HTMLCanvasElement | ImageBitmap): void {
    this._addImageOpts.scrolling = this._opts.sixelScrolling;
    this._storage.addImage(this._toDevicePixels(img), this._addImageOpts);
  }

  /**
   * Scale a decoded sixel (native pixels == CSS pixels) up to device pixels so
   * it keeps its CSS footprint on HiDPI displays, where the image layer renders
   * in device pixels (see ImageRenderer.cellSize). Sixel carries no resolution
   * beyond its own pixels, so this only preserves size, it cannot add detail.
   */
  private _toDevicePixels(img: HTMLCanvasElement | ImageBitmap): HTMLCanvasElement | ImageBitmap {
    const dpr = this._renderer.dpr;
    if (dpr === 1) return img;
    const canvas = ImageRenderer.createCanvas(
      undefined, Math.ceil(img.width * dpr), Math.ceil(img.height * dpr));
    const ctx = canvas.getContext('2d');
    if (!ctx) return img;
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    return canvas;
  }

  /**
   * Only advance text cursor.
   * This is an edge case from empty sixels carrying only a height but no pixels.
   * Partially fixes https://github.com/jerch/xterm-addon-image/issues/37.
   */
  public advanceCursor(height: number): void {
    if (this._opts.sixelScrolling) {
      let cellSize = this._renderer.cellSize;
      if (cellSize.width === -1 || cellSize.height === -1) {
        cellSize = CELL_SIZE_DEFAULT;
      }
      const rows = Math.ceil(height / cellSize.height);
      for (let i = 1; i < rows; ++i) {
        this._terminal._core._inputHandler.lineFeed();
      }
    }
  }
}
