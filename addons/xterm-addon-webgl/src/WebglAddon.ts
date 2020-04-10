/**
 * Copyright (c) 2017 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import { Terminal, ITerminalAddon } from 'xterm';
import { WebglRenderer } from './WebglRenderer';
import { IRenderService } from 'browser/services/Services';
import { IColorSet } from 'browser/Types';

export class WebglAddon implements ITerminalAddon {
  private _terminal?: Terminal;
  private _renderer?: WebglRenderer;

  constructor(
    private _preserveDrawingBuffer?: boolean
  ) {}

  public activate(terminal: Terminal): void {
    if (!terminal.element) {
      throw new Error('Cannot activate WebglAddon before Terminal.open');
    }
    this._terminal = terminal;
    const renderService: IRenderService = (<any>terminal)._core._renderService;
    const colors: IColorSet = (<any>terminal)._core._colorManager.colors;
    this._renderer = new WebglRenderer(terminal, colors, this._preserveDrawingBuffer);
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
}
