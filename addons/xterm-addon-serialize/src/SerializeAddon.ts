/**
 * Copyright (c) 2019 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import { Terminal, ITerminalAddon, IBuffer, IBufferCell } from 'xterm';

function crop(value: number | undefined, low: number, high: number, initial: number): number {
  if (value === undefined) {
    return initial;
  }
  return Math.max(low, Math.min(value, high));
}

abstract class BaseSerializeHandler {
  constructor(private _buffer: IBuffer) { }

  serialize(startRow: number, endRow: number): string {
    // we need two of them to flip between old and new cell
    const cell1 = this._buffer.getNullCell();
    const cell2 = this._buffer.getNullCell();
    let oldCell = cell1;

    this._serializeStart(endRow - startRow);

    for (let row = startRow; row < endRow; row++) {
      const line = this._buffer.getLine(row);

      this._lineStart(row);

      if (line) {
        for (let col = 0; col < line.length; col++) {
          const newCell = line.getCell(col, oldCell === cell1 ? cell2 : cell1);

          if (!newCell) {
            console.warn(`Can't get cell at row=${row}, col=${col}`);
            continue;
          }
          if (!newCell.equalFg(oldCell) || !newCell.equalBg(oldCell)) {
            this._cellFgBgChanged(newCell, oldCell, row, col);
          }
          if (!newCell.equalFlags(oldCell)) {
            this._cellFlagsChanged(newCell, oldCell, row, col);
          }

          this._nextCell(newCell, oldCell, row, col);

          oldCell = newCell;
        }
      }

      this._lineEnd(row);
    }

    this._serializeEnd();

    return this._serializeFinished();
  }

  protected _nextCell(cell: IBufferCell, oldCell: IBufferCell, row: number, col: number): void { }

  protected _cellFlagsChanged(cell: IBufferCell, oldCell: IBufferCell, row: number, col: number): void { }

  protected _cellFgBgChanged(cell: IBufferCell, oldCell: IBufferCell, row: number, col: number): void { }

  protected _lineStart(row: number): void { }

  protected _lineEnd(row: number): void { }

  protected _serializeStart(rows: number): void { }

  protected _serializeEnd(): void { }

  protected _serializeFinished(): string { return ''; }
}

class StringSerializeHandler extends BaseSerializeHandler {
  private _rowIndex: number = 0;
  private _allRows: string[] = new Array<string>();
  private _currentRow: string = '';
  private _sgrSeq: number[] = [];

  constructor(buffer: IBuffer) {
    super(buffer);
  }

  protected _serializeStart(rows: number): void {
    this._allRows = new Array<string>(rows);
  }

  protected _lineEnd(row: number): void {
    this._allRows[this._rowIndex++] = this._currentRow;
    this._currentRow = '';
  }

  protected _cellFlagsChanged(cell: IBufferCell, oldCell: IBufferCell, row: number, col: number): void {
    const sgrSeq = this._sgrSeq;

    // skip if it's default color style, we will use \x1b[0m to clear every color style later
    if (cell.isDefaultAttibutes() || cell.equalFlags(oldCell)) { return; }

    if (cell.flags.inverse !== oldCell.flags.inverse) { sgrSeq.push(cell.flags.inverse ? 7 : 27); }
    if (cell.flags.bold !== oldCell.flags.bold) { sgrSeq.push(cell.flags.bold ? 1 : 22); }
    if (cell.flags.underline !== oldCell.flags.underline) { sgrSeq.push(cell.flags.underline ? 4 : 24); }
    if (cell.flags.blink !== oldCell.flags.blink) { sgrSeq.push(cell.flags.blink ? 5 : 25); }
    if (cell.flags.invisible !== oldCell.flags.invisible) { sgrSeq.push(cell.flags.invisible ? 8 : 28); }
    if (cell.flags.italic !== oldCell.flags.italic) { sgrSeq.push(cell.flags.italic ? 3 : 23); }
    if (cell.flags.dim !== oldCell.flags.dim) { sgrSeq.push(cell.flags.dim ? 2 : 22); }
  }

  protected _cellFgBgChanged(cell: IBufferCell, oldCell: IBufferCell, row: number, col: number): void {
    const sgrSeq = this._sgrSeq;

    // skip if it's default color style, we will use \x1b[0m to clear every color style later
    if (cell.isDefaultAttibutes()) { return; }

    if (!cell.equalFg(oldCell)) {
      const color = cell.fg.color;
      switch (cell.fg.colorMode) {
        case 'RGB': sgrSeq.push(38, 2, (color >>> 16) & 0xFF, (color >>> 8) & 0xFF, color & 0xFF); break;
        case 'P256': sgrSeq.push(38, 5, color); break;
        case 'P16': sgrSeq.push(color & 8 ? 90 + (color & 7) : 30 + (color & 7)); break;
        default: sgrSeq.push(39); break;
      }
    }

    if (!cell.equalBg(oldCell)) {
      const color = cell.bg.color;
      switch (cell.bg.colorMode) {
        case 'RGB': sgrSeq.push(48, 2, (color >>> 16) & 0xFF, (color >>> 8) & 0xFF, color & 0xFF); break;
        case 'P256': sgrSeq.push(48, 5, color); break;
        case 'P16': sgrSeq.push(color & 8 ? 100 + (color & 7) : 40 + (color & 7)); break;
        default: sgrSeq.push(49); break;
      }
    }
  }

  protected _nextCell(cell: IBufferCell, oldCell: IBufferCell, row: number, col: number): void {
    const fgChanged = !cell.equalFg(oldCell);
    const bgChanged = !cell.equalBg(oldCell);
    const flagsChanged = !cell.equalFlags(oldCell);

    if (cell.isDefaultAttibutes() && (fgChanged || bgChanged || flagsChanged)) {
      this._currentRow += '\x1b[0m';
    }

    if (this._sgrSeq.length) {
      this._currentRow += `\x1b[${this._sgrSeq.join(';')}m`;
      this._sgrSeq = [];
    }

    this._currentRow += cell.char;
  }

  protected _serializeFinished(): string {
    let rowEnd = this._allRows.length;

    for (; rowEnd > 0; rowEnd--) {
      if (this._allRows[rowEnd - 1]) {
        break;
      }
    }

    return this._allRows.slice(0, rowEnd).join('\r\n');
  }
}

export class SerializeAddon implements ITerminalAddon {
  private _terminal: Terminal | undefined;

  constructor() { }

  public activate(terminal: Terminal): void {
    this._terminal = terminal;
  }

  public serialize(rows?: number): string {
    // TODO: Add re-position cursor support
    // TODO: Add word wrap mode support
    // TODO: Add combinedData support
    if (!this._terminal) {
      throw new Error('Cannot use addon until it has been loaded');
    }

    const maxRows = this._terminal.buffer.length;
    const handler = new StringSerializeHandler(this._terminal.buffer);

    rows = crop(rows, 0, maxRows, maxRows);

    return handler.serialize(maxRows - rows, maxRows);
  }

  public dispose(): void { }
}
