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
import { Emitter } from 'common/Event';
import { Disposable, toDisposable } from 'common/Lifecycle';
import type { IGPU, IGPUCanvasContext, IGPUDevice, IGPUTextureFormat } from './WebgpuTypes';

export class WebgpuRenderer extends Disposable implements IRenderer {
  private readonly _terminal: Terminal;
  private readonly _canvas: HTMLCanvasElement;
  private readonly _context: IGPUCanvasContext;
  private _device: IGPUDevice | undefined;
  private _format: IGPUTextureFormat | undefined;
  private _core: ITerminal;
  private _devicePixelRatio: number;

  public readonly dimensions: IRenderDimensions;

  private readonly _onChangeTextureAtlas = this._register(new Emitter<HTMLCanvasElement>());
  public readonly onChangeTextureAtlas = this._onChangeTextureAtlas.event;
  private readonly _onAddTextureAtlasCanvas = this._register(new Emitter<HTMLCanvasElement>());
  public readonly onAddTextureAtlasCanvas = this._onAddTextureAtlasCanvas.event;
  private readonly _onRemoveTextureAtlasCanvas = this._register(new Emitter<HTMLCanvasElement>());
  public readonly onRemoveTextureAtlasCanvas = this._onRemoveTextureAtlasCanvas.event;
  private readonly _onRequestRedraw = this._register(new Emitter<IRequestRedrawEvent>());
  public readonly onRequestRedraw = this._onRequestRedraw.event;
  private readonly _onContextLoss = this._register(new Emitter<void>());
  public readonly onContextLoss = this._onContextLoss.event;

  constructor(
    terminal: Terminal,
    _characterJoinerService: ICharacterJoinerService,
    private readonly _charSizeService: ICharSizeService,
    private readonly _coreBrowserService: ICoreBrowserService,
    _coreService: ICoreService,
    _decorationService: IDecorationService,
    private readonly _optionsService: IOptionsService,
    _themeService: IThemeService,
    _customGlyphs: boolean = true,
    _preserveDrawingBuffer?: boolean
  ) {
    super();

    this._terminal = terminal;
    this._core = (terminal as any)._core;
    this.dimensions = createRenderDimensions();
    this._devicePixelRatio = this._coreBrowserService.dpr;
    this._updateDimensions();

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

    this._core.screenElement!.appendChild(this._canvas);
    this._syncCanvasDimensions();

    void this._initializeWebgpu();

    this._register(toDisposable(() => {
      this._canvas.parentElement?.removeChild(this._canvas);
      this._device?.destroy?.();
    }));
  }

  public get textureAtlas(): HTMLCanvasElement | undefined {
    return undefined;
  }

  public clearTextureAtlas(): void {
    this._drawFrame();
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
    this._syncCanvasDimensions();
    this._onRequestRedraw.fire({ start: 0, end: this._terminal.rows - 1, sync: true });
  }

  public handleCharSizeChanged(): void {
    this.handleResize(this._terminal.cols, this._terminal.rows);
  }

  public handleBlur(): void {
    this._onRequestRedraw.fire({ start: 0, end: this._terminal.rows - 1 });
  }

  public handleFocus(): void {
    this._onRequestRedraw.fire({ start: 0, end: this._terminal.rows - 1 });
  }

  public handleSelectionChanged(_start: [number, number] | undefined, _end: [number, number] | undefined, _columnSelectMode: boolean): void {
    this._onRequestRedraw.fire({ start: 0, end: this._terminal.rows - 1 });
  }

  public handleCursorMove(): void {
    const cursorY = this._terminal.buffer.active.cursorY;
    this._onRequestRedraw.fire({ start: cursorY, end: cursorY });
  }

  public clear(): void {
    this._drawFrame();
  }

  public renderRows(_start: number, _end: number): void {
    this._drawFrame();
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
        alphaMode: 'premultiplied'
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
      alphaMode: 'premultiplied'
    });

    void this._device.lost.then(() => this._onContextLoss.fire());
    this._drawFrame();
  }

  private _drawFrame(): void {
    if (!this._device) {
      return;
    }
    const commandEncoder = this._device.createCommandEncoder();
    const pass = commandEncoder.beginRenderPass({
      colorAttachments: [
        {
          view: this._context.getCurrentTexture().createView(),
          clearValue: { r: 0, g: 0, b: 0, a: 0 },
          loadOp: 'clear',
          storeOp: 'store'
        }
      ]
    });
    pass.end();
    this._device.queue.submit([commandEncoder.finish()]);
  }
}
