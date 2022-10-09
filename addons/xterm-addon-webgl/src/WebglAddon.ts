/**
 * Copyright (c) 2017 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import { ICharacterJoinerService, ICoreBrowserService, IRenderService, IThemeService } from 'browser/services/Services';
import { EventEmitter, forwardEvent } from 'common/EventEmitter';
import { Disposable, toDisposable } from 'common/Lifecycle';
import { isSafari } from 'common/Platform';
import { ICoreService, IDecorationService, IOptionsService } from 'common/services/Services';
import { ITerminalAddon, Terminal } from 'xterm';
import { WebglRenderer } from './WebglRenderer';

export class WebglAddon extends Disposable implements ITerminalAddon {
  private _terminal?: Terminal;
  private _renderer?: WebglRenderer;

  private readonly _onChangeTextureAtlas = this.register(new EventEmitter<HTMLElement>());
  public readonly onChangeTextureAtlas = this._onChangeTextureAtlas.event;
  private readonly _onContextLoss = this.register(new EventEmitter<void>());
  public readonly onContextLoss = this._onContextLoss.event;

  constructor(
    private _preserveDrawingBuffer?: boolean
  ) {
    super();
  }

  public activate(terminal: Terminal): void {
    if (isSafari) {
      throw new Error('Webgl is not currently supported on Safari');
    }
    const core = (terminal as any)._core;
    if (!terminal.element) {
      this.register(core.onWillOpen(() => this.activate(terminal)));
      return;
    }
    this._terminal = terminal;
    const renderService: IRenderService = core._renderService;
    const characterJoinerService: ICharacterJoinerService = core._characterJoinerService;
    const coreBrowserService: ICoreBrowserService = core._coreBrowserService;
    const coreService: ICoreService = core.coreService;
    const decorationService: IDecorationService = core._decorationService;
    const themeService: IThemeService = core._themeService;
    const optionsService: IOptionsService = core.optionsService;
    this._renderer = this.register(new WebglRenderer(terminal, themeService, characterJoinerService, coreBrowserService, optionsService, coreService, decorationService, this._preserveDrawingBuffer));
    this.register(forwardEvent(this._renderer.onContextLoss, this._onContextLoss));
    this.register(forwardEvent(this._renderer.onChangeTextureAtlas, this._onChangeTextureAtlas));
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
