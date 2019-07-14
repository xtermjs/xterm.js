/**
 * Copyright (c) 2019 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import { Terminal, ITerminalAddon } from 'xterm';

function crop(value: number, from: number, to: number) {
  return Math.max(from, Math.min(value, to))
}

export class SerializeAddon implements ITerminalAddon {
  private _terminal: Terminal | undefined;

  constructor() { }

  public activate(terminal: Terminal): void {
    this._terminal = terminal;
  }

  public serialize(rows?: number): string {
    // TODO: Add frontground/background color support later
    if (!this._terminal) {
      throw new Error('Cannot use addon until it has been loaded');
    }
    const terminalRows = this._terminal.rows;
    if (rows === undefined) {
      rows = terminalRows;
    }
    rows = crop(rows, 0, terminalRows);

    const buffer = this._terminal.buffer;
    const lines: string[] = new Array<string>(rows);

    for (let i = terminalRows - rows; i < terminalRows; i++) {
      const line = buffer.getLine(i);
      lines[i - terminalRows + rows] = line ? line.translateToString() : '';
    }

    return lines.join('\r\n');
  }

  public dispose(): void { }
}
