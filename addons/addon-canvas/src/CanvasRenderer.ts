/**
 * Copyright (c) 2017 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import { ILinkifier2 } from 'browser/Types';
import { removeTerminalFromCache } from 'browser/renderer/shared/CharAtlasCache';
import { observeDevicePixelDimensions } from 'browser/renderer/shared/DevicePixelObserver';
import { createRenderDimensions } from 'browser/renderer/shared/RendererUtils';
import { IRenderDimensions, IRenderer, IRequestRedrawEvent } from 'browser/renderer/shared/Types';
import { ICharSizeService, ICharacterJoinerService, ICoreBrowserService, IThemeService } from 'browser/services/Services';
import { EventEmitter, forwardEvent } from 'common/EventEmitter';
import { Disposable, MutableDisposable, toDisposable } from 'common/Lifecycle';
import { IBufferService, ICoreService, IDecorationService, IOptionsService } from 'common/services/Services';
import { Terminal } from '@xterm/xterm';
import { CursorRenderLayer } from './CursorRenderLayer';
import { LinkRenderLayer } from './LinkRenderLayer';
import { SelectionRenderLayer } from './SelectionRenderLayer';
import { TextRenderLayer } from './TextRenderLayer';
import { IRenderLayer } from './Types';

export class CanvasRenderer extends Disposable implements IRenderer {
  private _renderLayers: IRenderLayer[];
  private _devicePixelRatio: number;
  private _observerDisposable = this.register(new MutableDisposable());

  public dimensions: IRenderDimensions;

  private readonly _onRequestRedraw = this.register(new EventEmitter<IRequestRedrawEvent>());
  public readonly onRequestRedraw = this._onRequestRedraw.event;
  private readonly _onChangeTextureAtlas = this.register(new EventEmitter<HTMLCanvasElement>());
  public readonly onChangeTextureAtlas = this._onChangeTextureAtlas.event;
  private readonly _onAddTextureAtlasCanvas = this.register(new EventEmitter<HTMLCanvasElement>());
  public readonly onAddTextureAtlasCanvas = this._onAddTextureAtlasCanvas.event;

  constructor(
    private readonly _terminal: Terminal,
    private readonly _screenElement: HTMLElement,
    linkifier2: ILinkifier2,
    private readonly _bufferService: IBufferService,
    private readonly _charSizeService: ICharSizeService,
    private readonly _optionsService: IOptionsService,
    characterJoinerService: ICharacterJoinerService,
    coreService: ICoreService,
    private readonly _coreBrowserService: ICoreBrowserService,
    decorationService: IDecorationService,
    private readonly _themeService: IThemeService
  ) {
    super();
    const allowTransparency = this._optionsService.rawOptions.allowTransparency;
    this._renderLayers = [
      new TextRenderLayer(this._terminal, this._screenElement, 0, allowTransparency, this._bufferService, this._optionsService, characterJoinerService, decorationService, this._coreBrowserService, _themeService),
      new SelectionRenderLayer(this._terminal, this._screenElement, 1, this._bufferService, this._coreBrowserService, decorationService, this._optionsService, _themeService),
      new LinkRenderLayer(this._terminal, this._screenElement, 2, linkifier2, this._bufferService, this._optionsService, decorationService, this._coreBrowserService, _themeService),
      new CursorRenderLayer(this._terminal, this._screenElement, 3, this._onRequestRedraw, this._bufferService, this._optionsService, coreService, this._coreBrowserService, decorationService, _themeService)
    ];
    for (const layer of this._renderLayers) {
      forwardEvent(layer.onAddTextureAtlasCanvas, this._onAddTextureAtlasCanvas);
    }
    this.dimensions = createRenderDimensions();
    this._devicePixelRatio = this._coreBrowserService.dpr;
    this._updateDimensions();

    this._observerDisposable.value = observeDevicePixelDimensions(this._renderLayers[0].canvas, this._coreBrowserService.window, (w, h) => this._setCanvasDevicePixelDimensions(w, h));
    this.register(this._coreBrowserService.onWindowChange(w => {
      this._observerDisposable.value = observeDevicePixelDimensions(this._renderLayers[0].canvas, w, (w, h) => this._setCanvasDevicePixelDimensions(w, h));
    }));

    this.register(toDisposable(() => {
      for (const l of this._renderLayers) {
        l.dispose();
      }
      removeTerminalFromCache(this._terminal);
    }));
  }

  public get textureAtlas(): HTMLCanvasElement | undefined {
    return this._renderLayers[0].cacheCanvas;
  }

  public handleDevicePixelRatioChange(): void {
    // If the device pixel ratio changed, the char atlas needs to be regenerated
    // and the terminal needs to refreshed
    if (this._devicePixelRatio !== this._coreBrowserService.dpr) {
      this._devicePixelRatio = this._coreBrowserService.dpr;
      this.handleResize(this._bufferService.cols, this._bufferService.rows);
    }
  }

  public handleResize(cols: number, rows: number): void {
    // Update character and canvas dimensions
    this._updateDimensions();

    // Resize all render layers
    for (const l of this._renderLayers) {
      l.resize(this.dimensions);
    }

    // Resize the screen
    this._screenElement.style.width = `${this.dimensions.css.canvas.width}px`;
    this._screenElement.style.height = `${this.dimensions.css.canvas.height}px`;
  }

  public handleCharSizeChanged(): void {
    this.handleResize(this._bufferService.cols, this._bufferService.rows);
  }

  public handleBlur(): void {
    this._runOperation(l => l.handleBlur());
  }

  public handleFocus(): void {
    this._runOperation(l => l.handleFocus());
  }

  public handleSelectionChanged(start: [number, number] | undefined, end: [number, number] | undefined, columnSelectMode: boolean = false): void {
    this._runOperation(l => l.handleSelectionChanged(start, end, columnSelectMode));
    // Selection foreground requires a full re-render
    if (this._themeService.colors.selectionForeground) {
      this._onRequestRedraw.fire({ start: 0, end: this._bufferService.rows - 1 });
    }
  }

  public handleCursorMove(): void {
    this._runOperation(l => l.handleCursorMove());
  }

  public clear(): void {
    this._runOperation(l => l.reset());
  }

  private _runOperation(operation: (layer: IRenderLayer) => void): void {
    for (const l of this._renderLayers) {
      operation(l);
    }
  }

  /**
   * Performs the refresh loop callback, calling refresh only if a refresh is
   * necessary before queueing up the next one.
   */
  public renderRows(start: number, end: number): void {
    for (const l of this._renderLayers) {
      l.handleGridChanged(start, end);
    }
  }

  public clearTextureAtlas(): void {
    for (const layer of this._renderLayers) {
      layer.clearTextureAtlas();
    }
  }

  /**
   * Recalculates the character and canvas dimensions.
   */
  private _updateDimensions(): void {
    if (!this._charSizeService.hasValidSize) {
      return;
    }

    // See the WebGL renderer for an explanation of this section.
    const dpr = this._coreBrowserService.dpr;
    this.dimensions.device.char.width = Math.floor(this._charSizeService.width * dpr);
    this.dimensions.device.char.height = Math.ceil(this._charSizeService.height * dpr);
    this.dimensions.device.cell.height = Math.floor(this.dimensions.device.char.height * this._optionsService.rawOptions.lineHeight);
    this.dimensions.device.char.top = this._optionsService.rawOptions.lineHeight === 1 ? 0 : Math.round((this.dimensions.device.cell.height - this.dimensions.device.char.height) / 2);
    this.dimensions.device.cell.width = this.dimensions.device.char.width + Math.round(this._optionsService.rawOptions.letterSpacing);
    this.dimensions.device.char.left = Math.floor(this._optionsService.rawOptions.letterSpacing / 2);
    this.dimensions.device.canvas.height = this._bufferService.rows * this.dimensions.device.cell.height;
    this.dimensions.device.canvas.width = this._bufferService.cols * this.dimensions.device.cell.width;
    this.dimensions.css.canvas.height = Math.round(this.dimensions.device.canvas.height / dpr);
    this.dimensions.css.canvas.width = Math.round(this.dimensions.device.canvas.width / dpr);
    this.dimensions.css.cell.height = this.dimensions.css.canvas.height / this._bufferService.rows;
    this.dimensions.css.cell.width = this.dimensions.css.canvas.width / this._bufferService.cols;
  }

  private _setCanvasDevicePixelDimensions(width: number, height: number): void {
    this.dimensions.device.canvas.height = height;
    this.dimensions.device.canvas.width = width;
    // Resize all render layers
    for (const l of this._renderLayers) {
      l.resize(this.dimensions);
    }
    this._requestRedrawViewport();
  }

  private _requestRedrawViewport(): void {
    this._onRequestRedraw.fire({ start: 0, end: this._bufferService.rows - 1 });
  }
}
