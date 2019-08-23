/**
 * Copyright (c) 2019 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import { Terminal, ITerminalAddon, IBuffer, IBufferCell, CellColor } from 'xterm';

// TODO: Workaround here, will remove this later
// If I use `import { CellStyle } from 'xterm'` instead, demo page will raise bellow error
//
// ERROR in ./addons/xterm-addon-serialize/out/SerializeAddon.js
// Module not found: Error: Can't resolve 'xterm' in '/Users/javacs3/Lab/Playground/xterm.js/addons/xterm-addon-serialize/out'
//  @ ./addons/xterm-addon-serialize/out/SerializeAddon.js 16:14-30
//  @ ./demo/client.ts
//
// Looks like typescript generate this line `var xterm_1 = require("xterm");` that leads to the error;
//
enum CellStyle {
  default = 0,
  // foreground style
  inverse = 0x4000000 >>> 24,
  bold = 0x8000000 >>> 24,
  underline = 0x10000000 >>> 24,
  blink = 0x20000000 >>> 24,
  invisible = 0x40000000 >>> 24,
  // background style
  italic = 0x4000000 >>> 16,
  dim = 0x8000000 >>> 16
}

function crop(value: number | undefined, low: number, high: number, initial: number): number {
  if (value === undefined) {
    return initial;
  }
  return Math.max(low, Math.min(value, high));
}

class NullBufferCell implements IBufferCell {
  char: string = '';
  width: number = 0;
  foregroundColor: CellColor = CellColor.getDefault();
  backgroundColor: CellColor = CellColor.getDefault();
  style: CellStyle = CellStyle.default;
}

abstract class BaseSerializeHandler {
  constructor(private _buffer: IBuffer) { }

  serialize(startRow: number, endRow: number): string {
    let oldCell: IBufferCell = new NullBufferCell();

    this._serializeStart(endRow - startRow);

    for (let row = startRow; row < endRow; row++) {
      const line = this._buffer.getLine(row);

      this._lineStart(row);

      if (line) {
        for (let col = 0; col < line.length; col++) {
          const cell = line.getCell(col);

          if (!cell) {
            console.warn(`Can't get cell at row=${row}, col=${col}`);
            continue;
          }
          if (!cell.foregroundColor.equals(oldCell.foregroundColor)
            || !cell.backgroundColor.equals(oldCell.backgroundColor)) {
            this._cellColorChanged(cell, oldCell, row, col);
          }
          if (cell.style !== oldCell.style) {
            this._cellStyleChanged(cell, oldCell, row, col);
          }

          this._nextCell(cell, oldCell, row, col);

          oldCell = cell;
        }
      }

      this._lineEnd(row);
    }

    this._serializeEnd();

    return this._serializeFinished();
  }

  protected _nextCell(cell: IBufferCell, oldCell: IBufferCell, row: number, col: number): void { }

  protected _cellStyleChanged(cell: IBufferCell, oldCell: IBufferCell, row: number, col: number): void { }

  protected _cellColorChanged(cell: IBufferCell, oldCell: IBufferCell, row: number, col: number): void { }

  protected _lineStart(row: number): void { }

  protected _lineEnd(row: number): void { }

  protected _serializeStart(rows: number): void { }

  protected _serializeEnd(): void { }

  protected _serializeFinished(): string { return ''; }
}

function fgColor256to16(c: number): number {
  if (0 <= c && c <= 7) {
    return 30 + c;
  } else if (8 <= c && c <= 15) {
    return 82 + c;
  }
  return -1;
}

function bgColor256to16(c: number): number {
  if (0 <= c && c <= 7) {
    return 40 + c;
  } else if (8 <= c && c <= 15) {
    return 92 + c;
  }
  return -1;
}

function isDefaultColorStyle(cell: IBufferCell) {
  return cell.foregroundColor.isDefault() && cell.backgroundColor.isDefault() && (cell.style === CellStyle.default);
}

class StringSerializeHandler extends BaseSerializeHandler {
  private _rowIndex: number = 0;
  private _allRows: string[] = new Array<string>();
  private _currentRow: string = '';
  private _sgrSeq: string[] = [];

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

  protected _cellStyleChanged(cell: IBufferCell, oldCell: IBufferCell, row: number, col: number): void {
    const styleChangedMask = cell.style ^ oldCell.style;
    const style = cell.style;
    const sgrSeq = this._sgrSeq;

    // skip if it's default color style, we will use \x1b[0m to clear every color style later
    if (isDefaultColorStyle(cell)) {
      return;
    }

    if (styleChangedMask & CellStyle.inverse) {
      sgrSeq.push((style & CellStyle.inverse) ? '7' : '27');
    }
    if (styleChangedMask & CellStyle.bold) {
      sgrSeq.push((style & CellStyle.bold) ? '1' : '22');
    }
    if (styleChangedMask & CellStyle.underline) {
      sgrSeq.push((style & CellStyle.underline) ? '4' : '24');
    }
    if (styleChangedMask & CellStyle.blink) {
      sgrSeq.push((style & CellStyle.blink) ? '5' : '25');
    }
    if (styleChangedMask & CellStyle.invisible) {
      sgrSeq.push((style & CellStyle.invisible) ? '8' : '28');
    }
    if (styleChangedMask & CellStyle.italic) {
      sgrSeq.push((style & CellStyle.italic) ? '3' : '23');
    }
    if (styleChangedMask & CellStyle.dim) {
      sgrSeq.push((style & CellStyle.dim) ? '2' : '22');
    }
  }

  protected _cellColorChanged(cell: IBufferCell, oldCell: IBufferCell, row: number, col: number): void {
    const foregroundColorChanged = !cell.foregroundColor.equals(oldCell.foregroundColor);
    const backgroundColorChanged = !cell.backgroundColor.equals(oldCell.backgroundColor);
    const sgrSeq = this._sgrSeq;

    // skip if it's default color style, we will use \x1b[0m to clear every color style later
    if (isDefaultColorStyle(cell)) {
      return;
    }

    if (foregroundColorChanged) {
      const foregroundColor = cell.foregroundColor;
      switch (foregroundColor.type) {
        case 'default': sgrSeq.push('39'); break;
        case 'palette16': sgrSeq.push(fgColor256to16(foregroundColor.paletteId()).toString()); break;
        case 'palette256': sgrSeq.push(`38;5;${foregroundColor.paletteId()}`); break;
        case 'rgb': const [red, green, blue] = foregroundColor.rgbColor(); sgrSeq.push(`38;2;${red};${green};${blue}`); break;
      }
    }

    if (backgroundColorChanged) {
      const backgroundColor = cell.backgroundColor;
      switch (backgroundColor.type) {
        case 'default': sgrSeq.push('49'); break;
        case 'palette16': sgrSeq.push(bgColor256to16(backgroundColor.paletteId()).toString()); break;
        case 'palette256': sgrSeq.push(`48;5;${backgroundColor.paletteId()}`); break;
        case 'rgb': const [red, green, blue] = backgroundColor.rgbColor(); sgrSeq.push(`48;2;${red};${green};${blue}`); break;
      }
    }
  }

  protected _nextCell(cell: IBufferCell, oldCell: IBufferCell, row: number, col: number): void {
    const foregroundColorChanged = !cell.foregroundColor.equals(oldCell.foregroundColor);
    const backgroundColorChanged = !cell.backgroundColor.equals(oldCell.backgroundColor);
    const styleChanged = cell.style !== oldCell.style;

    if ((foregroundColorChanged || backgroundColorChanged || styleChanged) && isDefaultColorStyle(cell)) {
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

    const maxRows = this._terminal.rows;
    const handler = new StringSerializeHandler(this._terminal.buffer);

    rows = crop(rows, 0, maxRows, maxRows);

    return handler.serialize(maxRows - rows, maxRows);
  }

  public dispose(): void { }
}
