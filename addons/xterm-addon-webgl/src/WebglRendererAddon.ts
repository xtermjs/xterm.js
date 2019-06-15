/**
 * Copyright (c) 2017 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import { Terminal, ITerminalAddon } from 'xterm';
import { WebglRenderer } from './WebglRenderer';
import { IRenderService } from 'browser/services/Services';
import { IColorSet } from 'browser/Types';

export class WebglRendererAddon implements ITerminalAddon {
  constructor(
    private _preserveDrawingBuffer?: boolean
  ) {}

  public activate(terminal: Terminal): void {
    if (!terminal.element) {
      throw new Error('Cannot activate WebglRendererAddon before Terminal.open');
    }
    const renderService: IRenderService =  (<any>terminal)._core._renderService;
    const colors: IColorSet = (<any>terminal)._core._colorManager.colors;
    renderService.setRenderer(new WebglRenderer(terminal, colors, this._preserveDrawingBuffer));
  }

  public dispose(): void {
    throw new Error('WebglRendererAddon.dispose Not yet implemented');
  }
}
