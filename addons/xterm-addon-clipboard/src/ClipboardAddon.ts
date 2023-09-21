/**
 * Copyright (c) 2023 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import { ClipboardProvider } from './ClipboardProvider';
import { IClipboardProvider, IDisposable, ITerminalAddon, Terminal } from 'xterm';

export class ClipboardAddon implements ITerminalAddon {
  private _disposable: IDisposable | undefined;
  constructor(private _provider: IClipboardProvider = new ClipboardProvider()) {}

  public activate(terminal: Terminal): void {
    this._disposable = terminal.registerClipboardProvider(this._provider);
  }

  public dispose(): void {
    return this._disposable?.dispose();
  }
}
