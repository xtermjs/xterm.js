/**
 * Copyright (c) 2019 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import { Terminal, ITerminalAddon } from 'xterm';

export class SerializeAddon implements ITerminalAddon {
  private _terminal: Terminal | undefined;

  constructor() { }

  public activate(terminal: Terminal): void {
    this._terminal = terminal;
  }

  public serialize(rows?: number): string {
    if (!this._terminal) {
      return '';
    }
    const buffer = this._terminal.buffer;
    const length = Math.max(0, Math.min((rows === undefined ? buffer.length : rows), buffer.length));
    let data = '';

    for (let i = 0; i < length; i++) {
      const line = buffer.getLine(i);
      const last = i === length - 1;
      if (line) {
        data += line.translateToString();
      }
      if (!last) {
        data += '\r\n';
      }
    }

    return data;
  }

  public dispose(): void {
    if (this._terminal !== undefined) { }
  }
}
