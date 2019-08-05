/**
 * Copyright (c) 2019 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import { Terminal, ITerminalAddon } from 'xterm';
// import { IBufferLine } from 'common/Types';
import { IBuffer } from 'common/buffer/Types';

function crop(value: number | undefined, low: number, high: number, initial: number): number {
  if (value === undefined) {
    return initial;
  }
  return Math.max(low, Math.min(value, high));
}

class SerializeHandler {
  constructor(private _buffer: IBuffer) { }

  serialize(start: number, end: number): string {
    const rows = end - start;
    const lines: string[] = new Array<string>(rows);

    for (let i = start; i < end; i++) {
      const line = this._buffer.lines.get(i);

      lines[i - start] = line ? line.translateToString() : '';
    }

    return lines.join('\r\n');
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
    const handler = new SerializeHandler((<any>this._terminal)._core.buffer);

    rows = crop(rows, 0, maxRows, maxRows);

    return handler.serialize(maxRows - rows, maxRows);
  }

  public dispose(): void { }
}
