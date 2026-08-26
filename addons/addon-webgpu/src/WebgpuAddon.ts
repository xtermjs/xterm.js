/**
 * Copyright (c) 2026 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import type { ITerminalAddon, Terminal } from '@xterm/xterm';
import type { IWebgpuAddonOptions, WebgpuAddon as IWebgpuApi } from '@xterm/addon-webgpu';
import { ICharacterJoinerService, ICharSizeService, ICoreBrowserService, IRenderService, IThemeService } from 'browser/services/Services';
import { ITerminal } from 'browser/Types';
import { Emitter, EventUtils } from 'common/Event';
import { Disposable, toDisposable } from 'common/Lifecycle';
import { ICoreService, IDecorationService, ILogService, IOptionsService } from 'common/services/Services';
import type { IWebgpuDeviceLostEvent } from './Types';
import { WebgpuRenderer } from './WebgpuRenderer';
import { toError } from './WebgpuUtils';

export class WebgpuAddon extends Disposable implements ITerminalAddon, IWebgpuApi {
  private _terminal?: Terminal;
  private _renderer?: WebgpuRenderer;
  private _renderService?: IRenderService;
  private _activationGeneration = 0;
  private _activationStarted = false;
  private _rendererInstalled = false;
  private _readySettled = false;
  private _isDisposed = false;

  private readonly _onChangeTextureAtlas = this._register(new Emitter<HTMLCanvasElement>());
  public readonly onChangeTextureAtlas = this._onChangeTextureAtlas.event;
  private readonly _onAddTextureAtlasCanvas = this._register(new Emitter<HTMLCanvasElement>());
  public readonly onAddTextureAtlasCanvas = this._onAddTextureAtlasCanvas.event;
  private readonly _onRemoveTextureAtlasCanvas = this._register(new Emitter<HTMLCanvasElement>());
  public readonly onRemoveTextureAtlasCanvas = this._onRemoveTextureAtlasCanvas.event;
  private readonly _onRendererError = this._register(new Emitter<Error>());
  public readonly onRendererError = this._onRendererError.event;
  private readonly _onDeviceLoss = this._register(new Emitter<IWebgpuDeviceLostEvent>());
  public readonly onDeviceLoss = this._onDeviceLoss.event;

  private readonly _customGlyphs: boolean;
  private readonly _readyResolve: () => void;
  private readonly _readyReject: (error: Error) => void;
  public readonly ready: Promise<void>;

  constructor(options?: IWebgpuAddonOptions) {
    super();
    this._customGlyphs = options?.customGlyphs ?? true;
    let resolveReady!: () => void;
    let rejectReady!: (error: Error) => void;
    this.ready = new Promise<void>((resolve, reject) => {
      resolveReady = resolve;
      rejectReady = reject;
    });
    this._readyResolve = resolveReady;
    this._readyReject = rejectReady;
    // Loading an addon must not cause an unhandled rejection when an embedder
    // chooses to use events instead of awaiting ready.
    void this.ready.catch(() => undefined);
    this._register(toDisposable(() => {
      this._isDisposed = true;
      this._activationGeneration++;
      this._restoreDefaultRenderer();
      if (!this._readySettled) {
        this._readySettled = true;
        this._readyReject(new Error('WebgpuAddon was disposed before initialization completed'));
      }
    }));
  }

  public activate(terminal: Terminal): void {
    if (this._activationStarted || this._isDisposed) {
      return;
    }
    this._terminal = terminal;
    const core = (terminal as any)._core as ITerminal;
    if (!terminal.element) {
      this._register(core.onWillOpen(() => this.activate(terminal)));
      return;
    }
    this._activationStarted = true;
    const generation = ++this._activationGeneration;
    void this._initializeRenderer(terminal, core, generation);
  }

  private async _initializeRenderer(terminal: Terminal, core: ITerminal, generation: number): Promise<void> {
    try {
      const unsafeCore = core as any;
      this._renderService = unsafeCore._renderService;
      const renderer = await WebgpuRenderer.create(
        terminal,
        unsafeCore._characterJoinerService as ICharacterJoinerService,
        unsafeCore._charSizeService as ICharSizeService,
        unsafeCore._coreBrowserService as ICoreBrowserService,
        core.coreService as ICoreService,
        unsafeCore._decorationService as IDecorationService,
        unsafeCore._logService as ILogService,
        core.optionsService as IOptionsService,
        unsafeCore._themeService as IThemeService,
        this._customGlyphs
      );
      if (this._isDisposed || generation !== this._activationGeneration) {
        renderer.dispose();
        return;
      }
      if (renderer.deviceLoss) {
        const message = renderer.deviceLoss.message;
        renderer.dispose();
        throw new Error(`WebGPU device was lost during initialization${message ? `: ${message}` : ''}`);
      }
      this._renderer = this._register(renderer);
      this._register(EventUtils.forward(renderer.onChangeTextureAtlas, this._onChangeTextureAtlas));
      this._register(EventUtils.forward(renderer.onAddTextureAtlasCanvas, this._onAddTextureAtlasCanvas));
      this._register(EventUtils.forward(renderer.onRemoveTextureAtlasCanvas, this._onRemoveTextureAtlasCanvas));
      this._register(EventUtils.forward(renderer.onRendererError, this._onRendererError));
      let deviceLossHandled = false;
      this._register(renderer.onDeviceLoss(event => {
        if (this._isDisposed || deviceLossHandled) {
          return;
        }
        deviceLossHandled = true;
        this._restoreDefaultRenderer();
        this._onDeviceLoss.fire(event);
      }));
      renderer.attach();
      this._renderService!.setRenderer(renderer);
      this._rendererInstalled = true;
      this._readySettled = true;
      this._readyResolve();
    } catch (error) {
      if (this._isDisposed || generation !== this._activationGeneration) {
        return;
      }
      const rendererError = toError(error);
      this._onRendererError.fire(rendererError);
      if (!this._readySettled) {
        this._readySettled = true;
        this._readyReject(rendererError);
      }
    }
  }

  private _restoreDefaultRenderer(): void {
    if (!this._rendererInstalled || !this._terminal || !this._renderService) {
      return;
    }
    this._rendererInstalled = false;
    const core = (this._terminal as any)._core;
    if (core._store._isDisposed) {
      return;
    }
    this._renderService.setRenderer(core._createRenderer());
    this._renderService.handleResize(this._terminal.cols, this._terminal.rows);
  }

  public get textureAtlas(): HTMLCanvasElement | undefined {
    return this._renderer?.textureAtlas;
  }

  public clearTextureAtlas(): void {
    this._renderer?.clearTextureAtlas();
  }
}
