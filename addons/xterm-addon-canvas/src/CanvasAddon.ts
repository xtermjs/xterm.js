/**
 * Copyright (c) 2022 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import { ICharacterJoinerService, ICharSizeService, ICoreBrowserService, IRenderService, ISelectionService, IThemeService } from 'browser/services/Services';
import { ITerminal } from 'browser/Types';
import { CanvasRenderer } from './CanvasRenderer';
import { IBufferService, ICoreService, IDecorationService, IOptionsService } from 'common/services/Services';
import { ITerminalAddon, Terminal } from 'xterm';
import { EventEmitter, forwardEvent } from 'common/EventEmitter';
import { Disposable, toDisposable } from 'common/Lifecycle';

export class CanvasAddon extends Disposable implements ITerminalAddon {
  private _terminal?: Terminal;
  private _renderer?: CanvasRenderer;

  private readonly _onChangeTextureAtlas = this.register(new EventEmitter<HTMLCanvasElement>());
  public readonly onChangeTextureAtlas = this._onChangeTextureAtlas.event;
  private readonly _onAddTextureAtlasCanvas = this.register(new EventEmitter<HTMLCanvasElement>());
  public readonly onAddTextureAtlasCanvas = this._onAddTextureAtlasCanvas.event;

  public get textureAtlas(): HTMLCanvasElement | undefined {
    return this._renderer?.textureAtlas;
  }

  public activate(terminal: Terminal): void {
    const core = (terminal as any)._core as ITerminal;
    if (!terminal.element) {
      this.register(core.onWillOpen(() => this.activate(terminal)));
      return;
    }

    this._terminal = terminal;
    const coreService = core.coreService;
    const optionsService = core.optionsService;
    const screenElement = core.screenElement!;
    const linkifier = core.linkifier2;

    const unsafeCore = core as any;
    const bufferService: IBufferService = unsafeCore._bufferService;
    const renderService: IRenderService = unsafeCore._renderService;
    const characterJoinerService: ICharacterJoinerService = unsafeCore._characterJoinerService;
    const charSizeService: ICharSizeService = unsafeCore._charSizeService;
    const coreBrowserService: ICoreBrowserService = unsafeCore._coreBrowserService;
    const decorationService: IDecorationService = unsafeCore._decorationService;
    const themeService: IThemeService = unsafeCore._themeService;

    this._renderer = new CanvasRenderer(terminal, screenElement, linkifier, bufferService, charSizeService, optionsService, characterJoinerService, coreService, coreBrowserService, decorationService, themeService);
    this.register(forwardEvent(this._renderer.onChangeTextureAtlas, this._onChangeTextureAtlas));
    this.register(forwardEvent(this._renderer.onAddTextureAtlasCanvas, this._onAddTextureAtlasCanvas));
    renderService.setRenderer(this._renderer);
    renderService.handleResize(bufferService.cols, bufferService.rows);

    this.register(toDisposable(() => {
      renderService.setRenderer((this._terminal as any)._core._createRenderer());
      renderService.handleResize(terminal.cols, terminal.rows);
      this._renderer?.dispose();
      this._renderer = undefined;
    }));
  }
}
