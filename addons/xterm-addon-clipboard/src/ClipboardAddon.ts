/**
 * Copyright (c) 2023 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import { ClipboardProvider } from './ClipboardProvider';
import { IClipboardProvider, ITerminalAddon, Terminal } from 'xterm';

export class ClipboardAddon implements ITerminalAddon {
  private _terminal: Terminal | undefined;
  constructor(private _provider: IClipboardProvider = new ClipboardProvider()) {}

  public activate(terminal: Terminal): void {
    this._terminal = terminal;
    terminal.registerClipboardProvider(this._provider);
  }

  public dispose(): void {
    this._terminal?.deregisterClipboardProvider();
  }
}
