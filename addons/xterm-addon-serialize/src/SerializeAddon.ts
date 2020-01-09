/**
 * Copyright (c) 2019 The xterm.js authors. All rights reserved.
 * @license MIT
 *
 * (EXPERIMENTAL) This Addon is still under development
 */

import { Terminal, ITerminalAddon, IBuffer, IBufferCell } from 'xterm';

function constrain(value: number, low: number, high: number): number {
  return Math.max(low, Math.min(value, high));
}

// TODO: Refine this template class later
abstract class BaseSerializeHandler {
  constructor(private _buffer: IBuffer) { }

  serialize(startRow: number, endRow: number): string {
    // we need two of them to flip between old and new cell
    const cell1 = this._buffer.getNullCell();
    const cell2 = this._buffer.getNullCell();
    let oldCell = cell1;

    this._beforeSerialize(endRow - startRow);

    for (let row = startRow; row < endRow; row++) {
      const line = this._buffer.getLine(row);
      if (line) {
        for (let col = 0; col < line.length; col++) {
          const c = line.getCell(col, oldCell === cell1 ? cell2 : cell1);
          if (!c) {
            console.warn(`Can't get cell at row=${row}, col=${col}`);
            continue;
          }
          this._nextCell(c, oldCell, row, col);
          oldCell = c;
        }
      }
      this._rowEnd(row);
    }

    this._afterSerialize();

    return this._serializeString();
  }

  protected _nextCell(cell: IBufferCell, oldCell: IBufferCell, row: number, col: number): void { }
  protected _rowEnd(row: number): void { }
  protected _beforeSerialize(rows: number): void { }
  protected _afterSerialize(): void { }
  protected _serializeString(): string { return ''; }
}

function equalFg(cell1: IBufferCell, cell2: IBufferCell): boolean {
  return cell1.getFgColorMode() === cell2.getFgColorMode()
    && cell1.getFgColor() === cell2.getFgColor();
}

function equalBg(cell1: IBufferCell, cell2: IBufferCell): boolean {
  return cell1.getBgColorMode() === cell2.getBgColorMode()
    && cell1.getBgColor() === cell2.getBgColor();
}

function equalFlags(cell1: IBufferCell, cell2: IBufferCell): boolean {
  return cell1.isInverse() === cell2.isInverse()
    && cell1.isBold() === cell2.isBold()
    && cell1.isUnderline() === cell2.isUnderline()
    && cell1.isBlink() === cell2.isBlink()
    && cell1.isInvisible() === cell2.isInvisible()
    && cell1.isItalic() === cell2.isItalic()
    && cell1.isDim() === cell2.isDim();
}

class StringSerializeHandler extends BaseSerializeHandler {
  private _rowIndex: number = 0;
  private _allRows: string[] = new Array<string>();
  private _currentRow: string = '';
  private _nullCellCount: number = 0;

  constructor(buffer: IBuffer) {
    super(buffer);
  }

  protected _beforeSerialize(rows: number): void {
    this._allRows = new Array<string>(rows);
  }

  protected _rowEnd(row: number): void {
    this._allRows[this._rowIndex++] = this._currentRow;
    this._currentRow = '';
    this._nullCellCount = 0;
  }

  protected _nextCell(cell: IBufferCell, oldCell: IBufferCell, row: number, col: number): void {
    const sgrSeq: number[] = [];
    const fgChanged = !equalFg(cell, oldCell);
    const bgChanged = !equalBg(cell, oldCell);
    const flagsChanged = !equalFlags(cell, oldCell);

    if (fgChanged || bgChanged || flagsChanged) {
      if (cell.isAttributeDefault()) {
        this._currentRow += '\x1b[0m';
      } else {
        if (fgChanged) {
          const color = cell.getFgColor();
          if (cell.isFgRGB()) { sgrSeq.push(38, 2, (color >>> 16) & 0xFF, (color >>> 8) & 0xFF, color & 0xFF); }
          else if (cell.isFgPalette()) {
            if (color >= 16) { sgrSeq.push(38, 5, color); }
            else { sgrSeq.push(color & 8 ? 90 + (color & 7) : 30 + (color & 7)); }
          }
          else { sgrSeq.push(39); }
        }
        if (bgChanged) {
          const color = cell.getBgColor();
          if (cell.isBgRGB()) { sgrSeq.push(48, 2, (color >>> 16) & 0xFF, (color >>> 8) & 0xFF, color & 0xFF); }
          else if (cell.isBgPalette()) {
            if (color >= 16) { sgrSeq.push(48, 5, color); }
            else { sgrSeq.push(color & 8 ? 100 + (color & 7) : 40 + (color & 7)); }
          }
          else { sgrSeq.push(49); }
        }
        if (flagsChanged) {
          if (cell.isInverse() !== oldCell.isInverse()) { sgrSeq.push(cell.isInverse() ? 7 : 27); }
          if (cell.isBold() !== oldCell.isBold()) { sgrSeq.push(cell.isBold() ? 1 : 22); }
          if (cell.isUnderline() !== oldCell.isUnderline()) { sgrSeq.push(cell.isUnderline() ? 4 : 24); }
          if (cell.isBlink() !== oldCell.isBlink()) { sgrSeq.push(cell.isBlink() ? 5 : 25); }
          if (cell.isInvisible() !== oldCell.isInvisible()) { sgrSeq.push(cell.isInvisible() ? 8 : 28); }
          if (cell.isItalic() !== oldCell.isItalic()) { sgrSeq.push(cell.isItalic() ? 3 : 23); }
          if (cell.isDim() !== oldCell.isDim()) { sgrSeq.push(cell.isDim() ? 2 : 22); }
        }
      }
    }

    if (sgrSeq.length) {
      this._currentRow += `\x1b[${sgrSeq.join(';')}m`;
    }

    // Count number of null cells encountered after the last non-null cell and move the cursor
    // if a non-null cell is found (eg. \t or cursor move)
    if (cell.getChars() === '') {
      this._nullCellCount++;
    } else if (this._nullCellCount > 0) {
      this._currentRow += `\x1b[${this._nullCellCount}C`;
      this._nullCellCount = 0;
    }

    this._currentRow += cell.getChars();
  }

  protected _serializeString(): string {
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

    rows = (rows === undefined) ? maxRows : constrain(rows, 0, maxRows);

    return handler.serialize(maxRows - rows, maxRows);
  }

  public dispose(): void { }
}
