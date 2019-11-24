/**
 * Copyright (c) 2017 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import { TextRenderLayer } from 'browser/renderer/TextRenderLayer';
import { SelectionRenderLayer } from 'browser/renderer/SelectionRenderLayer';
import { CursorRenderLayer } from 'browser/renderer/CursorRenderLayer';
import { IRenderLayer, IRenderer, IRenderDimensions, CharacterJoinerHandler, ICharacterJoinerRegistry, IRequestRefreshRowsEvent } from 'browser/renderer/Types';
import { LinkRenderLayer } from 'browser/renderer/LinkRenderLayer';
import { CharacterJoinerRegistry } from 'browser/renderer/CharacterJoinerRegistry';
import { Disposable } from 'common/Lifecycle';
import { IColorSet, ILinkifier } from 'browser/Types';
import { ICharSizeService, ICoreBrowserService } from 'browser/services/Services';
import { IBufferService, IOptionsService, ICoreService } from 'common/services/Services';
import { removeTerminalFromCache } from 'browser/renderer/atlas/CharAtlasCache';
import { EventEmitter, IEvent } from 'common/EventEmitter';

let nextRendererId = 1;

export class Renderer extends Disposable implements IRenderer {
  private _id = nextRendererId++;

  private _renderLayers: IRenderLayer[];
  private _devicePixelRatio: number;
  private _characterJoinerRegistry: ICharacterJoinerRegistry;

  public dimensions: IRenderDimensions;

  private _onRequestRefreshRows = new EventEmitter<IRequestRefreshRowsEvent>();
  public get onRequestRefreshRows(): IEvent<IRequestRefreshRowsEvent> { return this._onRequestRefreshRows.event; }

  constructor(
    private _colors: IColorSet,
    private readonly _screenElement: HTMLElement,
    private readonly _linkifier: ILinkifier,
    @IBufferService private readonly _bufferService: IBufferService,
    @ICharSizeService private readonly _charSizeService: ICharSizeService,
    @IOptionsService private readonly _optionsService: IOptionsService,
    @ICoreService readonly coreService: ICoreService,
    @ICoreBrowserService readonly coreBrowserService: ICoreBrowserService
  ) {
    super();
    const allowTransparency = this._optionsService.options.allowTransparency;
    this._characterJoinerRegistry = new CharacterJoinerRegistry(this._bufferService);

    this._renderLayers = [
      new TextRenderLayer(this._screenElement, 0, this._colors, this._characterJoinerRegistry, allowTransparency, this._id, this._bufferService, _optionsService),
      new SelectionRenderLayer(this._screenElement, 1, this._colors, this._id, this._bufferService, _optionsService),
      new LinkRenderLayer(this._screenElement, 2, this._colors, this._id, this._linkifier, this._bufferService, _optionsService),
      new CursorRenderLayer(this._screenElement, 3, this._colors, this._id, this._onRequestRefreshRows, this._bufferService, _optionsService, coreService, coreBrowserService)
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
    this._devicePixelRatio = window.devicePixelRatio;
    this._updateDimensions();
    this.onOptionsChanged();
  }

  public dispose(): void {
    super.dispose();
    this._renderLayers.forEach(l => l.dispose());
    removeTerminalFromCache(this._id);
  }

  public onDevicePixelRatioChange(): void {
    // If the device pixel ratio changed, the char atlas needs to be regenerated
    // and the terminal needs to refreshed
    if (this._devicePixelRatio !== window.devicePixelRatio) {
      this._devicePixelRatio = window.devicePixelRatio;
      this.onResize(this._bufferService.cols, this._bufferService.rows);
    }
  }

  public setColors(colors: IColorSet): void {
    this._colors = colors;

    // Clear layers and force a full render
    this._renderLayers.forEach(l => {
      l.setColors(this._colors);
      l.reset();
    });
  }

  public onResize(cols: number, rows: number): void {
    // Update character and canvas dimensions
    this._updateDimensions();

    // Resize all render layers
    this._renderLayers.forEach(l => l.resize(this.dimensions));

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

  public onSelectionChanged(start: [number, number], end: [number, number], columnSelectMode: boolean = false): void {
    this._runOperation(l => l.onSelectionChanged(start, end, columnSelectMode));
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
    this._renderLayers.forEach(l => operation(l));
  }

  /**
   * Performs the refresh loop callback, calling refresh only if a refresh is
   * necessary before queueing up the next one.
   */
  public renderRows(start: number, end: number): void {
    this._renderLayers.forEach(l => l.onGridChanged(start, end));
  }

  /**
   * Recalculates the character and canvas dimensions.
   */
  private _updateDimensions(): void {
    if (!this._charSizeService.hasValidSize) {
      return;
    }

    // Calculate the scaled character width. Width is floored as it must be
    // drawn to an integer grid in order for the CharAtlas "stamps" to not be
    // blurry. When text is drawn to the grid not using the CharAtlas, it is
    // clipped to ensure there is no overlap with the next cell.
    this.dimensions.scaledCharWidth = Math.floor(this._charSizeService.width * window.devicePixelRatio);

    // Calculate the scaled character height. Height is ceiled in case
    // devicePixelRatio is a floating point number in order to ensure there is
    // enough space to draw the character to the cell.
    this.dimensions.scaledCharHeight = Math.ceil(this._charSizeService.height * window.devicePixelRatio);

    // Calculate the scaled cell height, if lineHeight is not 1 then the value
    // will be floored because since lineHeight can never be lower then 1, there
    // is a guarentee that the scaled line height will always be larger than
    // scaled char height.
    this.dimensions.scaledCellHeight = Math.floor(this.dimensions.scaledCharHeight * this._optionsService.options.lineHeight);

    // Calculate the y coordinate within a cell that text should draw from in
    // order to draw in the center of a cell.
    this.dimensions.scaledCharTop = this._optionsService.options.lineHeight === 1 ? 0 : Math.round((this.dimensions.scaledCellHeight - this.dimensions.scaledCharHeight) / 2);

    // Calculate the scaled cell width, taking the letterSpacing into account.
    this.dimensions.scaledCellWidth = this.dimensions.scaledCharWidth + Math.round(this._optionsService.options.letterSpacing);

    // Calculate the x coordinate with a cell that text should draw from in
    // order to draw in the center of a cell.
    this.dimensions.scaledCharLeft = Math.floor(this._optionsService.options.letterSpacing / 2);

    // Recalculate the canvas dimensions; scaled* define the actual number of
    // pixel in the canvas
    this.dimensions.scaledCanvasHeight = this._bufferService.rows * this.dimensions.scaledCellHeight;
    this.dimensions.scaledCanvasWidth = this._bufferService.cols * this.dimensions.scaledCellWidth;

    // The the size of the canvas on the page. It's very important that this
    // rounds to nearest integer and not ceils as browsers often set
    // window.devicePixelRatio as something like 1.100000023841858, when it's
    // actually 1.1. Ceiling causes blurriness as the backing canvas image is 1
    // pixel too large for the canvas element size.
    this.dimensions.canvasHeight = Math.round(this.dimensions.scaledCanvasHeight / window.devicePixelRatio);
    this.dimensions.canvasWidth = Math.round(this.dimensions.scaledCanvasWidth / window.devicePixelRatio);

    // Get the _actual_ dimensions of an individual cell. This needs to be
    // derived from the canvasWidth/Height calculated above which takes into
    // account window.devicePixelRatio. ICharSizeService.width/height by itself
    // is insufficient when the page is not at 100% zoom level as it's measured
    // in CSS pixels, but the actual char size on the canvas can differ.
    this.dimensions.actualCellHeight = this.dimensions.canvasHeight / this._bufferService.rows;
    this.dimensions.actualCellWidth = this.dimensions.canvasWidth / this._bufferService.cols;
  }

  public registerCharacterJoiner(handler: CharacterJoinerHandler): number {
    return this._characterJoinerRegistry.registerCharacterJoiner(handler);
  }

  public deregisterCharacterJoiner(joinerId: number): boolean {
    return this._characterJoinerRegistry.deregisterCharacterJoiner(joinerId);
  }
}
