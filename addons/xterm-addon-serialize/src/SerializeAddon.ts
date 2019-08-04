/**
 * Copyright (c) 2019 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import { Terminal, ITerminalAddon } from 'xterm';
// import { IBufferLine } from 'common/Types';

function crop(value: number | undefined, low: number, high: number, initial: number): number {
  if (value === undefined) {
    return initial;
  } else {
    return Math.max(low, Math.min(value, high));
  }
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

    const maxRows = this._terminal.rows;
    rows = crop(rows, 0, maxRows, maxRows);

    const buffer = this._terminal.buffer;
    const lines: string[] = new Array<string>(rows);

    for (let i = maxRows - rows; i < maxRows; i++) {
      const line = buffer.getLine(i);
      lines[i - maxRows + rows] = line ? line.translateToString() : '';
    }

    return lines.join('\r\n');
  }

  public dispose(): void { }
}
