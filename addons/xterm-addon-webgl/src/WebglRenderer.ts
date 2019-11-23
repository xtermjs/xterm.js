/**
 * Copyright (c) 2018 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import { ITerminal } from '../../../src/Types';
import { GlyphRenderer } from './GlyphRenderer';
import { LinkRenderLayer } from './renderLayer/LinkRenderLayer';
import { CursorRenderLayer } from './renderLayer/CursorRenderLayer';
import { acquireCharAtlas } from './atlas/CharAtlasCache';
import { WebglCharAtlas } from './atlas/WebglCharAtlas';
import { RectangleRenderer } from './RectangleRenderer';
import { IWebGL2RenderingContext } from './Types';
import { RenderModel, COMBINED_CHAR_BIT_MASK, RENDER_MODEL_BG_OFFSET, RENDER_MODEL_FG_OFFSET, RENDER_MODEL_INDICIES_PER_CELL } from './RenderModel';
import { Disposable } from 'common/Lifecycle';
import { NULL_CELL_CODE } from 'common/buffer/Constants';
import { Terminal, IEvent } from 'xterm';
import { IRenderLayer } from './renderLayer/Types';
import { IRenderDimensions, IRenderer, IRequestRefreshRowsEvent } from 'browser/renderer/Types';
import { IColorSet } from 'browser/Types';
import { EventEmitter } from 'common/EventEmitter';
import { CellData } from 'common/buffer/CellData';

export class WebglRenderer extends Disposable implements IRenderer {
  private _renderLayers: IRenderLayer[];
  private _charAtlas: WebglCharAtlas | undefined;
  private _devicePixelRatio: number;

  private _model: RenderModel = new RenderModel();
  private _workCell: CellData = new CellData();

  private _canvas: HTMLCanvasElement;
  private _gl: IWebGL2RenderingContext;
  private _rectangleRenderer: RectangleRenderer;
  private _glyphRenderer: GlyphRenderer;

  public dimensions: IRenderDimensions;

  private _core: ITerminal;
  private _isAttached: boolean;

  private _onRequestRefreshRows = new EventEmitter<IRequestRefreshRowsEvent>();
  public get onRequestRefreshRows(): IEvent<IRequestRefreshRowsEvent> { return this._onRequestRefreshRows.event; }

  constructor(
    private _terminal: Terminal,
    private _colors: IColorSet,
    preserveDrawingBuffer?: boolean
  ) {
    super();

    this._core = (<any>this._terminal)._core;

    this._renderLayers = [
      new LinkRenderLayer(this._core.screenElement, 2, this._colors, this._core),
      new CursorRenderLayer(this._core.screenElement, 3, this._colors, this._onRequestRefreshRows)
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

    this._canvas = document.createElement('canvas');

    const contextAttributes = {
      antialias: false,
      depth: false,
      preserveDrawingBuffer
    };
    this._gl = this._canvas.getContext('webgl2', contextAttributes) as IWebGL2RenderingContext;
    if (!this._gl) {
        throw new Error('WebGL2 not supported');
    }
    this._core.screenElement.appendChild(this._canvas);

    this._rectangleRenderer = new RectangleRenderer(this._terminal, this._colors, this._gl, this.dimensions);
    this._glyphRenderer = new GlyphRenderer(this._terminal, this._colors, this._gl, this.dimensions);

    // Update dimensions and acquire char atlas
    this.onCharSizeChanged();

    this._isAttached = document.body.contains(this._core.screenElement);
  }

  public dispose(): void {
    this._renderLayers.forEach(l => l.dispose());
    this._core.screenElement.removeChild(this._canvas);
    super.dispose();
  }

  public setColors(colors: IColorSet): void {
    this._colors = colors;
    // Clear layers and force a full render
    this._renderLayers.forEach(l => {
      l.setColors(this._terminal, this._colors);
      l.reset(this._terminal);
    });

    this._rectangleRenderer.setColors();
    this._glyphRenderer.setColors();

    this._refreshCharAtlas();

    // Force a full refresh
    this._model.clear();
  }

  public onDevicePixelRatioChange(): void {
    // If the device pixel ratio changed, the char atlas needs to be regenerated
    // and the terminal needs to refreshed
    if (this._devicePixelRatio !== window.devicePixelRatio) {
      this._devicePixelRatio = window.devicePixelRatio;
      this.onResize(this._terminal.cols, this._terminal.rows);
    }
  }

  public onResize(cols: number, rows: number): void {
    // Update character and canvas dimensions
    this._updateDimensions();

    this._model.resize(this._terminal.cols, this._terminal.rows);
    this._rectangleRenderer.onResize();

    // Resize all render layers
    this._renderLayers.forEach(l => l.resize(this._terminal, this.dimensions));

    // Resize the canvas
    this._canvas.width = this.dimensions.scaledCanvasWidth;
    this._canvas.height = this.dimensions.scaledCanvasHeight;
    this._canvas.style.width = `${this.dimensions.canvasWidth}px`;
    this._canvas.style.height = `${this.dimensions.canvasHeight}px`;

    // Resize the screen
    this._core.screenElement.style.width = `${this.dimensions.canvasWidth}px`;
    this._core.screenElement.style.height = `${this.dimensions.canvasHeight}px`;
    this._glyphRenderer.setDimensions(this.dimensions);
    this._glyphRenderer.onResize();

    this._refreshCharAtlas();

    // Force a full refresh
    this._model.clear();
  }

  public onCharSizeChanged(): void {
    this.onResize(this._terminal.cols, this._terminal.rows);
  }

  public onBlur(): void {
    this._renderLayers.forEach(l => l.onBlur(this._terminal));
  }

  public onFocus(): void {
    this._renderLayers.forEach(l => l.onFocus(this._terminal));
  }

  public onSelectionChanged(start: [number, number], end: [number, number], columnSelectMode: boolean): void {
    this._renderLayers.forEach(l => l.onSelectionChanged(this._terminal, start, end, columnSelectMode));

    this._updateSelectionModel(start, end);

    this._rectangleRenderer.updateSelection(this._model.selection, columnSelectMode);
    this._glyphRenderer.updateSelection(this._model, columnSelectMode);

    this._onRequestRefreshRows.fire({ start: 0, end: this._terminal.rows - 1 });
  }

  public onCursorMove(): void {
    this._renderLayers.forEach(l => l.onCursorMove(this._terminal));
  }

  public onOptionsChanged(): void {
    this._renderLayers.forEach(l => l.onOptionsChanged(this._terminal));
    this._updateDimensions();
    this._refreshCharAtlas();
  }

  /**
   * Refreshes the char atlas, aquiring a new one if necessary.
   * @param terminal The terminal.
   * @param colorSet The color set to use for the char atlas.
   */
  private _refreshCharAtlas(): void {
    if (this.dimensions.scaledCharWidth <= 0 && this.dimensions.scaledCharHeight <= 0) {
      // Mark as not attached so char atlas gets refreshed on next render
      this._isAttached = false;
      return;
    }

    const atlas = acquireCharAtlas(this._terminal, this._colors, this.dimensions.scaledCharWidth, this.dimensions.scaledCharHeight);
    if (!('getRasterizedGlyph' in atlas)) {
      throw new Error('The webgl renderer only works with the webgl char atlas');
    }
    this._charAtlas = atlas as WebglCharAtlas;
    this._charAtlas.warmUp();
    this._glyphRenderer.setAtlas(this._charAtlas);
  }

  public clear(): void {
    this._renderLayers.forEach(l => l.reset(this._terminal));
  }

  public registerCharacterJoiner(handler: (text: string) => [number, number][]): number {
    return -1;
  }

  public deregisterCharacterJoiner(joinerId: number): boolean {
    return false;
  }

  public renderRows(start: number, end: number): void {
    if (!this._isAttached) {
      if (document.body.contains(this._core.screenElement) && (<any>this._core)._charSizeService.width && (<any>this._core)._charSizeService.height) {
        this._updateDimensions();
        this._refreshCharAtlas();
        this._isAttached = true;
      } else {
        return;
      }
    }

    // Update render layers
    this._renderLayers.forEach(l => l.onGridChanged(this._terminal, start, end));

    // Tell renderer the frame is beginning
    if (this._glyphRenderer.beginFrame()) {
      this._model.clear();
    }

    // Update model to reflect what's drawn
    this._updateModel(start, end);

    // Render
    this._rectangleRenderer.render();
    this._glyphRenderer.render(this._model, this._model.selection.hasSelection);
  }

  private _updateModel(start: number, end: number): void {
    const terminal = this._core;

    for (let y = start; y <= end; y++) {
      const row = y + terminal.buffer.ydisp;
      const line = terminal.buffer.lines.get(row)!;
      this._model.lineLengths[y] = 0;
      for (let x = 0; x < terminal.cols; x++) {
        line.loadCell(x, this._workCell);

        const chars = this._workCell.getChars();
        let code = this._workCell.getCode();
        const i = ((y * terminal.cols) + x) * RENDER_MODEL_INDICIES_PER_CELL;

        if (code !== NULL_CELL_CODE) {
          this._model.lineLengths[y] = x + 1;
        }

        // Nothing has changed, no updates needed
        if (this._model.cells[i] === code &&
            this._model.cells[i + RENDER_MODEL_BG_OFFSET] === this._workCell.bg &&
            this._model.cells[i + RENDER_MODEL_FG_OFFSET] === this._workCell.fg) {
          continue;
        }

        // Flag combined chars with a bit mask so they're easily identifiable
        if (chars.length > 1) {
          code = code | COMBINED_CHAR_BIT_MASK;
        }

        // Cache the results in the model
        this._model.cells[i] = code;
        this._model.cells[i + RENDER_MODEL_BG_OFFSET] = this._workCell.bg;
        this._model.cells[i + RENDER_MODEL_FG_OFFSET] = this._workCell.fg;

        this._glyphRenderer.updateCell(x, y, code, this._workCell.bg, this._workCell.fg, chars);
      }
    }
    this._rectangleRenderer.updateBackgrounds(this._model);
  }

  private _updateSelectionModel(start: [number, number], end: [number, number]): void {
    const terminal = this._terminal;

    // Selection does not exist
    if (!start || !end || (start[0] === end[0] && start[1] === end[1])) {
      this._model.clearSelection();
      return;
    }

    // Translate from buffer position to viewport position
    const viewportStartRow = start[1] - terminal.buffer.viewportY;
    const viewportEndRow = end[1] - terminal.buffer.viewportY;
    const viewportCappedStartRow = Math.max(viewportStartRow, 0);
    const viewportCappedEndRow = Math.min(viewportEndRow, terminal.rows - 1);

    // No need to draw the selection
    if (viewportCappedStartRow >= terminal.rows || viewportCappedEndRow < 0) {
      this._model.clearSelection();
      return;
    }

    this._model.selection.hasSelection = true;
    this._model.selection.viewportStartRow = viewportStartRow;
    this._model.selection.viewportEndRow = viewportEndRow;
    this._model.selection.viewportCappedStartRow = viewportCappedStartRow;
    this._model.selection.viewportCappedEndRow = viewportCappedEndRow;
    this._model.selection.startCol = start[0];
    this._model.selection.endCol = end[0];
  }

  /**
   * Recalculates the character and canvas dimensions.
   */
  private _updateDimensions(): void {
    // TODO: Acquire CharSizeService properly

    // Perform a new measure if the CharMeasure dimensions are not yet available
    if (!(<any>this._core)._charSizeService.width || !(<any>this._core)._charSizeService.height) {
      return;
    }

    // Calculate the scaled character width. Width is floored as it must be
    // drawn to an integer grid in order for the CharAtlas "stamps" to not be
    // blurry. When text is drawn to the grid not using the CharAtlas, it is
    // clipped to ensure there is no overlap with the next cell.

    // NOTE: ceil fixes sometime, floor does others :s

    this.dimensions.scaledCharWidth = Math.floor((<any>this._core)._charSizeService.width * this._devicePixelRatio);

    // Calculate the scaled character height. Height is ceiled in case
    // devicePixelRatio is a floating point number in order to ensure there is
    // enough space to draw the character to the cell.
    this.dimensions.scaledCharHeight = Math.ceil((<any>this._core)._charSizeService.height * this._devicePixelRatio);

    // Calculate the scaled cell height, if lineHeight is not 1 then the value
    // will be floored because since lineHeight can never be lower then 1, there
    // is a guarentee that the scaled line height will always be larger than
    // scaled char height.
    this.dimensions.scaledCellHeight = Math.floor(this.dimensions.scaledCharHeight * this._terminal.getOption('lineHeight'));

    // Calculate the y coordinate within a cell that text should draw from in
    // order to draw in the center of a cell.
    this.dimensions.scaledCharTop = this._terminal.getOption('lineHeight') === 1 ? 0 : Math.round((this.dimensions.scaledCellHeight - this.dimensions.scaledCharHeight) / 2);

    // Calculate the scaled cell width, taking the letterSpacing into account.
    this.dimensions.scaledCellWidth = this.dimensions.scaledCharWidth + Math.round(this._terminal.getOption('letterSpacing'));

    // Calculate the x coordinate with a cell that text should draw from in
    // order to draw in the center of a cell.
    this.dimensions.scaledCharLeft = Math.floor(this._terminal.getOption('letterSpacing') / 2);

    // Recalculate the canvas dimensions; scaled* define the actual number of
    // pixel in the canvas
    this.dimensions.scaledCanvasHeight = this._terminal.rows * this.dimensions.scaledCellHeight;
    this.dimensions.scaledCanvasWidth = this._terminal.cols * this.dimensions.scaledCellWidth;

    // The the size of the canvas on the page. It's very important that this
    // rounds to nearest integer and not ceils as browsers often set
    // window.devicePixelRatio as something like 1.100000023841858, when it's
    // actually 1.1. Ceiling causes blurriness as the backing canvas image is 1
    // pixel too large for the canvas element size.
    this.dimensions.canvasHeight = Math.round(this.dimensions.scaledCanvasHeight / this._devicePixelRatio);
    this.dimensions.canvasWidth = Math.round(this.dimensions.scaledCanvasWidth / this._devicePixelRatio);

    // this.dimensions.scaledCanvasHeight = this.dimensions.canvasHeight * devicePixelRatio;
    // this.dimensions.scaledCanvasWidth = this.dimensions.canvasWidth * devicePixelRatio;

    // Get the _actual_ dimensions of an individual cell. This needs to be
    // derived from the canvasWidth/Height calculated above which takes into
    // account window.devicePixelRatio. CharMeasure.width/height by itself is
    // insufficient when the page is not at 100% zoom level as CharMeasure is
    // measured in CSS pixels, but the actual char size on the canvas can
    // differ.
    // this.dimensions.actualCellHeight = this.dimensions.canvasHeight / this._terminal.rows;
    // this.dimensions.actualCellWidth = this.dimensions.canvasWidth / this._terminal.cols;

    // This fixes 110% and 125%, not 150% or 175% though
    this.dimensions.actualCellHeight = this.dimensions.scaledCellHeight / this._devicePixelRatio;
    this.dimensions.actualCellWidth = this.dimensions.scaledCellWidth / this._devicePixelRatio;
  }
}
