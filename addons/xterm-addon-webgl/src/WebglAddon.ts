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

  constructor(
    private _preserveDrawingBuffer?: boolean
  ) {}

  public activate(terminal: Terminal): void {
    if (!terminal.element) {
      throw new Error('Cannot activate WebglAddon before Terminal.open');
    }
    this._terminal = terminal;
    const renderService: IRenderService =  (<any>terminal)._core._renderService;
    const colors: IColorSet = (<any>terminal)._core._colorManager.colors;
    renderService.setRenderer(new WebglRenderer(terminal, colors, this._preserveDrawingBuffer));
  }

  public dispose(): void {
    if (!this._terminal) {
      throw new Error('Cannot dispose WebglAddon because it is activated');
    }
    const renderService: IRenderService = (<any>this._terminal)._core._renderService;
    renderService.setRenderer((<any>this._terminal)._core._createRenderer());
    renderService.onResize(this._terminal.cols, this._terminal.rows);
  }
}
