/**
 * Copyright (c) 2018 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import { addDisposableDomListener } from 'browser/Lifecycle';
import { ITerminal } from 'browser/Types';
import { CellColorResolver } from 'browser/renderer/shared/CellColorResolver';
import { acquireTextureAtlas, removeTerminalFromCache } from 'browser/renderer/shared/CharAtlasCache';
import { CursorBlinkStateManager } from 'browser/renderer/shared/CursorBlinkStateManager';
import { observeDevicePixelDimensions } from 'browser/renderer/shared/DevicePixelObserver';
import { createRenderDimensions } from 'browser/renderer/shared/RendererUtils';
import { IRenderDimensions, IRenderer, IRequestRedrawEvent, ITextureAtlas } from 'browser/renderer/shared/Types';
import { ICharSizeService, ICharacterJoinerService, ICoreBrowserService, IThemeService } from 'browser/services/Services';
import { EventEmitter, forwardEvent } from 'common/EventEmitter';
import { Disposable, MutableDisposable, getDisposeArrayDisposable, toDisposable } from 'common/Lifecycle';
import { CharData, IBufferLine, ICellData } from 'common/Types';
import { AttributeData } from 'common/buffer/AttributeData';
import { CellData } from 'common/buffer/CellData';
import { Attributes, Content, NULL_CELL_CHAR, NULL_CELL_CODE } from 'common/buffer/Constants';
import { ICoreService, IDecorationService, IOptionsService } from 'common/services/Services';
import { Terminal } from '@xterm/xterm';
import { GlyphRenderer } from './GlyphRenderer';
import { RectangleRenderer } from './RectangleRenderer';
import { COMBINED_CHAR_BIT_MASK, RENDER_MODEL_BG_OFFSET, RENDER_MODEL_EXT_OFFSET, RENDER_MODEL_FG_OFFSET, RENDER_MODEL_INDICIES_PER_CELL, RenderModel } from './RenderModel';
import { IWebGL2RenderingContext } from './Types';
import { LinkRenderLayer } from './renderLayer/LinkRenderLayer';
import { IRenderLayer } from './renderLayer/Types';

export class WebglRenderer extends Disposable implements IRenderer {
  private _renderLayers: IRenderLayer[];
  private _cursorBlinkStateManager: MutableDisposable<CursorBlinkStateManager> = new MutableDisposable();
  private _charAtlasDisposable = this.register(new MutableDisposable());
  private _charAtlas: ITextureAtlas | undefined;
  private _devicePixelRatio: number;
  private _observerDisposable = this.register(new MutableDisposable());

  private _model: RenderModel = new RenderModel();
  private _workCell: ICellData = new CellData();
  private _workCell2: ICellData = new CellData();
  private _cellColorResolver: CellColorResolver;

  private _canvas: HTMLCanvasElement;
  private _gl: IWebGL2RenderingContext;
  private _rectangleRenderer: MutableDisposable<RectangleRenderer> = this.register(new MutableDisposable());
  private _glyphRenderer: MutableDisposable<GlyphRenderer> = this.register(new MutableDisposable());

  public readonly dimensions: IRenderDimensions;

  private _core: ITerminal;
  private _isAttached: boolean;
  private _contextRestorationTimeout: number | undefined;

  private readonly _onChangeTextureAtlas = this.register(new EventEmitter<HTMLCanvasElement>());
  public readonly onChangeTextureAtlas = this._onChangeTextureAtlas.event;
  private readonly _onAddTextureAtlasCanvas = this.register(new EventEmitter<HTMLCanvasElement>());
  public readonly onAddTextureAtlasCanvas = this._onAddTextureAtlasCanvas.event;
  private readonly _onRemoveTextureAtlasCanvas = this.register(new EventEmitter<HTMLCanvasElement>());
  public readonly onRemoveTextureAtlasCanvas = this._onRemoveTextureAtlasCanvas.event;
  private readonly _onRequestRedraw = this.register(new EventEmitter<IRequestRedrawEvent>());
  public readonly onRequestRedraw = this._onRequestRedraw.event;
  private readonly _onContextLoss = this.register(new EventEmitter<void>());
  public readonly onContextLoss = this._onContextLoss.event;

  constructor(
    private _terminal: Terminal,
    private readonly _characterJoinerService: ICharacterJoinerService,
    private readonly _charSizeService: ICharSizeService,
    private readonly _coreBrowserService: ICoreBrowserService,
    private readonly _coreService: ICoreService,
    private readonly _decorationService: IDecorationService,
    private readonly _optionsService: IOptionsService,
    private readonly _themeService: IThemeService,
    preserveDrawingBuffer?: boolean
  ) {
    super();

    this.register(this._themeService.onChangeColors(() => this._handleColorChange()));

    this._cellColorResolver = new CellColorResolver(this._terminal, this._optionsService, this._model.selection, this._decorationService, this._coreBrowserService, this._themeService);

    this._core = (this._terminal as any)._core;

    this._renderLayers = [
      new LinkRenderLayer(this._core.screenElement!, 2, this._terminal, this._core.linkifier!, this._coreBrowserService, _optionsService, this._themeService)
    ];
    this.dimensions = createRenderDimensions();
    this._devicePixelRatio = this._coreBrowserService.dpr;
    this._updateDimensions();
    this._updateCursorBlink();
    this.register(_optionsService.onOptionChange(() => this._handleOptionsChanged()));

    this._canvas = this._coreBrowserService.mainDocument.createElement('canvas');

    const contextAttributes = {
      antialias: false,
      depth: false,
      preserveDrawingBuffer
    };
    this._gl = this._canvas.getContext('webgl2', contextAttributes) as IWebGL2RenderingContext;
    if (!this._gl) {
      throw new Error('WebGL2 not supported ' + this._gl);
    }

    this.register(addDisposableDomListener(this._canvas, 'webglcontextlost', (e) => {
      console.log('webglcontextlost event received');
      // Prevent the default behavior in order to enable WebGL context restoration.
      e.preventDefault();
      // Wait a few seconds to see if the 'webglcontextrestored' event is fired.
      // If not, dispatch the onContextLoss notification to observers.
      this._contextRestorationTimeout = setTimeout(() => {
        this._contextRestorationTimeout = undefined;
        console.warn('webgl context not restored; firing onContextLoss');
        this._onContextLoss.fire(e);
      }, 3000 /* ms */);
    }));
    this.register(addDisposableDomListener(this._canvas, 'webglcontextrestored', (e) => {
      console.warn('webglcontextrestored event received');
      clearTimeout(this._contextRestorationTimeout);
      this._contextRestorationTimeout = undefined;
      // The texture atlas and glyph renderer must be fully reinitialized
      // because their contents have been lost.
      removeTerminalFromCache(this._terminal);
      this._initializeWebGLState();
      this._requestRedrawViewport();
    }));

    this._observerDisposable.value = observeDevicePixelDimensions(this._canvas, this._coreBrowserService.window, (w, h) => this._setCanvasDevicePixelDimensions(w, h));
    this.register(this._coreBrowserService.onWindowChange(w => {
      this._observerDisposable.value = observeDevicePixelDimensions(this._canvas, w, (w, h) => this._setCanvasDevicePixelDimensions(w, h));
    }));

    this._core.screenElement!.appendChild(this._canvas);

    [this._rectangleRenderer.value, this._glyphRenderer.value] = this._initializeWebGLState();

    this._isAttached = this._coreBrowserService.window.document.body.contains(this._core.screenElement!);

    this.register(toDisposable(() => {
      for (const l of this._renderLayers) {
        l.dispose();
      }
      this._canvas.parentElement?.removeChild(this._canvas);
      removeTerminalFromCache(this._terminal);
    }));
  }

  public get textureAtlas(): HTMLCanvasElement | undefined {
    return this._charAtlas?.pages[0].canvas;
  }

  private _handleColorChange(): void {
    this._refreshCharAtlas();

    // Force a full refresh
    this._clearModel(true);
  }

  public handleDevicePixelRatioChange(): void {
    // If the device pixel ratio changed, the char atlas needs to be regenerated
    // and the terminal needs to refreshed
    if (this._devicePixelRatio !== this._coreBrowserService.dpr) {
      this._devicePixelRatio = this._coreBrowserService.dpr;
      this.handleResize(this._terminal.cols, this._terminal.rows);
    }
  }

  public handleResize(cols: number, rows: number): void {
    // Update character and canvas dimensions
    this._updateDimensions();

    this._model.resize(this._terminal.cols, this._terminal.rows);

    // Resize all render layers
    for (const l of this._renderLayers) {
      l.resize(this._terminal, this.dimensions);
    }

    // Resize the canvas
    this._canvas.width = this.dimensions.device.canvas.width;
    this._canvas.height = this.dimensions.device.canvas.height;
    this._canvas.style.width = `${this.dimensions.css.canvas.width}px`;
    this._canvas.style.height = `${this.dimensions.css.canvas.height}px`;

    // Resize the screen
    this._core.screenElement!.style.width = `${this.dimensions.css.canvas.width}px`;
    this._core.screenElement!.style.height = `${this.dimensions.css.canvas.height}px`;

    this._rectangleRenderer.value?.setDimensions(this.dimensions);
    this._rectangleRenderer.value?.handleResize();
    this._glyphRenderer.value?.setDimensions(this.dimensions);
    this._glyphRenderer.value?.handleResize();

    this._refreshCharAtlas();

    // Force a full refresh. Resizing `_glyphRenderer` should clear it already,
    // so there is no need to clear it again here.
    this._clearModel(false);
  }

  public handleCharSizeChanged(): void {
    this.handleResize(this._terminal.cols, this._terminal.rows);
  }

  public handleBlur(): void {
    for (const l of this._renderLayers) {
      l.handleBlur(this._terminal);
    }
    this._cursorBlinkStateManager.value?.pause();
    // Request a redraw for active/inactive selection background
    this._requestRedrawViewport();
  }

  public handleFocus(): void {
    for (const l of this._renderLayers) {
      l.handleFocus(this._terminal);
    }
    this._cursorBlinkStateManager.value?.resume();
    // Request a redraw for active/inactive selection background
    this._requestRedrawViewport();
  }

  public handleSelectionChanged(start: [number, number] | undefined, end: [number, number] | undefined, columnSelectMode: boolean): void {
    for (const l of this._renderLayers) {
      l.handleSelectionChanged(this._terminal, start, end, columnSelectMode);
    }
    this._model.selection.update(this._core, start, end, columnSelectMode);
    this._requestRedrawViewport();
  }

  public handleCursorMove(): void {
    for (const l of this._renderLayers) {
      l.handleCursorMove(this._terminal);
    }
    this._cursorBlinkStateManager.value?.restartBlinkAnimation();
  }

  private _handleOptionsChanged(): void {
    this._updateDimensions();
    this._refreshCharAtlas();
    this._updateCursorBlink();
  }

  /**
   * Initializes members dependent on WebGL context state.
   */
  private _initializeWebGLState(): [RectangleRenderer, GlyphRenderer] {
    this._rectangleRenderer.value = new RectangleRenderer(this._terminal, this._gl, this.dimensions, this._themeService);
    this._glyphRenderer.value = new GlyphRenderer(this._terminal, this._gl, this.dimensions, this._optionsService);

    // Update dimensions and acquire char atlas
    this.handleCharSizeChanged();

    return [this._rectangleRenderer.value, this._glyphRenderer.value];
  }

  /**
   * Refreshes the char atlas, aquiring a new one if necessary.
   */
  private _refreshCharAtlas(): void {
    if (this.dimensions.device.char.width <= 0 && this.dimensions.device.char.height <= 0) {
      // Mark as not attached so char atlas gets refreshed on next render
      this._isAttached = false;
      return;
    }

    const atlas = acquireTextureAtlas(
      this._terminal,
      this._optionsService.rawOptions,
      this._themeService.colors,
      this.dimensions.device.cell.width,
      this.dimensions.device.cell.height,
      this.dimensions.device.char.width,
      this.dimensions.device.char.height,
      this._coreBrowserService.dpr
    );
    if (this._charAtlas !== atlas) {
      this._onChangeTextureAtlas.fire(atlas.pages[0].canvas);
      this._charAtlasDisposable.value = getDisposeArrayDisposable([
        forwardEvent(atlas.onAddTextureAtlasCanvas, this._onAddTextureAtlasCanvas),
        forwardEvent(atlas.onRemoveTextureAtlasCanvas, this._onRemoveTextureAtlasCanvas)
      ]);
    }
    this._charAtlas = atlas;
    this._charAtlas.warmUp();
    this._glyphRenderer.value?.setAtlas(this._charAtlas);
  }

  /**
   * Clear the model.
   * @param clearGlyphRenderer Whether to also clear the glyph renderer. This
   * should be true generally to make sure it is in the same state as the model.
   */
  private _clearModel(clearGlyphRenderer: boolean): void {
    this._model.clear();
    if (clearGlyphRenderer) {
      this._glyphRenderer.value?.clear();
    }
  }

  public clearTextureAtlas(): void {
    this._charAtlas?.clearTexture();
    this._clearModel(true);
    this._requestRedrawViewport();
  }

  public clear(): void {
    this._clearModel(true);
    for (const l of this._renderLayers) {
      l.reset(this._terminal);
    }

    this._cursorBlinkStateManager.value?.restartBlinkAnimation();
    this._updateCursorBlink();
  }

  public registerCharacterJoiner(handler: (text: string) => [number, number][]): number {
    return -1;
  }

  public deregisterCharacterJoiner(joinerId: number): boolean {
    return false;
  }

  public renderRows(start: number, end: number): void {
    if (!this._isAttached) {
      if (this._coreBrowserService.window.document.body.contains(this._core.screenElement!) && this._charSizeService.width && this._charSizeService.height) {
        this._updateDimensions();
        this._refreshCharAtlas();
        this._isAttached = true;
      } else {
        return;
      }
    }

    // Update render layers
    for (const l of this._renderLayers) {
      l.handleGridChanged(this._terminal, start, end);
    }

    if (!this._glyphRenderer.value || !this._rectangleRenderer.value) {
      return;
    }

    // Tell renderer the frame is beginning
    // upon a model clear also refresh the full viewport model
    // (also triggered by an atlas page merge, part of #4480)
    if (this._glyphRenderer.value.beginFrame()) {
      this._clearModel(true);
      this._updateModel(0, this._terminal.rows - 1);
    } else {
      // just update changed lines to draw
      this._updateModel(start, end);
    }

    // Render
    this._rectangleRenderer.value.renderBackgrounds();
    this._glyphRenderer.value.render(this._model);
    if (!this._cursorBlinkStateManager.value || this._cursorBlinkStateManager.value.isCursorVisible) {
      this._rectangleRenderer.value.renderCursor();
    }
  }

  private _updateCursorBlink(): void {
    if (this._terminal.options.cursorBlink) {
      this._cursorBlinkStateManager.value = new CursorBlinkStateManager(() => {
        this._requestRedrawCursor();
      }, this._coreBrowserService);
    } else {
      this._cursorBlinkStateManager.clear();
    }
    // Request a refresh from the terminal as management of rendering is being
    // moved back to the terminal
    this._requestRedrawCursor();
  }

  private _updateModel(start: number, end: number): void {
    const terminal = this._core;
    let cell: ICellData = this._workCell;

    // Declare variable ahead of time to avoid garbage collection
    let lastBg: number;
    let y: number;
    let row: number;
    let line: IBufferLine;
    let joinedRanges: [number, number][];
    let isJoined: boolean;
    let lastCharX: number;
    let range: [number, number];
    let chars: string;
    let code: number;
    let width: number;
    let i: number;
    let x: number;
    let j: number;
    start = clamp(start, terminal.rows - 1, 0);
    end = clamp(end, terminal.rows - 1, 0);

    const cursorY = this._terminal.buffer.active.baseY + this._terminal.buffer.active.cursorY;
    const viewportRelativeCursorY = cursorY - terminal.buffer.ydisp;
    // in case cursor.x == cols adjust visual cursor to cols - 1
    const cursorX = Math.min(this._terminal.buffer.active.cursorX, terminal.cols - 1);
    let lastCursorX = -1;
    const isCursorVisible =
      this._coreService.isCursorInitialized &&
      !this._coreService.isCursorHidden &&
      (!this._cursorBlinkStateManager.value || this._cursorBlinkStateManager.value.isCursorVisible);
    this._model.cursor = undefined;
    let modelUpdated = false;

    for (y = start; y <= end; y++) {
      row = y + terminal.buffer.ydisp;
      line = terminal.buffer.lines.get(row)!;
      this._model.lineLengths[y] = 0;
      joinedRanges = this._characterJoinerService.getJoinedCharacters(row);
      for (x = 0; x < terminal.cols; x++) {
        lastBg = this._cellColorResolver.result.bg;
        line.loadCell(x, cell);

        if (x === 0) {
          lastBg = this._cellColorResolver.result.bg;
        }

        // If true, indicates that the current character(s) to draw were joined.
        isJoined = false;
        lastCharX = x;

        // Process any joined character ranges as needed. Because of how the
        // ranges are produced, we know that they are valid for the characters
        // and attributes of our input.
        if (joinedRanges.length > 0 && x === joinedRanges[0][0]) {
          isJoined = true;
          range = joinedRanges.shift()!;

          // We already know the exact start and end column of the joined range,
          // so we get the string and width representing it directly.
          cell = new JoinedCellData(
            cell,
            line!.translateToString(true, range[0], range[1]),
            range[1] - range[0]
          );

          // Skip over the cells occupied by this range in the loop
          lastCharX = range[1] - 1;
        }

        chars = cell.getChars();
        code = cell.getCode();
        i = ((y * terminal.cols) + x) * RENDER_MODEL_INDICIES_PER_CELL;

        // Load colors/resolve overrides into work colors
        this._cellColorResolver.resolve(cell, x, row, this.dimensions.device.cell.width);

        // Override colors for cursor cell
        if (isCursorVisible && row === cursorY) {
          if (x === cursorX) {
            this._model.cursor = {
              x: cursorX,
              y: viewportRelativeCursorY,
              width: cell.getWidth(),
              style: this._coreBrowserService.isFocused ?
                (terminal.options.cursorStyle || 'block') : terminal.options.cursorInactiveStyle,
              cursorWidth: terminal.options.cursorWidth,
              dpr: this._devicePixelRatio
            };
            lastCursorX = cursorX + cell.getWidth() - 1;
          }
          if (x >= cursorX && x <= lastCursorX &&
              ((this._coreBrowserService.isFocused &&
              (terminal.options.cursorStyle || 'block') === 'block') ||
              (this._coreBrowserService.isFocused === false &&
              terminal.options.cursorInactiveStyle === 'block'))) {
            this._cellColorResolver.result.fg =
              Attributes.CM_RGB | (this._themeService.colors.cursorAccent.rgba >> 8 & Attributes.RGB_MASK);
            this._cellColorResolver.result.bg =
              Attributes.CM_RGB | (this._themeService.colors.cursor.rgba >> 8 & Attributes.RGB_MASK);
          }
        }

        if (code !== NULL_CELL_CODE) {
          this._model.lineLengths[y] = x + 1;
        }

        // Nothing has changed, no updates needed
        if (this._model.cells[i] === code &&
            this._model.cells[i + RENDER_MODEL_BG_OFFSET] === this._cellColorResolver.result.bg &&
            this._model.cells[i + RENDER_MODEL_FG_OFFSET] === this._cellColorResolver.result.fg &&
            this._model.cells[i + RENDER_MODEL_EXT_OFFSET] === this._cellColorResolver.result.ext) {
          continue;
        }

        modelUpdated = true;

        // Flag combined chars with a bit mask so they're easily identifiable
        if (chars.length > 1) {
          code |= COMBINED_CHAR_BIT_MASK;
        }

        // Cache the results in the model
        this._model.cells[i] = code;
        this._model.cells[i + RENDER_MODEL_BG_OFFSET] = this._cellColorResolver.result.bg;
        this._model.cells[i + RENDER_MODEL_FG_OFFSET] = this._cellColorResolver.result.fg;
        this._model.cells[i + RENDER_MODEL_EXT_OFFSET] = this._cellColorResolver.result.ext;

        width = cell.getWidth();
        this._glyphRenderer.value!.updateCell(x, y, code, this._cellColorResolver.result.bg, this._cellColorResolver.result.fg, this._cellColorResolver.result.ext, chars, width, lastBg);

        if (isJoined) {
          // Restore work cell
          cell = this._workCell;

          // Null out non-first cells
          for (x++; x < lastCharX; x++) {
            j = ((y * terminal.cols) + x) * RENDER_MODEL_INDICIES_PER_CELL;
            this._glyphRenderer.value!.updateCell(x, y, NULL_CELL_CODE, 0, 0, 0, NULL_CELL_CHAR, 0, 0);
            this._model.cells[j] = NULL_CELL_CODE;
            this._model.cells[j + RENDER_MODEL_BG_OFFSET] = this._cellColorResolver.result.bg;
            this._model.cells[j + RENDER_MODEL_FG_OFFSET] = this._cellColorResolver.result.fg;
            this._model.cells[j + RENDER_MODEL_EXT_OFFSET] = this._cellColorResolver.result.ext;
          }
        }
      }
    }
    if (modelUpdated) {
      this._rectangleRenderer.value!.updateBackgrounds(this._model);
    }
    this._rectangleRenderer.value!.updateCursor(this._model);
  }

  /**
   * Recalculates the character and canvas dimensions.
   */
  private _updateDimensions(): void {
    // Perform a new measure if the CharMeasure dimensions are not yet available
    if (!this._charSizeService.width || !this._charSizeService.height) {
      return;
    }

    // Calculate the device character width. Width is floored as it must be drawn to an integer grid
    // in order for the char atlas glyphs to not be blurry.
    this.dimensions.device.char.width = Math.floor(this._charSizeService.width * this._devicePixelRatio);

    // Calculate the device character height. Height is ceiled in case devicePixelRatio is a
    // floating point number in order to ensure there is enough space to draw the character to the
    // cell.
    this.dimensions.device.char.height = Math.ceil(this._charSizeService.height * this._devicePixelRatio);

    // Calculate the device cell height, if lineHeight is _not_ 1, the resulting value will be
    // floored since lineHeight can never be lower then 1, this guarentees the device cell height
    // will always be larger than device char height.
    this.dimensions.device.cell.height = Math.floor(this.dimensions.device.char.height * this._optionsService.rawOptions.lineHeight);

    // Calculate the y offset within a cell that glyph should draw at in order for it to be centered
    // correctly within the cell.
    this.dimensions.device.char.top = this._optionsService.rawOptions.lineHeight === 1 ? 0 : Math.round((this.dimensions.device.cell.height - this.dimensions.device.char.height) / 2);

    // Calculate the device cell width, taking the letterSpacing into account.
    this.dimensions.device.cell.width = this.dimensions.device.char.width + Math.round(this._optionsService.rawOptions.letterSpacing);

    // Calculate the x offset with a cell that text should draw from in order for it to be centered
    // correctly within the cell.
    this.dimensions.device.char.left = Math.floor(this._optionsService.rawOptions.letterSpacing / 2);

    // Recalculate the canvas dimensions, the device dimensions define the actual number of pixel in
    // the canvas
    this.dimensions.device.canvas.height = this._terminal.rows * this.dimensions.device.cell.height;
    this.dimensions.device.canvas.width = this._terminal.cols * this.dimensions.device.cell.width;

    // The the size of the canvas on the page. It's important that this rounds to nearest integer
    // and not ceils as browsers often have floating point precision issues where
    // `window.devicePixelRatio` ends up being something like `1.100000023841858` for example, when
    // it's actually 1.1. Ceiling may causes blurriness as the backing canvas image is 1 pixel too
    // large for the canvas element size.
    this.dimensions.css.canvas.height = Math.round(this.dimensions.device.canvas.height / this._devicePixelRatio);
    this.dimensions.css.canvas.width = Math.round(this.dimensions.device.canvas.width / this._devicePixelRatio);

    // Get the CSS dimensions of an individual cell. This needs to be derived from the calculated
    // device pixel canvas value above. CharMeasure.width/height by itself is insufficient when the
    // page is not at 100% zoom level as CharMeasure is measured in CSS pixels, but the actual char
    // size on the canvas can differ.
    this.dimensions.css.cell.height = this.dimensions.device.cell.height / this._devicePixelRatio;
    this.dimensions.css.cell.width = this.dimensions.device.cell.width / this._devicePixelRatio;
  }

  private _setCanvasDevicePixelDimensions(width: number, height: number): void {
    if (this._canvas.width === width && this._canvas.height === height) {
      return;
    }
    // While the actual canvas size has changed, keep device canvas dimensions as the value before
    // the change as it's an exact multiple of the cell sizes.
    this._canvas.width = width;
    this._canvas.height = height;
    this._requestRedrawViewport();
  }

  private _requestRedrawViewport(): void {
    this._onRequestRedraw.fire({ start: 0, end: this._terminal.rows - 1 });
  }

  private _requestRedrawCursor(): void {
    const cursorY = this._terminal.buffer.active.cursorY;
    this._onRequestRedraw.fire({ start: cursorY, end: cursorY });
  }
}

// TODO: Share impl with core
export class JoinedCellData extends AttributeData implements ICellData {
  private _width: number;
  // .content carries no meaning for joined CellData, simply nullify it
  // thus we have to overload all other .content accessors
  public content: number = 0;
  public fg: number;
  public bg: number;
  public combinedData: string = '';

  constructor(firstCell: ICellData, chars: string, width: number) {
    super();
    this.fg = firstCell.fg;
    this.bg = firstCell.bg;
    this.combinedData = chars;
    this._width = width;
  }

  public isCombined(): number {
    // always mark joined cell data as combined
    return Content.IS_COMBINED_MASK;
  }

  public getWidth(): number {
    return this._width;
  }

  public getChars(): string {
    return this.combinedData;
  }

  public getCode(): number {
    // code always gets the highest possible fake codepoint (read as -1)
    // this is needed as code is used by caches as identifier
    return 0x1FFFFF;
  }

  public setFromCharData(value: CharData): void {
    throw new Error('not implemented');
  }

  public getAsCharData(): CharData {
    return [this.fg, this.getChars(), this.getWidth(), this.getCode()];
  }
}

function clamp(value: number, max: number, min: number = 0): number {
  return Math.max(Math.min(value, max), min);
}
