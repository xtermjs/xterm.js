/**
 * Copyright (c) 2020 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import { IDisposable } from 'xterm';
import { ICellSize, ICoreTerminal, IImageSpec, IRenderDimensions, IRenderService } from './Types';


/**
 * ImageRenderer - terminal frontend extension:
 * - provide primitives for canvas, ImageData, Bitmap (static)
 * - add canvas layer to DOM (browser only for now)
 * - draw image tiles onRender
 *
 * FIXME: needs overload of Terminal.setOption('fontSize')
 */
export class ImageRenderer implements IDisposable {
  public canvas: HTMLCanvasElement | undefined;
  public ctx: CanvasRenderingContext2D | null | undefined;
  private _optionsRefresh: IDisposable | undefined;
  private _oldOpen: (parent: HTMLElement) => void;
  private _rs: IRenderService | undefined;
  private _oldSetRenderer: (renderer: any) => void = () => {};

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

  constructor(private _terminal: ICoreTerminal) {
    this._oldOpen = this._terminal._core.open;
    this._terminal._core.open = (parent: HTMLElement): void => {
      this._oldOpen.call(this._terminal._core, parent);
      this.open();
    };
    if (this._terminal._core.screenElement) {
      this.open();
    }
    // hack to spot fontSize changes
    this._optionsRefresh = this._terminal._core.optionsService.onOptionChange(option => {
      if (option === 'fontSize') {
        this.rescaleCanvas();
        this._rs?.refreshRows(0, this._terminal.rows);
      }
    });
  }

  public dispose(): void {
    this._optionsRefresh?.dispose();
    this.removeLayerFromDom();
    if (this._terminal._core && this._oldOpen) {
      this._terminal._core.open = this._oldOpen;
    }
    if (this._rs && this._oldSetRenderer) {
      this._rs.setRenderer = this._oldSetRenderer;
    }
    this._rs = undefined;
  }

  public open(): void {
    this._rs = this._terminal._core._renderService;
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
    this.canvas = ImageRenderer.createCanvas(this.dimensions?.canvasWidth || 0, this.dimensions?.canvasHeight || 0);
    this.canvas.classList.add('xterm-image-layer');
    this._terminal._core.screenElement.appendChild(this.canvas);
    this.ctx = this.canvas.getContext('2d', {alpha: true, desynchronized: true});
  }

  public get dimensions(): IRenderDimensions | undefined {
    return this._rs?.dimensions;
  }

  public get currentCellSize(): ICellSize {
    return {
      width: Math.round(this.dimensions?.actualCellWidth || -1),
      height: Math.round(this.dimensions?.actualCellHeight || -1)
    };
  }

  /**
   * Clear a region of the image layer canvas.
   */
  public clearLines(start: number, end: number): void {
    this.ctx?.clearRect(
      0,
      start * (this.dimensions?.actualCellHeight || 0),
      this.dimensions?.canvasWidth || 0,
      (++end - start) * (this.dimensions?.actualCellHeight || 0)
    );
  }

  /**
   * Draw neighboring tiles on the image layer canvas.
   */
  public draw(imgSpec: IImageSpec, tileId: number, col: number, row: number, count: number = 1): void {
    const {width, height} = this.currentCellSize;
    this.rescaleImage(imgSpec, width, height);

    const img = imgSpec.bitmap || imgSpec.actual;
    const cols = Math.ceil(img.width / width);

    this.ctx?.drawImage(
      img,
      (tileId % cols) * width,
      Math.floor(tileId / cols) * height,
      width * count,
      height,
      col * width,
      row * height,
      width * count,
      height
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
    if (this.canvas.width !== this.dimensions?.canvasWidth || this.canvas.height !== this.dimensions.canvasHeight) {
      this.canvas.width = this.dimensions?.canvasWidth || 0;
      this.canvas.height = this.dimensions?.canvasHeight || 0;
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
      is.bitmap?.close();
      is.bitmap = undefined;
      ImageRenderer.createImageBitmap(is.actual).then((bitmap) => is.bitmap = bitmap);
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
