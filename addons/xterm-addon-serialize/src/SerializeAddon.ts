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
    // TODO: Add frontground/background color support later
    if (!this._terminal) {
      throw new Error('No terminal found!');
    }
    const buffer = this._terminal.buffer;
    const length = Math.max(0, Math.min((rows === undefined ? buffer.length : rows), buffer.length));
    const lines: string[] = new Array<string>(length);

    for (let i = 0; i < length; i++) {
      const line = buffer.getLine(i);
      lines[i] = line ? line.translateToString() : '';
    }

    return lines.join('\r\n');
  }

  public dispose(): void { }
}
