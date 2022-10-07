/**
 * Copyright (c) 2022 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import { ICharacterJoinerService, ICharSizeService, ICoreBrowserService, IRenderService } from 'browser/services/Services';
import { IColorSet } from 'browser/Types';
import { CanvasRenderer } from './CanvasRenderer';
import { IBufferService, ICoreService, IDecorationService, IOptionsService } from 'common/services/Services';
import { ITerminalAddon, Terminal } from 'xterm';
import { EventEmitter, forwardEvent } from 'common/EventEmitter';

export class CanvasAddon implements ITerminalAddon {
  private _terminal?: Terminal;
  private _renderer?: CanvasRenderer;

  private readonly _onChangeTextureAtlas = new EventEmitter<HTMLCanvasElement>();
  public readonly onChangeTextureAtlas = this._onChangeTextureAtlas.event;

  public activate(terminal: Terminal): void {
    const core = (terminal as any)._core;
    if (!terminal.element) {
      core.onWillOpen(() => this.activate(terminal));
      return;
    }
    this._terminal = terminal;
    const bufferService: IBufferService = core._bufferService;
    const renderService: IRenderService = core._renderService;
    const characterJoinerService: ICharacterJoinerService = core._characterJoinerService;
    const charSizeService: ICharSizeService = core._charSizeService;
    const coreService: ICoreService = core.coreService;
    const coreBrowserService: ICoreBrowserService = core._coreBrowserService;
    const decorationService: IDecorationService = core._decorationService;
    const optionsService: IOptionsService = core.optionsService;
    const colors: IColorSet = core._colorManager.colors;
    const screenElement: HTMLElement = core.screenElement;
    const linkifier = core.linkifier2;
    this._renderer = new CanvasRenderer(terminal, colors, screenElement, linkifier, bufferService, charSizeService, optionsService, characterJoinerService, coreService, coreBrowserService, decorationService);
    forwardEvent(this._renderer.onChangeTextureAtlas, this._onChangeTextureAtlas);
    renderService.setRenderer(this._renderer);
    renderService.onResize(bufferService.cols, bufferService.rows);
  }

  public dispose(): void {
    if (!this._terminal) {
      throw new Error('Cannot dispose CanvasAddon because it is activated');
    }
    const renderService: IRenderService = (this._terminal as any)._core._renderService;
    renderService.setRenderer((this._terminal as any)._core._createRenderer());
    renderService.onResize(this._terminal.cols, this._terminal.rows);
    this._renderer?.dispose();
    this._renderer = undefined;
  }

  public get textureAtlas(): HTMLCanvasElement | undefined {
    return this._renderer?.textureAtlas;
  }
}
