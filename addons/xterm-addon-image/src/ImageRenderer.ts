/**
 * Copyright (c) 2020 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import { toRGBA8888 } from 'sixel/lib/Colors';
import { IDisposable } from '@xterm/xterm';
import { ICellSize, ITerminalExt, IImageSpec, IRenderDimensions, IRenderService } from './Types';
import { Disposable, MutableDisposable, toDisposable } from 'common/Lifecycle';


const PLACEHOLDER_LENGTH = 4096;
const PLACEHOLDER_HEIGHT = 24;

/**
 * ImageRenderer - terminal frontend extension:
 * - provide primitives for canvas, ImageData, Bitmap (static)
 * - add canvas layer to DOM (browser only for now)
 * - draw image tiles onRender
 */
export class ImageRenderer extends Disposable implements IDisposable {
  public canvas: HTMLCanvasElement | undefined;
  private _ctx: CanvasRenderingContext2D | null | undefined;
  private _placeholder: HTMLCanvasElement | undefined;
  private _placeholderBitmap: ImageBitmap | undefined;
  private _optionsRefresh = this.register(new MutableDisposable());
  private _oldOpen: ((parent: HTMLElement) => void) | undefined;
  private _renderService: IRenderService | undefined;
  private _oldSetRenderer: ((renderer: any) => void) | undefined;

  // drawing primitive - canvas
  public static createCanvas(localDocument: Document | undefined, width: number, height: number): HTMLCanvasElement {
    /**
     * NOTE: We normally dont care, from which document the canvas
     * gets created, so we can fall back to global document,
     * if the terminal has no document associated yet.
     * This way early image loads before calling .open keep working
     * (still discouraged though, as the metrics will be screwed up).
     * Only the DOM output canvas should be on the terminal's document,
     * which gets explicitly checked in `insertLayerToDom`.
     */
    const canvas = (localDocument || document).createElement('canvas');
    canvas.width = width | 0;
    canvas.height = height | 0;
    return canvas;
  }

  // drawing primitive - ImageData with optional buffer
  public static createImageData(ctx: CanvasRenderingContext2D, width: number, height: number, buffer?: ArrayBuffer): ImageData {
    if (typeof ImageData !== 'function') {
      const imgData = ctx.createImageData(width, height);
      if (buffer) {
        imgData.data.set(new Uint8ClampedArray(buffer, 0, width * height * 4));
      }
      return imgData;
    }
    return buffer
      ? new ImageData(new Uint8ClampedArray(buffer, 0, width * height * 4), width, height)
      : new ImageData(width, height);
  }

  // drawing primitive - ImageBitmap
  public static createImageBitmap(img: ImageBitmapSource): Promise<ImageBitmap | undefined> {
    if (typeof createImageBitmap !== 'function') {
      return Promise.resolve(undefined);
    }
    return createImageBitmap(img);
  }


  constructor(private _terminal: ITerminalExt) {
    super();
    this._oldOpen = this._terminal._core.open;
    this._terminal._core.open = (parent: HTMLElement): void => {
      this._oldOpen?.call(this._terminal._core, parent);
      this._open();
    };
    if (this._terminal._core.screenElement) {
      this._open();
    }
    // hack to spot fontSize changes
    this._optionsRefresh.value = this._terminal._core.optionsService.onOptionChange(option => {
      if (option === 'fontSize') {
        this.rescaleCanvas();
        this._renderService?.refreshRows(0, this._terminal.rows);
      }
    });
    this.register(toDisposable(() => {
      this.removeLayerFromDom();
      if (this._terminal._core && this._oldOpen) {
        this._terminal._core.open = this._oldOpen;
        this._oldOpen = undefined;
      }
      if (this._renderService && this._oldSetRenderer) {
        this._renderService.setRenderer = this._oldSetRenderer;
        this._oldSetRenderer = undefined;
      }
      this._renderService = undefined;
      this.canvas = undefined;
      this._ctx = undefined;
      this._placeholderBitmap?.close();
      this._placeholderBitmap = undefined;
      this._placeholder = undefined;
    }));
  }

  /**
   * Enable the placeholder.
   */
  public showPlaceholder(value: boolean): void {
    if (value) {
      if (!this._placeholder && this.cellSize.height !== -1) {
        this._createPlaceHolder(Math.max(this.cellSize.height + 1, PLACEHOLDER_HEIGHT));
      }
    } else {
      this._placeholderBitmap?.close();
      this._placeholderBitmap = undefined;
      this._placeholder = undefined;
    }
    this._renderService?.refreshRows(0, this._terminal.rows);
  }

