/**
 * Copyright (c) 2017 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import type { ITerminalAddon, Terminal } from '@xterm/xterm';
import type { IWebgpuAddonOptions, WebgpuAddon as IWebgpuApi } from '@xterm/addon-webgpu';
import { ICharacterJoinerService, ICharSizeService, ICoreBrowserService, IRenderService, IThemeService } from 'browser/services/Services';
import { ITerminal } from 'browser/Types';
import { Disposable, toDisposable } from 'common/Lifecycle';
import { ICoreService, IDecorationService, IOptionsService } from 'common/services/Services';
import { WebgpuRenderer } from './WebgpuRenderer';
import { Emitter, EventUtils } from 'common/Event';
import type { GPU } from './WebgpuTypes';

export class WebgpuAddon extends Disposable implements ITerminalAddon, IWebgpuApi {
  private _terminal?: Terminal;
  private _renderer?: WebgpuRenderer;

  private readonly _onChangeTextureAtlas = this._register(new Emitter<HTMLCanvasElement>());
  public readonly onChangeTextureAtlas = this._onChangeTextureAtlas.event;
  private readonly _onAddTextureAtlasCanvas = this._register(new Emitter<HTMLCanvasElement>());
  public readonly onAddTextureAtlasCanvas = this._onAddTextureAtlasCanvas.event;
  private readonly _onRemoveTextureAtlasCanvas = this._register(new Emitter<HTMLCanvasElement>());
  public readonly onRemoveTextureAtlasCanvas = this._onRemoveTextureAtlasCanvas.event;
  private readonly _onContextLoss = this._register(new Emitter<void>());
  public readonly onContextLoss = this._onContextLoss.event;

  private readonly _customGlyphs: boolean;
  private readonly _preserveDrawingBuffer?: boolean;

  constructor(options?: IWebgpuAddonOptions) {
    super();
    this._customGlyphs = options?.customGlyphs ?? true;
    this._preserveDrawingBuffer = options?.preserveDrawingBuffer;
  }

  public activate(terminal: Terminal): void {
    const core = (terminal as any)._core as ITerminal;
    if (!terminal.element) {
      this._register(core.onWillOpen(() => this.activate(terminal)));
      return;
    }

    this._terminal = terminal;
    const coreService: ICoreService = core.coreService;
    const optionsService: IOptionsService = core.optionsService;

    const unsafeCore = core as any;
    const renderService: IRenderService = unsafeCore._renderService;
    const characterJoinerService: ICharacterJoinerService = unsafeCore._characterJoinerService;
    const charSizeService: ICharSizeService = unsafeCore._charSizeService;
    const coreBrowserService: ICoreBrowserService = unsafeCore._coreBrowserService;
    const decorationService: IDecorationService = unsafeCore._decorationService;
    const themeService: IThemeService = unsafeCore._themeService;

    if (!WebgpuAddon._isWebgpuSupported()) {
      renderService.setRenderer((this._terminal as any)._core._createRenderer());
      renderService.handleResize(terminal.cols, terminal.rows);
      return;
    }

    try {
      this._renderer = this._register(new WebgpuRenderer(
        terminal,
        characterJoinerService,
        charSizeService,
        coreBrowserService,
        coreService,
        decorationService,
        optionsService,
        themeService,
        this._customGlyphs,
        this._preserveDrawingBuffer
      ));
    } catch {
      renderService.setRenderer((this._terminal as any)._core._createRenderer());
      renderService.handleResize(terminal.cols, terminal.rows);
      return;
    }

    this._register(EventUtils.forward(this._renderer.onContextLoss, this._onContextLoss));
    this._register(EventUtils.forward(this._renderer.onChangeTextureAtlas, this._onChangeTextureAtlas));
    this._register(EventUtils.forward(this._renderer.onAddTextureAtlasCanvas, this._onAddTextureAtlasCanvas));
    this._register(EventUtils.forward(this._renderer.onRemoveTextureAtlasCanvas, this._onRemoveTextureAtlasCanvas));
    renderService.setRenderer(this._renderer);

    this._register(toDisposable(() => {
      if ((this._terminal as any)._core._store._isDisposed) {
        return;
      }
      const renderService: IRenderService = (this._terminal as any)._core._renderService;
      renderService.setRenderer((this._terminal as any)._core._createRenderer());
      renderService.handleResize(terminal.cols, terminal.rows);
    }));
  }

  public get textureAtlas(): HTMLCanvasElement | undefined {
    return this._renderer?.textureAtlas;
  }

  public clearTextureAtlas(): void {
    this._renderer?.clearTextureAtlas();
  }

  private static _isWebgpuSupported(): boolean {
    return typeof navigator !== 'undefined' && !!(navigator as Navigator & { gpu?: GPU }).gpu;
  }
}
