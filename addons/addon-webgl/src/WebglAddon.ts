/**
 * Copyright (c) 2017 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import type { ITerminalAddon, Terminal } from '@xterm/xterm';
import type { WebglAddon as IWebglApi } from '@xterm/addon-webgl';
import { ICharacterJoinerService, ICharSizeService, ICoreBrowserService, IRenderService, IThemeService } from 'browser/services/Services';
import { ITerminal } from 'browser/Types';
import { Disposable, toDisposable } from 'vs/base/common/lifecycle';
import { getSafariVersion, isSafari } from 'common/Platform';
import { ICoreService, IDecorationService, ILogService, IOptionsService } from 'common/services/Services';
import { IWebGL2RenderingContext } from './Types';
import { WebglRenderer } from './WebglRenderer';
import { setTraceLogger } from 'common/services/LogService';
import { Emitter, Event } from 'vs/base/common/event';

export class WebglAddon extends Disposable implements ITerminalAddon , IWebglApi {
  private _terminal?: Terminal;
  private _renderer?: WebglRenderer;

  private readonly _onChangeTextureAtlas = this._register(new Emitter<HTMLCanvasElement>());
  public readonly onChangeTextureAtlas = this._onChangeTextureAtlas.event;
  private readonly _onAddTextureAtlasCanvas = this._register(new Emitter<HTMLCanvasElement>());
  public readonly onAddTextureAtlasCanvas = this._onAddTextureAtlasCanvas.event;
  private readonly _onRemoveTextureAtlasCanvas = this._register(new Emitter<HTMLCanvasElement>());
  public readonly onRemoveTextureAtlasCanvas = this._onRemoveTextureAtlasCanvas.event;
  private readonly _onContextLoss = this._register(new Emitter<void>());
  public readonly onContextLoss = this._onContextLoss.event;

  constructor(
    private _preserveDrawingBuffer?: boolean
  ) {
    if (isSafari && getSafariVersion() < 16) {
      // Perform an extra check to determine if Webgl2 is manually enabled in developer settings
      const contextAttributes = {
        antialias: false,
        depth: false,
        preserveDrawingBuffer: true
      };
      const gl = document.createElement('canvas').getContext('webgl2', contextAttributes) as IWebGL2RenderingContext;
      if (!gl) {
        throw new Error('Webgl2 is only supported on Safari 16 and above');
      }
    }
    super();
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
    const logService: ILogService = unsafeCore._logService;
    const themeService: IThemeService = unsafeCore._themeService;

    // Set trace logger just in case it hasn't been yet which could happen when the addon is
    // bundled separately to the core module
    setTraceLogger(logService);

    this._renderer = this._register(new WebglRenderer(
      terminal,
      characterJoinerService,
      charSizeService,
      coreBrowserService,
      coreService,
      decorationService,
      optionsService,
      themeService,
      this._preserveDrawingBuffer
    ));
    this._register(Event.forward(this._renderer.onContextLoss, this._onContextLoss));
    this._register(Event.forward(this._renderer.onChangeTextureAtlas, this._onChangeTextureAtlas));
    this._register(Event.forward(this._renderer.onAddTextureAtlasCanvas, this._onAddTextureAtlasCanvas));
    this._register(Event.forward(this._renderer.onRemoveTextureAtlasCanvas, this._onRemoveTextureAtlasCanvas));
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
}
