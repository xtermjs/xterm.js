/**
 * Copyright (c) 2019 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import { Terminal, ITerminalAddon } from 'xterm';
import { ICellData } from 'common/Types';
import { CellData } from 'common/buffer/CellData';
import { IBuffer } from 'common/buffer/Types';
import { Attributes, FgFlags, BgFlags } from 'common/buffer/Constants';

function crop(value: number | undefined, low: number, high: number, initial: number): number {
  if (value === undefined) {
    return initial;
  }
  return Math.max(low, Math.min(value, high));
}

class BaseSerializeHandler {
  constructor(private _buffer: IBuffer) { }

  serialize(startRow: number, endRow: number): string {
    let oldCell = new CellData();

    this._serializeStart(endRow - startRow);

    for (let row = startRow; row < endRow; row++) {
      const line = this._buffer.lines.get(row);

      this._lineStart(row);

      if (line) {
        for (let col = 0; col < line.length; col++) {
          const cell = new CellData();

          line.loadCell(col, cell);

          if (oldCell.fg !== cell.fg) {
            this._fgChanged(cell, oldCell, row, col);
          }
          if (oldCell.bg !== cell.bg) {
            this._bgChanged(cell, oldCell, row, col);
          }

          this._cellChanged(cell, oldCell, row, col);

          oldCell = cell;
        }
      }

      this._lineEnd(row);
    }

    this._serializeEnd();

    return this._serializeFinished();
  }

  protected _cellChanged(cell: ICellData, oldCell: ICellData, row: number, col: number): void { }

  protected _fgChanged(cell: ICellData, oldCell: ICellData, row: number, col: number): void { }

  protected _bgChanged(cell: ICellData, oldCell: ICellData, row: number, col: number): void { }

  protected _lineStart(row: number): void { }

  protected _lineEnd(row: number): void { }

  protected _serializeStart(rows: number): void { }

  protected _serializeEnd(): void { }

  protected _serializeFinished(): string { return ''; }
}

const FG_FM_MASK = FgFlags.FM_MASK;
const BG_FM_MASK = BgFlags.FM_MASK;
const COLOR_MASK = Attributes.CM_MASK | Attributes.RGB_MASK;

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

  protected _fgChanged(cell: ICellData, oldCell: ICellData, row: number, col: number): void {
    const fgFlagsChanged = (cell.fg ^ oldCell.fg) & FG_FM_MASK;
    const fgColorChanged = (cell.fg ^ oldCell.fg) & COLOR_MASK;
    const sgrSeq = this._sgrSeq;

    if ((cell.fg === 0) && (cell.bg === 0)) {
      return;
    }

    if (fgFlagsChanged) {
      if (fgFlagsChanged & FgFlags.INVERSE) {
        sgrSeq.push(cell.isInverse() ? '7' : '27');
      }
      if (fgFlagsChanged & FgFlags.BOLD) {
        sgrSeq.push(cell.isBold() ? '1' : '22');
      }
      if (fgFlagsChanged & FgFlags.UNDERLINE) {
        sgrSeq.push(cell.isUnderline() ? '4' : '24');
      }
      if (fgFlagsChanged & FgFlags.BLINK) {
        sgrSeq.push(cell.isBlink() ? '5' : '25');
      }
      if (fgFlagsChanged & FgFlags.INVISIBLE) {
        sgrSeq.push(cell.isInvisible() ? '8' : '28');
      }
    }

    if (fgColorChanged) {
      const fgColor = cell.getFgColor();

      if (cell.isFgDefault()) {
        sgrSeq.push('39');
      } else if (cell.isFgPalette()) {
        switch (cell.getFgColorMode()) {
          case Attributes.CM_P16: sgrSeq.push(`${30 + fgColor}`); break;
          case Attributes.CM_P256: sgrSeq.push(`38;5;${fgColor}`); break;
        }
      } else if (cell.isFgRGB()) {
        const [r, g, b] = CellData.toColorRGB(fgColor);
        sgrSeq.push(`38;2;${r};${g};${b}`);
      }
    }
  }

  protected _bgChanged(cell: ICellData, oldCell: ICellData, row: number, col: number): void {
    const bgFlagsChanged = (cell.bg ^ oldCell.bg) & BG_FM_MASK;
    const bgColorChanged = (cell.bg ^ oldCell.bg) & COLOR_MASK;
    const sgrSeq = this._sgrSeq;

    if ((cell.bg === 0) && (cell.fg === 0)) {
      return;
    }

    if (bgFlagsChanged) {
      if (bgFlagsChanged & BgFlags.ITALIC) {
        sgrSeq.push(cell.isItalic() ? '3' : '23');
      }
      if (bgFlagsChanged & BgFlags.DIM) {
        sgrSeq.push(cell.isDim() ? '2' : '22');
      }
    }

    if (bgColorChanged) {
      const bgColor = cell.getBgColor();

      if (cell.isBgDefault()) {
        sgrSeq.push('49');
      } else if (cell.isBgPalette()) {
        switch (cell.getBgColorMode()) {
          case Attributes.CM_P16: sgrSeq.push(`${40 + bgColor}`); break;
          case Attributes.CM_P256: sgrSeq.push(`48;5;${bgColor}`); break;
        }
      } else if (cell.isFgRGB()) {
        const [r, g, b] = CellData.toColorRGB(bgColor);
        sgrSeq.push(`48;2;${r};${g};${b}`);
      }
    }
  }

  protected _cellChanged(cell: ICellData, oldCell: ICellData, row: number, col: number): void {
    const fgChanged = cell.fg !== oldCell.fg;
    const bgChanged = cell.bg !== oldCell.bg;
    const isfgBgNormal = (cell.fg === 0) && (cell.bg === 0);

    if ((fgChanged || bgChanged) && isfgBgNormal) {
      this._currentRow += '\x1b[0m';
    }

    if (this._sgrSeq.length) {
      this._currentRow += `\x1b[${this._sgrSeq.join(';')}m`;
      this._sgrSeq = [];
    }

    this._currentRow += cell.getChars();
  }

  protected _serializeFinished(): string {
    return this._allRows.join('\r\n');
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
    const handler = new StringSerializeHandler((<any>this._terminal)._core.buffer);

    rows = crop(rows, 0, maxRows, maxRows);

    return handler.serialize(maxRows - rows, maxRows);
  }

  public dispose(): void { }
}
