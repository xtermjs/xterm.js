/**
 * Copyright (c) 2020 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import { IDisposable } from '@xterm/xterm';
import type { ICellSize, ImageLayer, ITerminalExt, IImageSpec, IRenderDimensions, IRenderService } from './Types';
import { Disposable, MutableDisposable, toDisposable } from 'common/Lifecycle';
import { createCanvas } from './Primitives';


/**
 * ImageRenderer - terminal frontend extension:
 * - add canvas layer to DOM (browser only for now)
 * - draw image tiles onRender
 */
export class ImageRenderer extends Disposable implements IDisposable {
  /** @deprecated Kept for backward compat — points to top layer canvas. */
  public get canvas(): HTMLCanvasElement | undefined { return this._layers.get('top')?.canvas; }
  private _layers = new Map<ImageLayer, CanvasRenderingContext2D>();
  private _placeholder: HTMLCanvasElement | undefined;
  private _optionsRefresh = this._register(new MutableDisposable());
  private _oldOpen: ((parent: HTMLElement) => void) | undefined;
  private _renderService: IRenderService | undefined;
  private _oldSetRenderer: ((renderer: any) => void) | undefined;

  // some local variables for faster access
  private _dimensions: IRenderDimensions | undefined;
  private _cellSize: ICellSize | undefined;

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
    this._register(toDisposable(() => {
      this.removeLayerFromDom();
      this.removeLayerFromDom('bottom');
      if (this._terminal._core && this._oldOpen) {
        this._terminal._core.open = this._oldOpen;
        this._oldOpen = undefined;
      }
      if (this._renderService && this._oldSetRenderer) {
        this._renderService.setRenderer = this._oldSetRenderer;
        this._oldSetRenderer = undefined;
      }
      this._renderService = undefined;
      this._layers.clear();
      this._placeholder = undefined;
    }));
  }

  /**
   * Enable the placeholder.
   */
  public showPlaceholder(value: boolean): void {
    this._placeholder = value ? this._createPlaceHolder() : undefined;
    this._renderService?.refreshRows(0, this._terminal.rows);
  }

  /**
   * Dimensions of the terminal.
   * Forwarded from internal render service.
   */
  public get dimensions(): IRenderDimensions | undefined {
    return this._terminal.dimensions;
  }

  /**
   * Current cell size.
   */
  public getCellSize(dimensions?: IRenderDimensions): ICellSize | undefined {
    dimensions ??= this._terminal.dimensions;
    if (dimensions) {
      return {
        width: dimensions.device.canvas.width / this._terminal.cols,
        height: dimensions.device.canvas.height / this._terminal.rows,
      };
    }
  }

  /**
   * Clear a region of the image layer canvas.
   */
  public clearLines(start: number, end: number, layer?: ImageLayer): void {
    const deviceGrid = this._cellSize;
    if (!deviceGrid || !this._dimensions) return;
    const y = Math.floor(start * deviceGrid.height);
    const w = this._dimensions.device.canvas.width;
    const h = Math.ceil((end + 1 - start) * deviceGrid.height);
    if (!layer || layer === 'top') {
      this._layers.get('top')?.clearRect(0, y, w, h);
    }
    if (!layer || layer === 'bottom') {
      this._layers.get('bottom')?.clearRect(0, y, w, h);
    }
  }

  /**
   * Clear whole image canvas.
   */
  public clearAll(layer?: ImageLayer): void {
    if (!layer || layer === 'top') {
      const ctx = this._layers.get('top');
      ctx?.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    }
    if (!layer || layer === 'bottom') {
      const ctx = this._layers.get('bottom');
      ctx?.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    }
  }

  /**
   * Draw neighboring tiles on the image layer canvas.
   */
  public draw(imgSpec: IImageSpec, tileId: number, col: number, row: number, count: number = 1): void {
    const ctx = this._layers.get(imgSpec.layer);
    const initialGrid = imgSpec.cellSize;
    const deviceGrid = this._cellSize;

    if (!ctx || !imgSpec.src.native || !deviceGrid) {
      return;
    }

    const img = imgSpec.src;
    const cols = Math.ceil(img.width * imgSpec.prescaleX / initialGrid.width);

    const gridWidth = initialGrid.width / imgSpec.prescaleX;
    const gridHeight = initialGrid.height / imgSpec.prescaleY;

    // crops are initialGrid px
    const sx = (tileId % cols) * gridWidth + imgSpec.precropX;
    const sy = Math.floor(tileId / cols) * gridHeight + imgSpec.precropY;
    const dx = Math.floor(col * deviceGrid.width + imgSpec.offsetX);
    const dy = Math.floor(row * deviceGrid.height + imgSpec.offsetY);

    // safari bug: never access image source out of bounds, thus we clamp its dimensions
    const sWidth = Math.min(count * gridWidth, img.width - sx);
    const sHeight = Math.min(gridHeight, img.height - sy);
    const dWidth = Math.ceil(sWidth / gridWidth * deviceGrid.width * imgSpec.scaleX);
    const dHeight = Math.ceil(sHeight / gridHeight * deviceGrid.height * imgSpec.scaleY);

    if (imgSpec.blendMode === 'overwrite') {
      ctx.clearRect(dx, dy, dWidth, dHeight);
    }

    // Floor all pixel offsets to get stable tile mapping without any overflows.
    // Note: For not pixel perfect aligned cells like in the DOM renderer
    // this will move a tile slightly to the top/left (subpixel range, thus ignore it).
    // FIX #34: avoid striping on displays with pixelDeviceRatio != 1 by ceiling height and width
    ctx.drawImage(
      img.native,
      Math.floor(sx), Math.floor(sy), Math.ceil(sWidth), Math.ceil(sHeight),
      dx, dy, dWidth, dHeight
    );
  }

  /**
   * Draw a line with placeholder on the image layer canvas.
   */
  public drawPlaceholder(col: number, row: number, count: number = 1): void {
    const ctx = this._layers.get('top');
    const deviceGrid = this._cellSize;
    if (!ctx || !deviceGrid) {
      return;
    }
    this._placeholder ??= this._createPlaceHolder();
    if (!this._placeholder) return;
    ctx.drawImage(
      this._placeholder,
      0, 0, 1, 1,
      col * deviceGrid.width,
      row * deviceGrid.height,
      count * deviceGrid.width,
      deviceGrid.height
    );
  }

  /**
   * Rescale image layer canvas if needed.
   * Checked once from `ImageStorage.render`.
   * NOTE: This method updates dimensions on instance properties
   * for faster access during draw and clear calls.
   * So make sure to always call this before doing any draws.
   */
  public rescaleCanvas(force: boolean = false): void {
    const dimensions = this._terminal.dimensions;
    if (dimensions) {
      const cssW = dimensions.css.canvas.width;
      const cssH = dimensions.css.canvas.height;
      const devW = dimensions.device.canvas.width;
      const devH = dimensions.device.canvas.height;
      let recalc = force;
      for (const ctx of this._layers.values()) {
        if (ctx.canvas.width !== devW
          || ctx.canvas.height !== devH
          || ctx.canvas.style.width !== `${cssW}px`
          || ctx.canvas.style.height !== `${cssH}px`
        ) {
          ctx.canvas.width = devW;
          ctx.canvas.height = devH;
          ctx.canvas.style.width = `${cssW}px`;
          ctx.canvas.style.height = `${cssH}px`;
          recalc = true;
        }
      }
      if (recalc) {
        this._dimensions = dimensions;
        this._cellSize = this.getCellSize(dimensions);
      }
    } else {
      // we were not able to get render dimensions:
      // set cellsize to undefined so we don't try to draw anything
      this._cellSize = this.getCellSize();
    }
  }

  /**
   * Lazy init for the renderer.
   */
  private _open(): void {
    this._renderService = this._terminal._core._renderService;
    this._oldSetRenderer = this._renderService.setRenderer.bind(this._renderService);
    this._renderService.setRenderer = (renderer: any) => {
      for (const key of [...this._layers.keys()]) {
        this.removeLayerFromDom(key);
      }
      this._oldSetRenderer?.call(this._renderService, renderer);
    };
  }

  public insertLayerToDom(layer: ImageLayer = 'top'): void {
    // make sure that the terminal is attached to a document and to DOM
    if (!this.document || !this._terminal._core.screenElement) {
      console.warn('image addon: cannot insert output canvas to DOM, missing document or screenElement');
      return;
    }
    if (this._layers.has(layer)) {
      return;
    }
    const canvas = createCanvas(
      this.document,
      this.dimensions?.device.canvas.width || 0,
      this.dimensions?.device.canvas.height || 0,
      this.dimensions?.css.canvas.width || 0,
      this.dimensions?.css.canvas.height || 0,
    );
    canvas.classList.add(`xterm-image-layer-${layer}`);
    const screenElement = this._terminal._core.screenElement;
    // Use isolation to create a stacking context without overriding z-index,
    // which would conflict with integrators (e.g. VS Code) that set their
    // own z-index on the screen element.
    screenElement.style.isolation = 'isolate';
    if (layer === 'bottom') {
      // Use z-index:-1 so it paints behind non-positioned text elements.
      // The screen element needs to be a stacking context (via isolation)
      // to contain the negative z-index, otherwise it would go behind the
      // entire terminal.
      canvas.style.zIndex = '-1';
      screenElement.insertBefore(canvas, screenElement.firstChild);
    } else {
      // Explicit z-index ensures the image canvas reliably stacks above
      // the text layer (DOM renderer rows). z-index: 0 is below the
      // selection overlay (z-index: 1).
      canvas.style.zIndex = '0';
      screenElement.appendChild(canvas);
    }
    const ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) {
      canvas.remove();
      return;
    }
    this._layers.set(layer, ctx);
    // force rescaling to update stored cellSize (maybe not be populated yet)
    this.rescaleCanvas(true);
    this.clearAll(layer);
  }

  public removeLayerFromDom(layer: ImageLayer = 'top'): void {
    const ctx = this._layers.get(layer);
    if (ctx) {
      ctx.canvas.remove();
      this._layers.delete(layer);
    }
  }

  public hasLayer(layer: ImageLayer): boolean {
    return this._layers.has(layer);
  }

  /**
   * Create a semi-transparent gray 1x1 placeholder
   */
  private _createPlaceHolder(): HTMLCanvasElement | undefined {
    const imgData = new ImageData(1, 1);
    new Uint32Array(imgData.data.buffer).fill(128 << 24 | 128 << 16 | 128 << 8 | 128);
    const canvas = createCanvas(this.document, 1, 1);
    const ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) return;
    ctx.putImageData(imgData, 0, 0);
    return canvas;
  }

  public get document(): Document | undefined {
    return this._terminal._core._coreBrowserService?.window.document;
  }
}
