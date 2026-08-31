/**
 * Copyright (c) 2018 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import { ITerminal } from 'browser/Types';
import { CellColorResolver } from './CellColorResolver';
import { acquireTextureAtlas, removeTerminalFromCache } from './CharAtlasCache';
import { CursorBlinkStateManager } from './CursorBlinkStateManager';
import { observeDevicePixelDimensions } from './DevicePixelObserver';
import { IRenderDimensions, IRenderer, IRequestRedrawEvent } from 'browser/renderer/shared/Types';
import { ICharSizeService, ICharacterJoinerService, ICoreBrowserService, IThemeService } from 'browser/services/Services';
import { CharData, IBufferLine, ICellData } from 'common/buffer/Types';
import { AttributeData } from 'common/buffer/AttributeData';
import { CellData } from 'common/buffer/CellData';
import { Attributes, Content, FgFlags, NULL_CELL_CHAR, NULL_CELL_CODE } from 'common/buffer/Constants';
import { TextBlinkStateManager } from 'browser/renderer/shared/TextBlinkStateManager';
import { ICoreService, IDecorationService, ILogService, IOptionsService } from 'common/services/Services';
import { Terminal } from '@xterm/xterm';
import { GlyphRenderer, type IWebgpuRenderDiagnostics } from './GlyphRenderer';
import { RectangleRenderer } from './RectangleRenderer';
import { COMBINED_CHAR_BIT_MASK, RenderModel, RenderModelConstants } from './RenderModel';
import { type ITextureAtlas, type IWebgpuDeviceLostEvent } from './Types';
import { LinkRenderLayer } from './renderLayer/LinkRenderLayer';
import { IRenderLayer } from './renderLayer/Types';
import { Emitter, EventUtils } from 'common/Event';
import { addDisposableListener } from 'browser/Dom';
import { combinedDisposable, Disposable, MutableDisposable, toDisposable } from 'common/Lifecycle';
import { createRenderDimensions } from 'browser/renderer/shared/RendererUtils';
import { toError } from './WebgpuUtils';

const enum Constants {
  MERGE_RETRY_LIMIT = 32
}

export class WebgpuRenderer extends Disposable implements IRenderer {
  private _renderLayers: IRenderLayer[];
  private _cursorBlinkStateManager: MutableDisposable<CursorBlinkStateManager> = this._register(new MutableDisposable());
  private _textBlinkStateManager: TextBlinkStateManager;
  private _charAtlasDisposable = this._register(new MutableDisposable());
  private _charAtlas: ITextureAtlas | undefined;
  private _devicePixelRatio: number;
  private _deviceMaxTextureSize: number;
  private _observerDisposable = this._register(new MutableDisposable());

  private _model: RenderModel = new RenderModel();
  private _rowHasBlinkingCells: boolean[] = [];
  private _rowHasBlinkingCellsCount: number = 0;
  private _workCell: ICellData = new CellData();
  private _cellColorResolver: CellColorResolver;

  private _canvas: HTMLCanvasElement;
  private readonly _colorAttachment: GPURenderPassColorAttachment;
  private readonly _renderPassDescriptor: GPURenderPassDescriptor;
  private readonly _commandBuffers: GPUCommandBuffer[] = [];
  private _isDisposed = false;
  private _rectangleRenderer: MutableDisposable<RectangleRenderer> = this._register(new MutableDisposable());
  private _glyphRenderer: MutableDisposable<GlyphRenderer> = this._register(new MutableDisposable());

  public readonly dimensions: IRenderDimensions;

  private _core: ITerminal;
  private _isAttached: boolean;

  private readonly _onChangeTextureAtlas = this._register(new Emitter<HTMLCanvasElement>());
  public readonly onChangeTextureAtlas = this._onChangeTextureAtlas.event;
  private readonly _onAddTextureAtlasCanvas = this._register(new Emitter<HTMLCanvasElement>());
  public readonly onAddTextureAtlasCanvas = this._onAddTextureAtlasCanvas.event;
  private readonly _onRemoveTextureAtlasCanvas = this._register(new Emitter<HTMLCanvasElement>());
  public readonly onRemoveTextureAtlasCanvas = this._onRemoveTextureAtlasCanvas.event;
  private readonly _onRequestRedraw = this._register(new Emitter<IRequestRedrawEvent>());
  public readonly onRequestRedraw = this._onRequestRedraw.event;
  private readonly _onRendererError = this._register(new Emitter<Error>());
  public readonly onRendererError = this._onRendererError.event;
  private readonly _onDeviceLoss = this._register(new Emitter<IWebgpuDeviceLostEvent>());
  public readonly onDeviceLoss = this._onDeviceLoss.event;
  private _deviceLoss: IWebgpuDeviceLostEvent | undefined;

  public static async create(
    terminal: Terminal,
    characterJoinerService: ICharacterJoinerService,
    charSizeService: ICharSizeService,
    coreBrowserService: ICoreBrowserService,
    coreService: ICoreService,
    decorationService: IDecorationService,
    logService: ILogService,
    optionsService: IOptionsService,
    themeService: IThemeService,
    customGlyphs: boolean = true
  ): Promise<WebgpuRenderer> {
    const gpu = coreBrowserService.window.navigator.gpu;
    if (!gpu) {
      throw new Error('WebGPU is not supported in this browser or context');
    }
    const adapter = await gpu.requestAdapter();
    if (!adapter) {
      throw new Error('WebGPU did not provide a compatible GPU adapter');
    }
    const device = await adapter.requestDevice();
    const canvas = coreBrowserService.mainDocument.createElement('canvas');
    const context = canvas.getContext('webgpu') as GPUCanvasContext | null;
    if (!context) {
      device.destroy();
      throw new Error('Could not create a WebGPU canvas context');
    }
    try {
      return new WebgpuRenderer(
        terminal,
        characterJoinerService,
        charSizeService,
        coreBrowserService,
        coreService,
        decorationService,
        logService,
        optionsService,
        themeService,
        customGlyphs,
        canvas,
        context,
        device,
        gpu.getPreferredCanvasFormat()
      );
    } catch (error) {
      context.unconfigure();
      device.destroy();
      throw error;
    }
  }

  private constructor(
    private _terminal: Terminal,
    private readonly _characterJoinerService: ICharacterJoinerService,
    private readonly _charSizeService: ICharSizeService,
    private readonly _coreBrowserService: ICoreBrowserService,
    private readonly _coreService: ICoreService,
    private readonly _decorationService: IDecorationService,
    private readonly _logService: ILogService,
    private readonly _optionsService: IOptionsService,
    private readonly _themeService: IThemeService,
    private readonly _customGlyphs: boolean = true,
    canvas: HTMLCanvasElement,
    private readonly _context: GPUCanvasContext,
    private readonly _device: GPUDevice,
    private readonly _canvasFormat: GPUTextureFormat
  ) {
    super();
    this._canvas = canvas;
    this._context.configure({
      device: this._device,
      format: this._canvasFormat,
      alphaMode: 'premultiplied'
    });
    this._colorAttachment = {
      view: this._context.getCurrentTexture().createView(),
      clearValue: { r: 0, g: 0, b: 0, a: 0 },
      loadOp: 'clear',
      storeOp: 'store'
    };
    this._renderPassDescriptor = {
      label: 'xterm render pass',
      colorAttachments: [this._colorAttachment]
    };

    this._register(this._themeService.onChangeColors(() => this._handleColorChange()));

    this._cellColorResolver = new CellColorResolver(this._terminal, this._optionsService, this._model.selection, this._decorationService, this._coreBrowserService, this._themeService);

    this._core = (this._terminal as any)._core;

    this._renderLayers = [
      new LinkRenderLayer(this._core.screenElement!, 2, this._terminal, this._core.linkifier!, this._coreBrowserService, _optionsService, this._themeService)
    ];
    this.dimensions = createRenderDimensions();
    this._devicePixelRatio = this._coreBrowserService.dpr;
    this._updateDimensions();
    this._updateCursorBlink();
    this._register(_optionsService.onOptionChange(() => this._handleOptionsChanged()));
    this._textBlinkStateManager = this._register(new TextBlinkStateManager(
      () => this._requestRedrawViewport(),
      this._coreBrowserService,
      this._optionsService
    ));
    this._resetBlinkingRowState();

    this._deviceMaxTextureSize = this._device.limits.maxTextureDimension2D;

    const uncapturedErrorListener = (event: GPUUncapturedErrorEvent): void => {
      const error = new Error(event.error.message);
      this._logService.error(`WebGPU uncaptured error: ${error.message}`);
      this._onRendererError.fire(error);
    };
    this._device.addEventListener('uncapturederror', uncapturedErrorListener);
    this._register(toDisposable(() => this._device.removeEventListener('uncapturederror', uncapturedErrorListener)));
    void this._device.lost.then(info => {
      if (this._isDisposed || info.reason === 'destroyed') {
        return;
      }
      this._logService.warn(`WebGPU device lost: ${info.message}`);
      this._deviceLoss = {
        reason: 'unknown',
        message: info.message
      };
      this._onDeviceLoss.fire(this._deviceLoss);
    });

    this._observerDisposable.value = observeDevicePixelDimensions(this._canvas, this._coreBrowserService.window, (w, h) => this._setCanvasDevicePixelDimensions(w, h));
    this._register(this._coreBrowserService.onWindowChange(w => {
      this._observerDisposable.value = observeDevicePixelDimensions(this._canvas, w, (w, h) => this._setCanvasDevicePixelDimensions(w, h));
    }));

    this._register(addDisposableListener(this._coreBrowserService.mainDocument, 'mousedown', () => this._cursorBlinkStateManager.value?.restartBlinkAnimation()));

    [this._rectangleRenderer.value, this._glyphRenderer.value] = this._initializeWebGPUState();

    this._isAttached = false;

    this._register(toDisposable(() => {
      this._isDisposed = true;
      for (const l of this._renderLayers) {
        l.dispose();
      }
      this._context.unconfigure();
      this._device.destroy();
      this._canvas.parentElement?.removeChild(this._canvas);
      removeTerminalFromCache(this._terminal);
    }));
  }

  public get textureAtlas(): HTMLCanvasElement | undefined {
    return this._charAtlas?.pages[0].canvas;
  }

  public get deviceLoss(): IWebgpuDeviceLostEvent | undefined {
    return this._deviceLoss;
  }

  /** Internal diagnostics consumed by the local renderer benchmark. */
  public get diagnostics(): Readonly<IWebgpuRenderDiagnostics> | undefined {
    const diagnostics = this._glyphRenderer.value?.diagnostics;
    if (!diagnostics) {
      return undefined;
    }
    return {
      ...diagnostics,
      cursorUploadBytes: this._rectangleRenderer.value?.cursorUploadBytes ?? 0
    };
  }

  /** Internal synchronization point consumed by latency diagnostics, not the public addon API. */
  public async whenIdle(): Promise<void> {
    await this._device.queue.onSubmittedWorkDone();
  }

  /** Attach only when initialization has fully succeeded and the renderer is ready to install. */
  public attach(): void {
    if (this._canvas.parentElement || this._isDisposed) {
      return;
    }
    this._core.screenElement!.appendChild(this._canvas);
    this._isAttached = this._core.screenElement!.isConnected;
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
    this._resetBlinkingRowState();

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

    // Render synchronously to avoid flicker when the canvas is cleared
    this._onRequestRedraw.fire({ start: 0, end: this._terminal.rows - 1, sync: true });
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

  public handleViewportVisibilityChange(isVisible: boolean): void {
    this._textBlinkStateManager.setViewportVisible(isVisible);
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
   * Initializes members dependent on WebGPU context state.
   */
  private _initializeWebGPUState(): [RectangleRenderer, GlyphRenderer] {
    this._rectangleRenderer.value = new RectangleRenderer(this._terminal, this._device, this._canvasFormat, this.dimensions, this._themeService, this._logService);
    this._glyphRenderer.value = new GlyphRenderer(this._terminal, this._device, this._canvasFormat, this.dimensions, this._optionsService, this._themeService, this._logService);

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
      this._coreBrowserService.dpr,
      this._deviceMaxTextureSize,
      this._customGlyphs
    );
    if (this._charAtlas !== atlas) {
      this._onChangeTextureAtlas.fire(atlas.pages[0].canvas);
      this._charAtlasDisposable.value = combinedDisposable(
        EventUtils.forward(atlas.onAddTextureAtlasCanvas, this._onAddTextureAtlasCanvas),
        EventUtils.forward(atlas.onRemoveTextureAtlasCanvas, this._onRemoveTextureAtlasCanvas)
      );
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

    this._resetBlinkingRowState();
    this._textBlinkStateManager.setNeedsBlinkInViewport(false);

    this._cursorBlinkStateManager.value?.restartBlinkAnimation();
    this._updateCursorBlink();
  }

  public renderRows(start: number, end: number): void {
    if (!this._isAttached) {
      if (this._core.screenElement?.isConnected && this._charSizeService.width && this._charSizeService.height) {
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

    // A mid-update atlas page merge invalidates vertex data and may not bump the host
    // page's version, so re-run the update and force a full texture rebind.
    let merged = false;
    let mergeRetries = 0;
    while (this._charAtlas && this._glyphRenderer.value.beginFrame() && mergeRetries++ < Constants.MERGE_RETRY_LIMIT) {
      merged = true;
      this._clearModel(true);
      this._updateModel(0, this._terminal.rows - 1);
    }
    if (merged) {
      this._glyphRenderer.value.invalidateAtlasTextures();
    }

    // Encode all layers in a single render pass to preserve ordering.
    try {
      const encoder = this._device.createCommandEncoder({ label: 'xterm frame encoder' });
      this._glyphRenderer.value.prepareFrame();
      this._colorAttachment.view = this._context.getCurrentTexture().createView();
      const pass = encoder.beginRenderPass(this._renderPassDescriptor);
      this._glyphRenderer.value.render(pass);
      if (!this._cursorBlinkStateManager.value || this._cursorBlinkStateManager.value.isCursorVisible) {
        this._rectangleRenderer.value.renderCursor(pass);
      }
      pass.end();
      this._commandBuffers[0] = encoder.finish();
      this._device.queue.submit(this._commandBuffers);
      this._glyphRenderer.value.commitFrame();
      this._glyphRenderer.value.markSubmission();
    } catch (error) {
      const rendererError = toError(error);
      this._logService.error(`WebGPU render failed: ${rendererError.message}`);
      this._onRendererError.fire(rendererError);
    }
  }

  private _updateCursorBlink(): void {
    if (this._coreService.decPrivateModes.cursorBlink ?? this._terminal.options.cursorBlink) {
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
    let skipJoinedCheckUntilX: number;
    let isValidJoinRange: boolean;
    let lastCharX: number;
    let range: [number, number];
    let isCursorRow: boolean;
    let chars: string;
    let code: number;
    let width: number;
    let i: number;
    let cellIndex: number;
    let x: number;
    let j: number;
    start = clamp(start, terminal.rows - 1, 0);
    end = clamp(end, terminal.rows - 1, 0);
    const cursorStyle = this._coreService.decPrivateModes.cursorStyle ?? terminal.options.cursorStyle ?? 'block';

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
    for (y = start; y <= end; y++) {
      row = y + terminal.buffer.ydisp;
      const bufferLine = terminal.buffer.lines.get(row);
      if (!bufferLine) {
        this._model.lineLengths[y] = 0;
        for (x = 0; x < terminal.cols; x++) {
          j = ((y * terminal.cols) + x) * RenderModelConstants.INDICIES_PER_CELL;
          this._nullModelCell(x, y, j, 0, 0, 0);
        }
        this._setRowBlinkState(y, false);
        continue;
      }
      line = bufferLine;
      let rowHasBlinkingCells = false;
      this._model.lineLengths[y] = 0;
      isCursorRow = cursorY === row;
      skipJoinedCheckUntilX = 0;
      joinedRanges = this._characterJoinerService.getJoinedCharacters(row);
      for (x = 0; x < terminal.cols; x++) {
        lastBg = this._cellColorResolver.result.bg;
        line.loadCell(x, cell);

        if (x === 0) {
          lastBg = this._cellColorResolver.result.bg;
        }

        // If true, indicates that the current character(s) to draw were joined.
        isJoined = false;

        // Indicates whether this cell is part of a joined range that should be ignored as it cannot
        // be rendered entirely, like the selection state differs across the range.
        isValidJoinRange = (x >= skipJoinedCheckUntilX);

        lastCharX = x;

        // Process any joined character ranges as needed. Because of how the
        // ranges are produced, we know that they are valid for the characters
        // and attributes of our input.
        if (joinedRanges.length > 0 && x === joinedRanges[0][0] && isValidJoinRange) {
          range = joinedRanges.shift()!;

          // If the ligature's selection state is not consistent, don't join it. This helps the
          // selection render correctly regardless whether they should be joined.
          const firstSelectionState = this._model.selection.isCellSelected(this._terminal, range[0], row);
          for (i = range[0] + 1; i < range[1]; i++) {
            isValidJoinRange &&= (firstSelectionState === this._model.selection.isCellSelected(this._terminal, i, row));
          }
          // Similarly, if the cursor is in the ligature, don't join it.
          isValidJoinRange &&= !isCursorRow || cursorX < range[0] || cursorX >= range[1];
          if (!isValidJoinRange) {
            skipJoinedCheckUntilX = range[1];
          } else {
            isJoined = true;

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
        }

        chars = cell.getChars();
        code = cell.getCode();
        cellIndex = y * terminal.cols + x;
        i = cellIndex * RenderModelConstants.INDICIES_PER_CELL;

        if (!rowHasBlinkingCells && cell.isBlink()) {
          rowHasBlinkingCells = true;
        }

        // Load colors/resolve overrides into work colors
        this._cellColorResolver.resolve(cell, x, row, this.dimensions.device.cell.width, this.dimensions.device.cell.height);

        // Override colors for cursor cell
        if (isCursorVisible && row === cursorY) {
          if (x === cursorX) {
            this._model.cursor = {
              x: cursorX,
              y: viewportRelativeCursorY,
              width: cell.getWidth(),
              style: this._coreBrowserService.isFocused ? cursorStyle : terminal.options.cursorInactiveStyle,
              cursorWidth: terminal.options.cursorWidth,
              dpr: this._devicePixelRatio
            };
            lastCursorX = cursorX + cell.getWidth() - 1;
          }
          if (x >= cursorX && x <= lastCursorX &&
              ((this._coreBrowserService.isFocused &&
              cursorStyle === 'block') ||
              (this._coreBrowserService.isFocused === false &&
              terminal.options.cursorInactiveStyle === 'block'))
          ) {
            this._cellColorResolver.result.fg =
              Attributes.CM_RGB | (this._themeService.colors.cursorAccent.rgba >> 8 & Attributes.RGB_MASK);
            this._cellColorResolver.result.bg =
              Attributes.CM_RGB | (this._themeService.colors.cursor.rgba >> 8 & Attributes.RGB_MASK);
          }
        }

        if (this._textBlinkStateManager.isEnabled && !this._textBlinkStateManager.isBlinkOn && cell.isBlink()) {
          this._cellColorResolver.result.fg |= FgFlags.INVISIBLE;
        }

        if (code !== NULL_CELL_CODE) {
          this._model.lineLengths[y] = x + 1;
        }

        // Flag combined chars with a bit mask so they're easily identifiable.
        // Their contents and width are cached separately because all joined
        // cells use the same synthetic codepoint.
        if (chars.length > 1) {
          code = (code | COMBINED_CHAR_BIT_MASK) >>> 0;
        }
        width = cell.getWidth();

        // Nothing has changed, no updates needed
        if (this._model.cells[i] === code &&
            this._model.cells[i + RenderModelConstants.BG_OFFSET] === this._cellColorResolver.result.bg &&
            this._model.cells[i + RenderModelConstants.FG_OFFSET] === this._cellColorResolver.result.fg &&
            this._model.cells[i + RenderModelConstants.EXT_OFFSET] === this._cellColorResolver.result.ext &&
            this._model.combinedChars[cellIndex] === (chars.length > 1 ? chars : undefined) &&
            this._model.widths[cellIndex] === width) {
          if (isJoined) {
            cell = this._workCell;
            x = lastCharX;
          }
          continue;
        }

        // Cache the results in the model
        this._model.cells[i] = code;
        this._model.cells[i + RenderModelConstants.BG_OFFSET] = this._cellColorResolver.result.bg;
        this._model.cells[i + RenderModelConstants.FG_OFFSET] = this._cellColorResolver.result.fg;
        this._model.cells[i + RenderModelConstants.EXT_OFFSET] = this._cellColorResolver.result.ext;
        this._model.combinedChars[cellIndex] = chars.length > 1 ? chars : undefined;
        this._model.widths[cellIndex] = width;

        this._glyphRenderer.value!.updateCell(
          x,
          y,
          code,
          this._cellColorResolver.result.bg,
          this._cellColorResolver.result.fg,
          this._cellColorResolver.result.ext,
          chars,
          width,
          lastBg
        );

        if (isJoined) {
          // Restore work cell
          cell = this._workCell;

          // Null out non-first cells
          for (x++; x <= lastCharX; x++) {
            j = ((y * terminal.cols) + x) * RenderModelConstants.INDICIES_PER_CELL;
            // Don't re-resolve the cell color since multi-colored ligature backgrounds are not
            // supported
            this._nullModelCell(x, y, j, this._cellColorResolver.result.bg, this._cellColorResolver.result.fg, this._cellColorResolver.result.ext);
          }
          x--; // Go back to the previous update cell for next iteration
        }
      }
      this._setRowBlinkState(y, rowHasBlinkingCells);
    }
    this._rectangleRenderer.value!.updateCursor(this._model);
    this._updateTextBlinkState();
  }

  private _nullModelCell(x: number, y: number, cellIndex: number, bg: number, fg: number, ext: number): void {
    if (this._model.cells[cellIndex] === NULL_CELL_CODE &&
        this._model.cells[cellIndex + RenderModelConstants.BG_OFFSET] === bg &&
        this._model.cells[cellIndex + RenderModelConstants.FG_OFFSET] === fg &&
        this._model.cells[cellIndex + RenderModelConstants.EXT_OFFSET] === ext) {
      return;
    }
    this._glyphRenderer.value!.updateCell(x, y, NULL_CELL_CODE, bg, fg, ext, NULL_CELL_CHAR, 0, 0);
    this._model.cells[cellIndex] = NULL_CELL_CODE;
    this._model.cells[cellIndex + RenderModelConstants.BG_OFFSET] = bg;
    this._model.cells[cellIndex + RenderModelConstants.FG_OFFSET] = fg;
    this._model.cells[cellIndex + RenderModelConstants.EXT_OFFSET] = ext;
    const modelCellIndex = cellIndex / RenderModelConstants.INDICIES_PER_CELL;
    this._model.combinedChars[modelCellIndex] = undefined;
    this._model.widths[modelCellIndex] = 0;
  }

  private _resetBlinkingRowState(): void {
    this._rowHasBlinkingCells = new Array(this._terminal.rows).fill(false);
    this._rowHasBlinkingCellsCount = 0;
  }

  private _setRowBlinkState(row: number, hasBlinkingCells: boolean): void {
    const previous = this._rowHasBlinkingCells[row];
    if (previous === hasBlinkingCells) {
      return;
    }
    this._rowHasBlinkingCells[row] = hasBlinkingCells;
    this._rowHasBlinkingCellsCount += hasBlinkingCells ? 1 : -1;
  }

  private _updateTextBlinkState(): void {
    this._textBlinkStateManager.setNeedsBlinkInViewport(this._rowHasBlinkingCellsCount > 0);
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

    // The size of the canvas on the page. It's important that this rounds to nearest integer
    // and not ceils as browsers often have floating point precision issues where
    // `window.devicePixelRatio` ends up being something like `1.100000023841858` for example, when
    // it's actually 1.1. Ceiling may cause blurriness as the backing canvas image is 1 pixel too
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
    // Render synchronously to avoid flicker when the canvas is cleared
    this._onRequestRedraw.fire({ start: 0, end: this._terminal.rows - 1, sync: true });
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
