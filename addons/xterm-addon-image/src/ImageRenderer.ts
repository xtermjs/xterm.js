/**
 * Copyright (c) 2020 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import { IDisposable, Terminal } from 'xterm';
import { ICellSize, IImageSpec, IRenderDimensions } from './Types';


/**
 * ImageRenderer - terminal frontend extension:
 * - provide primitives for canvas, ImageData, Bitmap (static)
 * - add canvas layer to DOM (browser only for now)
 * - draw image tiles onRender
 *
 * FIXME: needs overload of Terminal.setOption('fontSize')
 */
export class ImageRenderer implements IDisposable {
  private _internalTerm: any;
  private _oldOpen: (parent: HTMLElement) => void;
  private _rs: any;
  private _oldSetRenderer: (renderer: any) => void = () => {};
  public canvas: HTMLCanvasElement | undefined;
  public ctx: CanvasRenderingContext2D | null | undefined;
  private _dimHandler: IDisposable | undefined;
  private _charSizeHandler: IDisposable | undefined;

  // drawing primitive - canvas
  public static createCanvas(width: number, height: number): HTMLCanvasElement {
    const canvas = document.createElement('canvas');
    canvas.width = width | 0;
    canvas.height = height | 0;
    return canvas;
  }

  // drawing primitive - ImageData
  public static createImageData(ctx: CanvasRenderingContext2D, width: number, height: number): ImageData {
    if (typeof ImageData !== 'function') {
      return ctx.createImageData(width, height);
    }
    return new ImageData(width, height);
  }

  // drawing primitive - ImageBitmap
  public static createImageBitmap(img: ImageBitmapSource): Promise<ImageBitmap | undefined> {
    if (typeof createImageBitmap !== 'function') {
      return new Promise(res => res(undefined));
    }
    return createImageBitmap(img);
  }

  constructor(terminal: Terminal) {
    this._internalTerm = (terminal as any)._core;
    this._oldOpen = this._internalTerm.open;
    this._internalTerm.open = (parent: HTMLElement): void => {
      this._oldOpen.call(this._internalTerm, parent);
      this.open();
    };
    if (this._internalTerm.screenElement) {
      this.open();
    }
  }

  public dispose(): void {
    this.removeLayerFromDom();
    if (this._internalTerm && this._oldOpen) {
      this._internalTerm.open = this._oldOpen;
    }
    if (this._rs && this._oldSetRenderer) {
      this._rs.setRenderer = this._oldSetRenderer;
    }
    this._internalTerm = undefined;
    this._rs = undefined;
    this._dimHandler?.dispose();
    this._charSizeHandler?.dispose();
  }

  public open(): void {
    this._rs = this._internalTerm._renderService;
    this._oldSetRenderer = this._rs.setRenderer.bind(this._rs);
    this._rs.setRenderer = (renderer: any) => {
      this.removeLayerFromDom();
      this._oldSetRenderer(renderer);
      this.insertLayerToDom();
    };
    this.insertLayerToDom();
  }

  public removeLayerFromDom(): void {
    this.canvas?.parentNode?.removeChild(this.canvas);
  }

  public insertLayerToDom(): void {
    this.canvas = ImageRenderer.createCanvas(this.dimensions.canvasWidth, this.dimensions.canvasHeight);
    this.canvas.classList.add('xterm-image-layer');
    this._internalTerm.screenElement.appendChild(this.canvas);
    this.ctx = this.canvas.getContext('2d', {alpha: true, desynchronized: true});
  }

  public get dimensions(): IRenderDimensions {
    return this._rs?.dimensions;
  }

  public get currentCellSize(): ICellSize {
    return {
      width: this.dimensions.actualCellWidth,
      height: this.dimensions.actualCellHeight
    };
  }

  /**
   * Clear a region of the image layer canvas.
   */
  public clearLines(start: number, end: number): void {
    const top = start * this.dimensions.actualCellHeight;
    const bottom = ++end * this.dimensions.actualCellHeight;
    this.ctx?.clearRect(0, top, this.dimensions.canvasWidth, bottom);
  }

  /**
   * Draw neighboring tiles on the image layer canvas.
   */
  public draw(imgSpec: IImageSpec, tileId: number, col: number, row: number, count: number = 1): void {
    const cellWidth = this.dimensions.actualCellWidth;
    const cellHeight = this.dimensions.actualCellHeight;
    this.rescaleImage(imgSpec, cellWidth, cellHeight);

    const img = imgSpec.bitmap || imgSpec.actual;
    const cols = Math.ceil(img.width / cellWidth);

    this.ctx?.drawImage(
      img,
      (tileId % cols) * cellWidth,
      Math.floor(tileId / cols) * cellHeight,
      cellWidth * count,
      cellHeight,
      col * cellWidth,
      row * cellHeight,
      cellWidth * count,
      cellHeight
    );
  }

  /**
   * Rescale image layer canvas if needed.
   * Checked once from `ImageStorage.render`.
   */
  public rescaleCanvas(): void {
    if (!this.canvas) {
      return;
    }
    if (this.canvas.width !== this.dimensions.canvasWidth || this.canvas.height !== this.dimensions.canvasHeight) {
      this.canvas.width = this.dimensions.canvasWidth;
      this.canvas.height = this.dimensions.canvasHeight;
    }
  }

  /**
   * Rescale image in storage if needed.
   */
  public rescaleImage(is: IImageSpec, cw: number, ch: number): void {
    const {width: aw, height: ah} = is.actualCellSize;
    if (cw === aw && ch === ah) {
      return;
    }
    const {width: ow, height: oh} = is.origCellSize;
    if (cw === ow && ch === oh) {
      is.actual = is.orig;
      is.actualCellSize.width = ow;
      is.actualCellSize.height = oh;
      return;
    }
    const canvas = ImageRenderer.createCanvas(
      Math.ceil(is.orig.width * cw / ow),
      Math.ceil(is.orig.height * ch / oh)
    );
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.drawImage(is.orig, 0, 0, canvas.width, canvas.height);
      is.actual = canvas;
      is.actualCellSize.width = cw;
      is.actualCellSize.height = ch;
      is.bitmap?.close();
      is.bitmap = undefined;
      ImageRenderer.createImageBitmap(canvas).then((bitmap) => is.bitmap = bitmap);
    }
  }
}