  /**
   * Dimensions of the terminal.
   * Forwarded from internal render service.
   */
  public get dimensions(): IRenderDimensions | undefined {
    return this._renderService?.dimensions;
  }

  /**
   * Current cell size (float).
   */
  public get cellSize(): ICellSize {
    return {
      width: this.dimensions?.css.cell.width || -1,
      height: this.dimensions?.css.cell.height || -1
    };
  }

  /**
   * Clear a region of the image layer canvas.
   */
  public clearLines(start: number, end: number): void {
    this._ctx?.clearRect(
      0,
      start * (this.dimensions?.css.cell.height || 0),
      this.dimensions?.css.canvas.width || 0,
      (++end - start) * (this.dimensions?.css.cell.height || 0)
    );
  }

  /**
   * Clear whole image canvas.
   */
  public clearAll(): void {
    this._ctx?.clearRect(0, 0, this.canvas?.width || 0, this.canvas?.height || 0);
  }

  /**
   * Draw neighboring tiles on the image layer canvas.
   */
  public draw(imgSpec: IImageSpec, tileId: number, col: number, row: number, count: number = 1): void {
    if (!this._ctx) {
      return;
    }
    const { width, height } = this.cellSize;

    // Don't try to draw anything, if we cannot get valid renderer metrics.
    if (width === -1 || height === -1) {
      return;
    }

    this._rescaleImage(imgSpec, width, height);
    const img = imgSpec.actual!;
    const cols = Math.ceil(img.width / width);

    const sx = (tileId % cols) * width;
    const sy = Math.floor(tileId / cols) * height;
    const dx = col * width;
    const dy = row * height;

    // safari bug: never access image source out of bounds
    const finalWidth = count * width + sx > img.width ? img.width - sx : count * width;
    const finalHeight = sy + height > img.height ? img.height - sy : height;

    // Floor all pixel offsets to get stable tile mapping without any overflows.
    // Note: For not pixel perfect aligned cells like in the DOM renderer
    // this will move a tile slightly to the top/left (subpixel range, thus ignore it).
    // FIX #34: avoid striping on displays with pixelDeviceRatio != 1 by ceiling height and width
    this._ctx.drawImage(
      img,
      Math.floor(sx), Math.floor(sy), Math.ceil(finalWidth), Math.ceil(finalHeight),
      Math.floor(dx), Math.floor(dy), Math.ceil(finalWidth), Math.ceil(finalHeight)
    );
  }

