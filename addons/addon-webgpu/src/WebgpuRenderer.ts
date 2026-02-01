/**
 * Copyright (c) 2018 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import { ITerminal } from 'browser/Types';
import { IRenderDimensions, IRenderer, IRequestRedrawEvent } from 'browser/renderer/shared/Types';
import { ICharSizeService, ICharacterJoinerService, ICoreBrowserService, IThemeService } from 'browser/services/Services';
import { ICoreService, IDecorationService, IOptionsService } from 'common/services/Services';
import { Terminal } from '@xterm/xterm';
import { Emitter, EventUtils } from 'common/Event';
import { Disposable, toDisposable } from 'common/Lifecycle';
import type { GPU, GPUCanvasContext, GPUDevice, GPUTextureFormat } from './WebgpuTypes';

export class WebgpuRenderer extends Disposable implements IRenderer {
  private readonly _canvas: HTMLCanvasElement;
  private readonly _context: GPUCanvasContext;
  private _device: GPUDevice | undefined;
  private _format: GPUTextureFormat | undefined;
  private _fallbackRenderer: IRenderer;
  private _core: ITerminal;

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
    _charSizeService: ICharSizeService,
    private readonly _coreBrowserService: ICoreBrowserService,
    _coreService: ICoreService,
    _decorationService: IDecorationService,
    _optionsService: IOptionsService,
    _themeService: IThemeService,
    _customGlyphs: boolean = true,
    _preserveDrawingBuffer?: boolean
  ) {
    super();

    this._core = (terminal as any)._core;
    this._fallbackRenderer = (this._core as any)._createRenderer();
    this._register(this._fallbackRenderer);
    this._register(EventUtils.forward(this._fallbackRenderer.onRequestRedraw, this._onRequestRedraw));

    this.dimensions = this._fallbackRenderer.dimensions;

    this._canvas = this._coreBrowserService.mainDocument.createElement('canvas');
    this._canvas.classList.add('xterm-webgpu');
    this._canvas.style.position = 'absolute';
    this._canvas.style.top = '0';
    this._canvas.style.left = '0';
    this._canvas.style.pointerEvents = 'none';

    const context = this._canvas.getContext('webgpu') as unknown as GPUCanvasContext | null;
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
    this._fallbackRenderer.handleDevicePixelRatioChange();
    this._syncCanvasDimensions();
    this._drawFrame();
  }

  public handleResize(cols: number, rows: number): void {
    this._fallbackRenderer.handleResize(cols, rows);
    this._syncCanvasDimensions();
    this._drawFrame();
  }

  public handleCharSizeChanged(): void {
    this._fallbackRenderer.handleCharSizeChanged();
    this._syncCanvasDimensions();
    this._drawFrame();
  }

  public handleBlur(): void {
    this._fallbackRenderer.handleBlur();
  }

  public handleFocus(): void {
    this._fallbackRenderer.handleFocus();
  }

  public handleSelectionChanged(start: [number, number] | undefined, end: [number, number] | undefined, columnSelectMode: boolean): void {
    this._fallbackRenderer.handleSelectionChanged(start, end, columnSelectMode);
    this._drawFrame();
  }

  public handleCursorMove(): void {
    this._fallbackRenderer.handleCursorMove();
    this._drawFrame();
  }

  public clear(): void {
    this._fallbackRenderer.clear();
    this._drawFrame();
  }

  public renderRows(start: number, end: number): void {
    this._fallbackRenderer.renderRows(start, end);
    this._drawFrame();
  }

  private _syncCanvasDimensions(): void {
    this._canvas.width = this.dimensions.device.canvas.width;
    this._canvas.height = this.dimensions.device.canvas.height;
    this._canvas.style.width = `${this.dimensions.css.canvas.width}px`;
    this._canvas.style.height = `${this.dimensions.css.canvas.height}px`;
    if (this._device && this._format) {
      this._context.configure({
        device: this._device,
        format: this._format,
        alphaMode: 'premultiplied'
      });
    }
  }

  private async _initializeWebgpu(): Promise<void> {
    const gpu = (navigator as Navigator & { gpu?: GPU }).gpu;
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
