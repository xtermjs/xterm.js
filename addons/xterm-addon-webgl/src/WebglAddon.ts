/**
 * Copyright (c) 2017 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import { ICharacterJoinerService, ICharSizeService, ICoreBrowserService, IRenderService, IThemeService } from 'browser/services/Services';
import { ITerminal } from 'browser/Types';
import { EventEmitter, forwardEvent } from 'common/EventEmitter';
import { Disposable, toDisposable } from 'common/Lifecycle';
import { getSafariVersion, isSafari } from 'common/Platform';
import { ICoreService, IDecorationService, IOptionsService } from 'common/services/Services';
import { ITerminalAddon, Terminal } from 'xterm';
import { WebglRenderer } from './WebglRenderer';

export class WebglAddon extends Disposable implements ITerminalAddon {
  private _terminal?: Terminal;
  private _renderer?: WebglRenderer;

  private readonly _onChangeTextureAtlas = this.register(new EventEmitter<HTMLCanvasElement>());
  public readonly onChangeTextureAtlas = this._onChangeTextureAtlas.event;
  private readonly _onAddTextureAtlasCanvas = this.register(new EventEmitter<HTMLCanvasElement>());
  public readonly onAddTextureAtlasCanvas = this._onAddTextureAtlasCanvas.event;
  private readonly _onRemoveTextureAtlasCanvas = this.register(new EventEmitter<HTMLCanvasElement>());
  public readonly onRemoveTextureAtlasCanvas = this._onRemoveTextureAtlasCanvas.event;
  private readonly _onContextLoss = this.register(new EventEmitter<void>());
  public readonly onContextLoss = this._onContextLoss.event;

  constructor(
    private _preserveDrawingBuffer?: boolean
  ) {
    if (isSafari && getSafariVersion() < 16) {
      throw new Error('Webgl2 is only supported on Safari 16 and above');
    }
    super();
  }

  public activate(terminal: Terminal): void {
    const core = (terminal as any)._core as ITerminal;
    if (!terminal.element) {
      this.register(core.onWillOpen(() => this.activate(terminal)));
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

    this._renderer = this.register(new WebglRenderer(
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
    this.register(forwardEvent(this._renderer.onContextLoss, this._onContextLoss));
    this.register(forwardEvent(this._renderer.onChangeTextureAtlas, this._onChangeTextureAtlas));
    this.register(forwardEvent(this._renderer.onAddTextureAtlasCanvas, this._onAddTextureAtlasCanvas));
    this.register(forwardEvent(this._renderer.onRemoveTextureAtlasCanvas, this._onRemoveTextureAtlasCanvas));
    renderService.setRenderer(this._renderer);

    this.register(toDisposable(() => {
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
