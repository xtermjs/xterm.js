/**
 * Copyright (c) 2017 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import { Terminal, ITerminalAddon, IEvent } from 'xterm';
import { WebglRenderer } from './WebglRenderer';
import { ICharacterJoinerService, IRenderService } from 'browser/services/Services';
import { IColorSet } from 'browser/Types';
import { EventEmitter } from 'common/EventEmitter';
import { isSafari } from 'common/Platform';

export class WebglAddon implements ITerminalAddon {
  private _terminal?: Terminal;
  private _renderer?: WebglRenderer;
  private _onContextLoss = new EventEmitter<void>();
  public get onContextLoss(): IEvent<void> { return this._onContextLoss.event; }

  constructor(
    private _preserveDrawingBuffer?: boolean
  ) {}

  public activate(terminal: Terminal): void {
    if (!terminal.element) {
      throw new Error('Cannot activate WebglAddon before Terminal.open');
    }
    if (isSafari) {
      throw new Error('Webgl is not currently supported on Safari');
    }
    this._terminal = terminal;
    const renderService: IRenderService = (terminal as any)._core._renderService;
    const characterJoinerService: ICharacterJoinerService = (terminal as any)._core._characterJoinerService;
    const colors: IColorSet = (terminal as any)._core._colorManager.colors;
    this._renderer = new WebglRenderer(terminal, colors, characterJoinerService, this._preserveDrawingBuffer);
    this._renderer.onContextLoss(() => this._onContextLoss.fire());
    renderService.setRenderer(this._renderer);
  }

  public dispose(): void {
    if (!this._terminal) {
      throw new Error('Cannot dispose WebglAddon because it is activated');
    }
    const renderService: IRenderService = (this._terminal as any)._core._renderService;
    renderService.setRenderer((this._terminal as any)._core._createRenderer());
    renderService.onResize(this._terminal.cols, this._terminal.rows);
    this._renderer = undefined;
  }

  public get textureAtlas(): HTMLCanvasElement | undefined {
    return this._renderer?.textureAtlas;
  }

  public clearTextureAtlas(): void {
    this._renderer?.clearCharAtlas();
  }
}
