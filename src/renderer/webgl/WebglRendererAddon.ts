/**
 * Copyright (c) 2017 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import { Terminal, ITerminalAddon } from 'xterm';
import { WebglRenderer } from './WebglRenderer';

export class WebglRendererAddon implements ITerminalAddon {
  private _terminal: Terminal | undefined;

  constructor() {}

  public activate(terminal: Terminal): void {
    if (!terminal.element) {
      throw new Error('Cannot activate WebglRendererAddon before Terminal.open');
    }
    this._terminal = terminal;
    this._terminal.setRenderer(new WebglRenderer(terminal, (terminal as any)._core._colorManager.colors));
  }

  public dispose(): void {
    throw new Error('WebglRendererAddon.dispose Not yet implemented');
  }
}
