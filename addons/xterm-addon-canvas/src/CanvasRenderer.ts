/**
 * Copyright (c) 2017 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import { TextRenderLayer } from './TextRenderLayer';
import { SelectionRenderLayer } from './SelectionRenderLayer';
import { CursorRenderLayer } from './CursorRenderLayer';
import { IRenderer, IRenderDimensions, IRequestRedrawEvent } from 'browser/renderer/Types';
import { IRenderLayer } from './Types';
import { LinkRenderLayer } from './LinkRenderLayer';
import { Disposable } from 'common/Lifecycle';
import { IColorSet, ILinkifier2 } from 'browser/Types';
import { ICharacterJoinerService, ICharSizeService, ICoreBrowserService } from 'browser/services/Services';
import { IBufferService, IOptionsService, IDecorationService, ICoreService } from 'common/services/Services';
import { removeTerminalFromCache } from './atlas/CharAtlasCache';
import { EventEmitter, IEvent } from 'common/EventEmitter';
import { observeDevicePixelDimensions } from 'browser/renderer/DevicePixelObserver';

let nextRendererId = 1;

export class CanvasRenderer extends Disposable implements IRenderer {
  private _id = nextRendererId++;

  private _renderLayers: IRenderLayer[];
  private _devicePixelRatio: number;

  public dimensions: IRenderDimensions;

  private _onRequestRedraw = new EventEmitter<IRequestRedrawEvent>();
  public get onRequestRedraw(): IEvent<IRequestRedrawEvent> { return this._onRequestRedraw.event; }

  constructor(
    private _colors: IColorSet,
    private readonly _screenElement: HTMLElement,
    linkifier2: ILinkifier2,
    private readonly _bufferService: IBufferService,
    private readonly _charSizeService: ICharSizeService,
    private readonly _optionsService: IOptionsService,
    characterJoinerService: ICharacterJoinerService,
    coreService: ICoreService,
    private readonly _coreBrowserService: ICoreBrowserService,
    decorationService: IDecorationService
  ) {
    super();
    const allowTransparency = this._optionsService.rawOptions.allowTransparency;
    this._renderLayers = [
      new TextRenderLayer(this._screenElement, 0, this._colors, allowTransparency, this._id, this._bufferService, this._optionsService, characterJoinerService, decorationService, this._coreBrowserService),
      new SelectionRenderLayer(this._screenElement, 1, this._colors, this._id, this._bufferService, this._coreBrowserService, decorationService, this._optionsService),
      new LinkRenderLayer(this._screenElement, 2, this._colors, this._id, linkifier2, this._bufferService, this._optionsService, decorationService, this._coreBrowserService),
      new CursorRenderLayer(this._screenElement, 3, this._colors, this._id, this._onRequestRedraw, this._bufferService, this._optionsService, coreService, this._coreBrowserService, decorationService)
    ];
    this.dimensions = {
      scaledCharWidth: 0,
      scaledCharHeight: 0,
      scaledCellWidth: 0,
      scaledCellHeight: 0,
      scaledCharLeft: 0,
      scaledCharTop: 0,
      scaledCanvasWidth: 0,
      scaledCanvasHeight: 0,
      canvasWidth: 0,
      canvasHeight: 0,
      actualCellWidth: 0,
      actualCellHeight: 0
    };
    this._devicePixelRatio = this._coreBrowserService.dpr;
    this._updateDimensions();

    this.register(observeDevicePixelDimensions(this._renderLayers[0].canvas, this._coreBrowserService.window, (w, h) => this._setCanvasDevicePixelDimensions(w, h)));

    this.onOptionsChanged();
  }

  public dispose(): void {
    for (const l of this._renderLayers) {
      l.dispose();
    }
    super.dispose();
    removeTerminalFromCache(this._id);
  }

  public onDevicePixelRatioChange(): void {
    // If the device pixel ratio changed, the char atlas needs to be regenerated
    // and the terminal needs to refreshed
    if (this._devicePixelRatio !== this._coreBrowserService.dpr) {
      this._devicePixelRatio = this._coreBrowserService.dpr;
      this.onResize(this._bufferService.cols, this._bufferService.rows);
    }
  }

  public setColors(colors: IColorSet): void {
    this._colors = colors;
    // Clear layers and force a full render
    for (const l of this._renderLayers) {
      l.setColors(this._colors);
      l.reset();
    }
  }

  public onResize(cols: number, rows: number): void {
    // Update character and canvas dimensions
    this._updateDimensions();

    // Resize all render layers
    for (const l of this._renderLayers) {
      l.resize(this.dimensions);
    }

    // Resize the screen
    this._screenElement.style.width = `${this.dimensions.canvasWidth}px`;
    this._screenElement.style.height = `${this.dimensions.canvasHeight}px`;
  }

  public onCharSizeChanged(): void {
    this.onResize(this._bufferService.cols, this._bufferService.rows);
  }

  public onBlur(): void {
    this._runOperation(l => l.onBlur());
  }

  public onFocus(): void {
    this._runOperation(l => l.onFocus());
  }

  public onSelectionChanged(start: [number, number] | undefined, end: [number, number] | undefined, columnSelectMode: boolean = false): void {
    this._runOperation(l => l.onSelectionChanged(start, end, columnSelectMode));
    // Selection foreground requires a full re-render
    if (this._colors.selectionForeground) {
      this._onRequestRedraw.fire({ start: 0, end: this._bufferService.rows - 1 });
    }
  }

  public onCursorMove(): void {
    this._runOperation(l => l.onCursorMove());
  }

  public onOptionsChanged(): void {
    this._runOperation(l => l.onOptionsChanged());
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
      l.onGridChanged(start, end);
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
    this.dimensions.scaledCharWidth = Math.floor(this._charSizeService.width * dpr);
    this.dimensions.scaledCharHeight = Math.ceil(this._charSizeService.height * dpr);
    this.dimensions.scaledCellHeight = Math.floor(this.dimensions.scaledCharHeight * this._optionsService.rawOptions.lineHeight);
    this.dimensions.scaledCharTop = this._optionsService.rawOptions.lineHeight === 1 ? 0 : Math.round((this.dimensions.scaledCellHeight - this.dimensions.scaledCharHeight) / 2);
    this.dimensions.scaledCellWidth = this.dimensions.scaledCharWidth + Math.round(this._optionsService.rawOptions.letterSpacing);
    this.dimensions.scaledCharLeft = Math.floor(this._optionsService.rawOptions.letterSpacing / 2);
    this.dimensions.scaledCanvasHeight = this._bufferService.rows * this.dimensions.scaledCellHeight;
    this.dimensions.scaledCanvasWidth = this._bufferService.cols * this.dimensions.scaledCellWidth;
    this.dimensions.canvasHeight = Math.round(this.dimensions.scaledCanvasHeight / dpr);
    this.dimensions.canvasWidth = Math.round(this.dimensions.scaledCanvasWidth / dpr);
    this.dimensions.actualCellHeight = this.dimensions.canvasHeight / this._bufferService.rows;
    this.dimensions.actualCellWidth = this.dimensions.canvasWidth / this._bufferService.cols;
  }

  private _setCanvasDevicePixelDimensions(width: number, height: number): void {
    this.dimensions.scaledCanvasHeight = height;
    this.dimensions.scaledCanvasWidth = width;
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