  /**
   * Extract a single tile from an image.
   */
  public extractTile(imgSpec: IImageSpec, tileId: number): HTMLCanvasElement | undefined {
    const { width, height } = this.cellSize;
    // Don't try to draw anything, if we cannot get valid renderer metrics.
    if (width === -1 || height === -1) {
      return;
    }
    this._rescaleImage(imgSpec, width, height);
    const img = imgSpec.actual!;
    const cols = Math.ceil(img.width / width);
    const sx = (tileId % cols) * width;
    const sy = Math.floor(tileId / cols) * height;
    const finalWidth = width + sx > img.width ? img.width - sx : width;
    const finalHeight = sy + height > img.height ? img.height - sy : height;

    const canvas = ImageRenderer.createCanvas(this.document, finalWidth, finalHeight);
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.drawImage(
        img,
        Math.floor(sx), Math.floor(sy), Math.floor(finalWidth), Math.floor(finalHeight),
        0, 0, Math.floor(finalWidth), Math.floor(finalHeight)
      );
      return canvas;
    }
  }

  /**
   * Draw a line with placeholder on the image layer canvas.
   */
  public drawPlaceholder(col: number, row: number, count: number = 1): void {
    if (this._ctx) {
      const { width, height } = this.cellSize;

      // Don't try to draw anything, if we cannot get valid renderer metrics.
      if (width === -1 || height === -1) {
        return;
      }

      if (!this._placeholder) {
        this._createPlaceHolder(Math.max(height + 1, PLACEHOLDER_HEIGHT));
      } else if (height >= this._placeholder!.height) {
        this._createPlaceHolder(height + 1);
      }
      if (!this._placeholder) return;
      this._ctx.drawImage(
        this._placeholderBitmap || this._placeholder!,
        col * width,
        (row * height) % 2 ? 0 : 1,  // needs %2 offset correction
        width * count,
        height,
        col * width,
        row * height,
        width * count,
        height
      );
    }
  }

  /**
   * Rescale image layer canvas if needed.
   * Checked once from `ImageStorage.render`.
   */
  public rescaleCanvas(): void {
    if (!this.canvas) {
      return;
    }
    if (this.canvas.width !== this.dimensions!.css.canvas.width || this.canvas.height !== this.dimensions!.css.canvas.height) {
      this.canvas.width = this.dimensions!.css.canvas.width || 0;
      this.canvas.height = this.dimensions!.css.canvas.height || 0;
    }
  }

  /**
   * Rescale image in storage if needed.
   */
  private _rescaleImage(spec: IImageSpec, currentWidth: number, currentHeight: number): void {
    if (currentWidth === spec.actualCellSize.width && currentHeight === spec.actualCellSize.height) {
      return;
    }
    const { width: originalWidth, height: originalHeight } = spec.origCellSize;
    if (currentWidth === originalWidth && currentHeight === originalHeight) {
      spec.actual = spec.orig;
      spec.actualCellSize.width = originalWidth;
      spec.actualCellSize.height = originalHeight;
      return;
    }
    const canvas = ImageRenderer.createCanvas(
      this.document,
      Math.ceil(spec.orig!.width * currentWidth / originalWidth),
      Math.ceil(spec.orig!.height * currentHeight / originalHeight)
    );
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.drawImage(spec.orig!, 0, 0, canvas.width, canvas.height);
      spec.actual = canvas;
      spec.actualCellSize.width = currentWidth;
      spec.actualCellSize.height = currentHeight;
    }
  }

  /**
   * Lazy init for the renderer.
   */
  private _open(): void {
    this._renderService = this._terminal._core._renderService;
    this._oldSetRenderer = this._renderService.setRenderer.bind(this._renderService);
    this._renderService.setRenderer = (renderer: any) => {
      this.removeLayerFromDom();
      this._oldSetRenderer?.call(this._renderService, renderer);
    };
  }

  public insertLayerToDom(): void {
    // make sure that the terminal is attached to a document and to DOM
    if (this.document && this._terminal._core.screenElement) {
      if (!this.canvas) {
        this.canvas = ImageRenderer.createCanvas(
          this.document, this.dimensions?.css.canvas.width || 0,
          this.dimensions?.css.canvas.height || 0
        );
        this.canvas.classList.add('xterm-image-layer');
        this._terminal._core.screenElement.appendChild(this.canvas);
        this._ctx = this.canvas.getContext('2d', { alpha: true, desynchronized: true });
        this.clearAll();
      }
    } else {
      console.warn('image addon: cannot insert output canvas to DOM, missing document or screenElement');
    }
  }

  public removeLayerFromDom(): void {
    if (this.canvas) {
      this._ctx = undefined;
      this.canvas.remove();
      this.canvas = undefined;
    }
  }

  private _createPlaceHolder(height: number = PLACEHOLDER_HEIGHT): void {
    this._placeholderBitmap?.close();
    this._placeholderBitmap = undefined;

    // create blueprint to fill placeholder with
    const bWidth = 32;  // must be 2^n
    const blueprint = ImageRenderer.createCanvas(this.document, bWidth, height);
    const ctx = blueprint.getContext('2d', { alpha: false });
    if (!ctx) return;
    const imgData = ImageRenderer.createImageData(ctx, bWidth, height);
    const d32 = new Uint32Array(imgData.data.buffer);
    const black = toRGBA8888(0, 0, 0);
    const white = toRGBA8888(255, 255, 255);
    d32.fill(black);
    for (let y = 0; y < height; ++y) {
      const shift = y % 2;
      const offset = y * bWidth;
      for (let x = 0; x < bWidth; x += 2) {
        d32[offset + x + shift] = white;
      }
    }
    ctx.putImageData(imgData, 0, 0);

    // create placeholder line, width aligned to blueprint width
    const width = (screen.width + bWidth - 1) & ~(bWidth - 1) || PLACEHOLDER_LENGTH;
    this._placeholder = ImageRenderer.createCanvas(this.document, width, height);
    const ctx2 = this._placeholder.getContext('2d', { alpha: false });
    if (!ctx2) {
      this._placeholder = undefined;
      return;
    }
    for (let i = 0; i < width; i += bWidth) {
      ctx2.drawImage(blueprint, i, 0);
    }
    ImageRenderer.createImageBitmap(this._placeholder).then(bitmap => this._placeholderBitmap = bitmap);
  }

  public get document(): Document | undefined {
    return this._terminal._core._coreBrowserService?.window.document;
  }
}
