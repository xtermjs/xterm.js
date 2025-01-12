/**
 * Copyright (c) 2017 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import type { ISharedExports, ITerminalAddon, Terminal, IEmitter, IEvent } from '@xterm/xterm';
import type { WebglAddon as IWebglApi } from '@xterm/addon-webgl';
import { ICharacterJoinerService, ICharSizeService, ICoreBrowserService, IRenderService, IThemeService } from 'browser/services/Services';
import { ITerminal } from 'browser/Types';
import { getSafariVersion, isSafari } from 'common/Platform';
import { ICoreService, IDecorationService, ILogService, IOptionsService } from 'common/services/Services';
import { IWebGL2RenderingContext } from './Types';
import { WebglRenderer } from './WebglRenderer';
import { setTraceLogger } from 'common/services/LogService';
import { AddonDisposable } from 'common/shared/AddonDisposable';
import { forwardEvent } from './WebglUtils';

export class WebglAddon extends AddonDisposable implements ITerminalAddon , IWebglApi {
  private _terminal?: Terminal;
  private _renderer?: WebglRenderer;

  private readonly _onChangeTextureAtlas: IEmitter<HTMLCanvasElement>;
  public readonly onChangeTextureAtlas: IEvent<HTMLCanvasElement>;
  private readonly _onAddTextureAtlasCanvas: IEmitter<HTMLCanvasElement>;
  public readonly onAddTextureAtlasCanvas: IEvent<HTMLCanvasElement>;
  private readonly _onRemoveTextureAtlasCanvas: IEmitter<HTMLCanvasElement>;
  public readonly onRemoveTextureAtlasCanvas: IEvent<HTMLCanvasElement>;
  private readonly _onContextLoss: IEmitter<void>;
  public readonly onContextLoss: IEvent<void>;

  constructor(
    private _sharedExports: ISharedExports,
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
    super(_sharedExports);

    this._onChangeTextureAtlas = this._register(new _sharedExports.Emitter<HTMLCanvasElement>());
    this.onChangeTextureAtlas = this._onChangeTextureAtlas.event;
    this._onAddTextureAtlasCanvas = this._register(new _sharedExports.Emitter<HTMLCanvasElement>());
    this.onAddTextureAtlasCanvas = this._onAddTextureAtlasCanvas.event;
    this._onRemoveTextureAtlasCanvas = this._register(new _sharedExports.Emitter<HTMLCanvasElement>());
    this.onRemoveTextureAtlasCanvas = this._onRemoveTextureAtlasCanvas.event;
    this._onContextLoss = this._register(new _sharedExports.Emitter<void>());
    this.onContextLoss = this._onContextLoss.event;
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
      this._sharedExports,
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
    this._register(forwardEvent(this._renderer.onContextLoss, this._onContextLoss));
    this._register(forwardEvent(this._renderer.onChangeTextureAtlas, this._onChangeTextureAtlas));
    this._register(forwardEvent(this._renderer.onAddTextureAtlasCanvas, this._onAddTextureAtlasCanvas));
    this._register(forwardEvent(this._renderer.onRemoveTextureAtlasCanvas, this._onRemoveTextureAtlasCanvas));
    renderService.setRenderer(this._renderer);

    this._register(this._sharedExports.toDisposable(() => {
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
