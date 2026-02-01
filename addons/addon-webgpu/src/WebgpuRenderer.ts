/**
 * Copyright (c) 2018 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import { ITerminal } from 'browser/Types';
import { IRenderDimensions, IRenderer, IRequestRedrawEvent } from 'browser/renderer/shared/Types';
import { createRenderDimensions } from 'browser/renderer/shared/RendererUtils';
import { ICharSizeService, ICharacterJoinerService, ICoreBrowserService, IThemeService } from 'browser/services/Services';
import { ICoreService, IDecorationService, IOptionsService } from 'common/services/Services';
import { Terminal } from '@xterm/xterm';
import { Emitter, EventUtils } from 'common/Event';
import { addDisposableListener } from 'vs/base/browser/dom';
import { combinedDisposable, Disposable, MutableDisposable, toDisposable } from 'common/Lifecycle';
import { CharData, IBufferLine, ICellData } from 'common/Types';
import { AttributeData } from 'common/buffer/AttributeData';
import { CellData } from 'common/buffer/CellData';
import { Attributes, Content, NULL_CELL_CHAR, NULL_CELL_CODE } from 'common/buffer/Constants';

import { acquireTextureAtlas, removeTerminalFromCache } from '../../addon-webgl/src/CharAtlasCache';
import { CellColorResolver } from '../../addon-webgl/src/CellColorResolver';
import { CursorBlinkStateManager } from '../../addon-webgl/src/CursorBlinkStateManager';
import { observeDevicePixelDimensions } from '../../addon-webgl/src/DevicePixelObserver';
import { RenderModel, COMBINED_CHAR_BIT_MASK, RENDER_MODEL_BG_OFFSET, RENDER_MODEL_EXT_OFFSET, RENDER_MODEL_FG_OFFSET, RENDER_MODEL_INDICIES_PER_CELL } from '../../addon-webgl/src/RenderModel';
import { LinkRenderLayer } from '../../addon-webgl/src/renderLayer/LinkRenderLayer';
import { IRenderLayer } from '../../addon-webgl/src/renderLayer/Types';
import type { ITextureAtlas } from '../../addon-webgl/src/Types';
import { TextureAtlas } from '../../addon-webgl/src/TextureAtlas';

import type { IGPU, IGPUCanvasContext, IGPUDevice, IGPUTextureFormat } from './WebgpuTypes';
import { WebgpuTextureUsage } from './WebgpuUtils';
import { WebgpuGlyphRenderer } from './WebgpuGlyphRenderer';
import { WebgpuRectangleRenderer } from './WebgpuRectangleRenderer';

export class WebgpuRenderer extends Disposable implements IRenderer {
  private _renderLayers: IRenderLayer[];
  private _cursorBlinkStateManager: MutableDisposable<CursorBlinkStateManager> = new MutableDisposable();
  private _charAtlasDisposable = this._register(new MutableDisposable());
  private _charAtlas: ITextureAtlas | undefined;
  private _devicePixelRatio: number;
  private _deviceMaxTextureSize: number = 4096;
  private _observerDisposable = this._register(new MutableDisposable());
  private _maxAtlasPages: number = 0;

  private _model: RenderModel = new RenderModel();
  private _workCell: ICellData = new CellData();
  private _cellColorResolver: CellColorResolver;

  private readonly _terminal: Terminal;
  private readonly _canvas: HTMLCanvasElement;
  private readonly _context: IGPUCanvasContext;
  private _device: IGPUDevice | undefined;
  private _format: IGPUTextureFormat | undefined;
  private _rectangleRenderer: MutableDisposable<WebgpuRectangleRenderer> = this._register(new MutableDisposable());
  private _glyphRenderer: MutableDisposable<WebgpuGlyphRenderer> = this._register(new MutableDisposable());

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
  private readonly _onReady = this._register(new Emitter<void>());
  public readonly onReady = this._onReady.event;
  private readonly _onContextLoss = this._register(new Emitter<void>());
  public readonly onContextLoss = this._onContextLoss.event;

  constructor(
    terminal: Terminal,
    private readonly _characterJoinerService: ICharacterJoinerService,
    private readonly _charSizeService: ICharSizeService,
    private readonly _coreBrowserService: ICoreBrowserService,
    private readonly _coreService: ICoreService,
    private readonly _decorationService: IDecorationService,
    private readonly _optionsService: IOptionsService,
    private readonly _themeService: IThemeService,
    private readonly _customGlyphs: boolean = true,
    private readonly _preserveDrawingBuffer?: boolean
  ) {
    super();

    this._terminal = terminal;
    this._core = (terminal as any)._core;

    this._canvas = this._coreBrowserService.mainDocument.createElement('canvas');
    this._canvas.classList.add('xterm-webgpu');
    this._canvas.style.position = 'absolute';
    this._canvas.style.top = '0';
    this._canvas.style.left = '0';
    this._canvas.style.pointerEvents = 'none';

    const context = this._canvas.getContext('webgpu') as unknown as IGPUCanvasContext | null;
    if (!context) {
      throw new Error('WebGPU not supported');
    }
    this._context = context;

    this._register(this._themeService.onChangeColors(() => this._handleColorChange()));

    this._cellColorResolver = new CellColorResolver(this._terminal, this._optionsService, this._model.selection, this._decorationService, this._coreBrowserService, this._themeService);

    this._renderLayers = [
      new LinkRenderLayer(this._core.screenElement!, 2, this._terminal, this._core.linkifier!, this._coreBrowserService, this._optionsService, this._themeService)
    ];

    this.dimensions = createRenderDimensions();
    this._devicePixelRatio = this._coreBrowserService.dpr;
    this._updateDimensions();
    this._updateCursorBlink();
    this._register(this._optionsService.onOptionChange(() => this._handleOptionsChanged()));

    this._observerDisposable.value = observeDevicePixelDimensions(this._canvas, this._coreBrowserService.window, (w, h) => this._setCanvasDevicePixelDimensions(w, h));
    this._register(this._coreBrowserService.onWindowChange(w => {
      this._observerDisposable.value = observeDevicePixelDimensions(this._canvas, w, (width, height) => this._setCanvasDevicePixelDimensions(width, height));
    }));

    this._register(addDisposableListener(this._coreBrowserService.mainDocument, 'mousedown', () => this._cursorBlinkStateManager.value?.restartBlinkAnimation()));

    this._core.screenElement!.appendChild(this._canvas);
    this._syncCanvasDimensions();

    this._isAttached = this._core.screenElement!.isConnected;

    void this._initializeWebgpu();

    this._register(toDisposable(() => {
      for (const l of this._renderLayers) {
        l.dispose();
      }
      this._canvas.parentElement?.removeChild(this._canvas);
      removeTerminalFromCache(this._terminal);
      this._device?.destroy?.();
    }));
  }

  public get textureAtlas(): HTMLCanvasElement | undefined {
    return this._charAtlas?.pages[0].canvas;
  }

  public clearTextureAtlas(): void {
    this._charAtlas?.clearTexture();
    this._clearModel(true);
    this._requestRedrawViewport();
  }

  public handleDevicePixelRatioChange(): void {
    if (this._devicePixelRatio === this._coreBrowserService.dpr) {
      return;
    }
    this._devicePixelRatio = this._coreBrowserService.dpr;
    this.handleResize(this._terminal.cols, this._terminal.rows);
  }

  public handleResize(_cols: number, _rows: number): void {
    this._updateDimensions();
    this._model.resize(this._terminal.cols, this._terminal.rows);

    for (const l of this._renderLayers) {
      l.resize(this._terminal, this.dimensions);
    }

    this._syncCanvasDimensions();

    this._rectangleRenderer.value?.setDimensions(this.dimensions);
    this._rectangleRenderer.value?.handleResize();
    this._glyphRenderer.value?.setDimensions(this.dimensions);
    this._glyphRenderer.value?.handleResize();

    this._refreshCharAtlas();

    this._clearModel(false);

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
    this._requestRedrawViewport();
  }

  public handleFocus(): void {
    for (const l of this._renderLayers) {
      l.handleFocus(this._terminal);
    }
    this._cursorBlinkStateManager.value?.resume();
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

  public clear(): void {
    this._clearModel(true);
    for (const l of this._renderLayers) {
      l.reset(this._terminal);
    }

    this._cursorBlinkStateManager.value?.restartBlinkAnimation();
    this._updateCursorBlink();
  }

  public renderRows(start: number, end: number): void {
    if (!this._glyphRenderer.value || !this._rectangleRenderer.value) {
      return;
    }

    if (!this._isAttached) {
      if (this._core.screenElement?.isConnected && this._charSizeService.width && this._charSizeService.height) {
        this._updateDimensions();
        this._refreshCharAtlas();
        this._isAttached = true;
      } else {
        return;
      }
    }

    for (const l of this._renderLayers) {
      l.handleGridChanged(this._terminal, start, end);
    }

    if (this._glyphRenderer.value.beginFrame()) {
      this._clearModel(true);
      this._updateModel(0, this._terminal.rows - 1);
    } else {
      this._updateModel(start, end);
    }

    this._renderFrame();
  }

  private _handleOptionsChanged(): void {
    this._updateDimensions();
    this._refreshCharAtlas();
    this._updateCursorBlink();
  }

  private _handleColorChange(): void {
    this._refreshCharAtlas();
    this._clearModel(true);
  }

  private _initializeWebgpuState(): void {
    if (!this._device || !this._format) {
      return;
    }

    const maxSampled = this._device.limits?.maxSampledTexturesPerShaderStage ?? 8;
    const maxPages = Math.max(1, Math.min(32, maxSampled));
    TextureAtlas.maxAtlasPages = TextureAtlas.maxAtlasPages === undefined
      ? maxPages
      : Math.min(TextureAtlas.maxAtlasPages, maxPages);
    this._maxAtlasPages = TextureAtlas.maxAtlasPages;

    const maxTextureSize = this._device.limits?.maxTextureDimension2D ?? 4096;
    TextureAtlas.maxTextureSize = TextureAtlas.maxTextureSize === undefined
      ? maxTextureSize
      : Math.min(TextureAtlas.maxTextureSize, maxTextureSize);
    this._deviceMaxTextureSize = TextureAtlas.maxTextureSize;

    this._rectangleRenderer.value = new WebgpuRectangleRenderer(this._terminal, this._device, this._format, this.dimensions, this._themeService);
    this._glyphRenderer.value = new WebgpuGlyphRenderer(this._terminal, this._device, this._format, this.dimensions, this._optionsService, this._maxAtlasPages);
    this._rectangleRenderer.value.handleResize();
    this._glyphRenderer.value.handleResize();

    this._refreshCharAtlas();
    this._requestRedrawViewport();
    this._onReady.fire();
  }

  private async _initializeWebgpu(): Promise<void> {
    const gpu = (navigator as Navigator & { gpu?: IGPU }).gpu;
    const adapter = await gpu?.requestAdapter();
    if (!adapter) {
      this._onContextLoss.fire();
      return;
    }
    this._device = await adapter.requestDevice();
    if (!gpu) {
      this._onContextLoss.fire();
      return;
    }
    this._format = gpu.getPreferredCanvasFormat();
    this._context.configure({
      device: this._device,
      format: this._format,
      alphaMode: 'premultiplied',
      usage: WebgpuTextureUsage.RENDER_ATTACHMENT | WebgpuTextureUsage.COPY_DST
    });

    void this._device.lost.then(() => this._onContextLoss.fire());

    this._initializeWebgpuState();
  }

  private _renderFrame(): void {
    if (!this._device || !this._format || !this._glyphRenderer.value || !this._rectangleRenderer.value) {
      return;
    }

    const loadOp = this._preserveDrawingBuffer ? 'load' : 'clear';

    const commandEncoder = this._device.createCommandEncoder();
    const pass = commandEncoder.beginRenderPass({
      colorAttachments: [
        {
          view: this._context.getCurrentTexture().createView(),
          clearValue: { r: 0, g: 0, b: 0, a: 0 },
          loadOp,
          storeOp: 'store'
        }
      ]
    });

    this._rectangleRenderer.value.renderBackgrounds(pass);
    this._glyphRenderer.value.render(pass, this._model);
    if (!this._cursorBlinkStateManager.value || this._cursorBlinkStateManager.value.isCursorVisible) {
      this._rectangleRenderer.value.renderCursor(pass);
    }

    pass.end();
    this._device.queue.submit([commandEncoder.finish()]);
  }

  private _syncCanvasDimensions(): void {
    this._canvas.width = this.dimensions.device.canvas.width;
    this._canvas.height = this.dimensions.device.canvas.height;
    this._canvas.style.width = `${this.dimensions.css.canvas.width}px`;
    this._canvas.style.height = `${this.dimensions.css.canvas.height}px`;
    this._core.screenElement!.style.width = `${this.dimensions.css.canvas.width}px`;
    this._core.screenElement!.style.height = `${this.dimensions.css.canvas.height}px`;
    if (this._device && this._format) {
      this._context.configure({
        device: this._device,
        format: this._format,
        alphaMode: 'premultiplied',
        usage: WebgpuTextureUsage.RENDER_ATTACHMENT | WebgpuTextureUsage.COPY_DST
      });
    }
  }

  private _updateDimensions(): void {
    if (!this._charSizeService.width || !this._charSizeService.height) {
      return;
    }

    this.dimensions.device.char.width = Math.floor(this._charSizeService.width * this._devicePixelRatio);
    this.dimensions.device.char.height = Math.ceil(this._charSizeService.height * this._devicePixelRatio);
    this.dimensions.device.cell.height = Math.floor(this.dimensions.device.char.height * this._optionsService.rawOptions.lineHeight);
    this.dimensions.device.char.top = this._optionsService.rawOptions.lineHeight === 1 ? 0 : Math.round((this.dimensions.device.cell.height - this.dimensions.device.char.height) / 2);
    this.dimensions.device.cell.width = this.dimensions.device.char.width + Math.round(this._optionsService.rawOptions.letterSpacing);
    this.dimensions.device.char.left = Math.floor(this._optionsService.rawOptions.letterSpacing / 2);

    this.dimensions.device.canvas.height = this._terminal.rows * this.dimensions.device.cell.height;
    this.dimensions.device.canvas.width = this._terminal.cols * this.dimensions.device.cell.width;

    this.dimensions.css.canvas.height = Math.round(this.dimensions.device.canvas.height / this._devicePixelRatio);
    this.dimensions.css.canvas.width = Math.round(this.dimensions.device.canvas.width / this._devicePixelRatio);

    this.dimensions.css.cell.height = this.dimensions.device.cell.height / this._devicePixelRatio;
    this.dimensions.css.cell.width = this.dimensions.device.cell.width / this._devicePixelRatio;
  }

  private _setCanvasDevicePixelDimensions(width: number, height: number): void {
    if (this._canvas.width === width && this._canvas.height === height) {
      return;
    }
    this._canvas.width = width;
    this._canvas.height = height;
    this._onRequestRedraw.fire({ start: 0, end: this._terminal.rows - 1, sync: true });
  }

  private _updateCursorBlink(): void {
    if (this._coreService.decPrivateModes.cursorBlink ?? this._terminal.options.cursorBlink) {
      this._cursorBlinkStateManager.value = new CursorBlinkStateManager(() => {
        this._requestRedrawCursor();
      }, this._coreBrowserService);
    } else {
      this._cursorBlinkStateManager.clear();
    }
    this._requestRedrawCursor();
  }

  private _refreshCharAtlas(): void {
    if (this.dimensions.device.char.width <= 0 && this.dimensions.device.char.height <= 0) {
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

  private _clearModel(clearGlyphRenderer: boolean): void {
    this._model.clear();
    if (clearGlyphRenderer) {
      this._glyphRenderer.value?.clear();
    }
  }

  private _requestRedrawViewport(): void {
    this._onRequestRedraw.fire({ start: 0, end: this._terminal.rows - 1 });
  }

  private _requestRedrawCursor(): void {
    const cursorY = this._terminal.buffer.active.cursorY;
    this._onRequestRedraw.fire({ start: cursorY, end: cursorY });
  }

  private _updateModel(start: number, end: number): void {
    const terminal = this._core;
    let cell: ICellData = this._workCell;

    let lastBg: number;
    let y: number;
    let row: number;
    let line: IBufferLine;
    let joinedRanges: [number, number][];
    let isJoined: boolean;
    let skipJoinedCheckUntilX: number = 0;
    let isValidJoinRange: boolean = true;
    let lastCharX: number;
    let range: [number, number];
    let isCursorRow: boolean;
    let chars: string;
    let code: number;
    let width: number;
    let i: number;
    let x: number;
    let j: number;
    start = clamp(start, terminal.rows - 1, 0);
    end = clamp(end, terminal.rows - 1, 0);
    const cursorStyle = this._coreService.decPrivateModes.cursorStyle ?? terminal.options.cursorStyle ?? 'block';

    const cursorY = this._terminal.buffer.active.baseY + this._terminal.buffer.active.cursorY;
    const viewportRelativeCursorY = cursorY - terminal.buffer.ydisp;
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
      isCursorRow = cursorY === row;
      skipJoinedCheckUntilX = 0;
      joinedRanges = this._characterJoinerService.getJoinedCharacters(row);
      for (x = 0; x < terminal.cols; x++) {
        lastBg = this._cellColorResolver.result.bg;
        line.loadCell(x, cell);

        if (x === 0) {
          lastBg = this._cellColorResolver.result.bg;
        }

        isJoined = false;
        isValidJoinRange = (x >= skipJoinedCheckUntilX);

        lastCharX = x;

        if (joinedRanges.length > 0 && x === joinedRanges[0][0] && isValidJoinRange) {
          range = joinedRanges.shift()!;

          const firstSelectionState = this._model.selection.isCellSelected(this._terminal, range[0], row);
          for (i = range[0] + 1; i < range[1]; i++) {
            isValidJoinRange &&= (firstSelectionState === this._model.selection.isCellSelected(this._terminal, i, row));
          }
          isValidJoinRange &&= !isCursorRow || cursorX < range[0] || cursorX >= range[1];
          if (!isValidJoinRange) {
            skipJoinedCheckUntilX = range[1];
          } else {
            isJoined = true;

            cell = new JoinedCellData(
              cell,
              line!.translateToString(true, range[0], range[1]),
              range[1] - range[0]
            );

            lastCharX = range[1] - 1;
          }
        }

        chars = cell.getChars();
        code = cell.getCode();
        i = ((y * terminal.cols) + x) * RENDER_MODEL_INDICIES_PER_CELL;

        this._cellColorResolver.resolve(cell, x, row, this.dimensions.device.cell.width);

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

        if (code !== NULL_CELL_CODE) {
          this._model.lineLengths[y] = x + 1;
        }

        if (this._model.cells[i] === code &&
            this._model.cells[i + RENDER_MODEL_BG_OFFSET] === this._cellColorResolver.result.bg &&
            this._model.cells[i + RENDER_MODEL_FG_OFFSET] === this._cellColorResolver.result.fg &&
            this._model.cells[i + RENDER_MODEL_EXT_OFFSET] === this._cellColorResolver.result.ext) {
          continue;
        }

        modelUpdated = true;

        if (chars.length > 1) {
          code |= COMBINED_CHAR_BIT_MASK;
        }

        this._model.cells[i] = code;
        this._model.cells[i + RENDER_MODEL_BG_OFFSET] = this._cellColorResolver.result.bg;
        this._model.cells[i + RENDER_MODEL_FG_OFFSET] = this._cellColorResolver.result.fg;
        this._model.cells[i + RENDER_MODEL_EXT_OFFSET] = this._cellColorResolver.result.ext;

        width = cell.getWidth();
        this._glyphRenderer.value!.updateCell(x, y, code, this._cellColorResolver.result.bg, this._cellColorResolver.result.fg, this._cellColorResolver.result.ext, chars, width, lastBg);

        if (isJoined) {
          cell = this._workCell;

          for (x++; x <= lastCharX; x++) {
            j = ((y * terminal.cols) + x) * RENDER_MODEL_INDICIES_PER_CELL;
            this._glyphRenderer.value!.updateCell(x, y, NULL_CELL_CODE, 0, 0, 0, NULL_CELL_CHAR, 0, 0);
            this._model.cells[j] = NULL_CELL_CODE;
            this._model.cells[j + RENDER_MODEL_BG_OFFSET] = this._cellColorResolver.result.bg;
            this._model.cells[j + RENDER_MODEL_FG_OFFSET] = this._cellColorResolver.result.fg;
            this._model.cells[j + RENDER_MODEL_EXT_OFFSET] = this._cellColorResolver.result.ext;
          }
          x--;
        }
      }
    }
    if (modelUpdated) {
      this._rectangleRenderer.value!.updateBackgrounds(this._model);
    }
    this._rectangleRenderer.value!.updateCursor(this._model);
  }
}

class JoinedCellData extends AttributeData implements ICellData {
  private _width: number;
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
    return Content.IS_COMBINED_MASK;
  }

  public getWidth(): number {
    return this._width;
  }

  public getChars(): string {
    return this.combinedData;
  }

  public getCode(): number {
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
