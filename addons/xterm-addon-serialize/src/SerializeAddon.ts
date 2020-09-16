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

interface ISerializeOptions {
  withAlternate?: boolean;
  withCursor?: boolean;
}

// TODO: Refine this template class later
abstract class BaseSerializeHandler {
  constructor(private _buffer: IBuffer) { }

  public serialize(startRow: number, endRow: number): string {
    // we need two of them to flip between old and new cell
    const cell1 = this._buffer.getNullCell();
    const cell2 = this._buffer.getNullCell();
    let oldCell = cell1;

    this._beforeSerialize(endRow - startRow, startRow, endRow);

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
  protected _beforeSerialize(rows: number, startRow: number, endRow: number): void { }
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

  // this is a null cell for reference for checking whether background is empty or not
  private _nullCell: IBufferCell = this._buffer1.getNullCell();

  // we can see a full colored cell and a null cell that only have background the same style
  // but the information isn't preserved by null cell itself
  // so wee need to record it when required.
  private _cursorStyle: IBufferCell = this._buffer1.getNullCell();

  private _lastCursorRow: number = 0;
  private _lastCursorCol: number = 0;

  constructor(private _buffer1: IBuffer,private _terminal: Terminal, private _option: ISerializeOptions = {}) {
    super(_buffer1);
  }

  protected _beforeSerialize(rows: number, start: number, end: number): void {
    this._allRows = new Array<string>(rows);
    this._lastCursorRow = start;
  }

  protected _rowEnd(row: number): void {
    // if there is colorful empty cell at line end, whe must pad it back, or the the color block will missing
    if (this._nullCellCount > 0 && !equalBg(this._cursorStyle, this._nullCell)) {
      // use clear right to set background.
      // use move right to move cursor.
      this._currentRow += `\x1b[${this._nullCellCount}X`;

      // set the cursor back because we aren't there
      this._lastCursorRow = row;
      this._lastCursorCol = this._terminal.cols - this._nullCellCount;

      this._nullCellCount = 0;

      // perform a style reset before next line,
      // because scroll when having background set will change the whole background of next line.
      this._currentRow += `\x1b[m`;
      // FIXME: we just get a new one because we can't reset it.
      this._cursorStyle = this._buffer1.getNullCell();
    }

    this._allRows[this._rowIndex++] = this._currentRow;
    this._currentRow = '';
    this._nullCellCount = 0;
  }

  private _diffStyle (cell: IBufferCell, oldCell: IBufferCell): number[] {
    const sgrSeq: number[] = [];
    const fgChanged = !equalFg(cell, oldCell);
    const bgChanged = !equalBg(cell, oldCell);
    const flagsChanged = !equalFlags(cell, oldCell);

    if (fgChanged || bgChanged || flagsChanged) {
      if (cell.isAttributeDefault()) {
        if (!oldCell.isAttributeDefault()) {
          sgrSeq.push(0);
        }
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

    return sgrSeq;
  }

  protected _nextCell(cell: IBufferCell, oldCell: IBufferCell, row: number, col: number): void {
    // a width 0 cell don't need to be count because it is just a placeholder after a CJK character;
    const isPlaceHolderCell = cell.getWidth() === 0;

    if (isPlaceHolderCell) {
      return;
    }

    // this cell don't have content
    const isEmptyCell = cell.getChars() === '';

    // this cell don't have content and style
    const isNullCell = cell.getWidth() === 1 && cell.getChars() === '' && cell.isAttributeDefault();

    const sgrSeq = this._diffStyle(cell, this._cursorStyle);

    // the empty cell style is only assumed to be changed when background changed, because foreground is always 0.
    const styleChanged = isEmptyCell ? !equalBg(this._cursorStyle, cell) : sgrSeq.length > 0;

    /**
     *  handles style change
     */
    if (styleChanged) {
      // before update the style, we need to fill empty cell back
      if (this._nullCellCount > 0) {
        // use clear right to set background.
        // use move right to move cursor.
        if (equalBg(this._cursorStyle, this._nullCell)) {
          this._currentRow += `\x1b[${this._nullCellCount}C`;
        } else {
          this._currentRow += `\x1b[${this._nullCellCount}X`;
          this._currentRow += `\x1b[${this._nullCellCount}C`;
        }
        this._nullCellCount = 0;
      }

      this._currentRow += `\x1b[${sgrSeq.join(';')}m`;

      // update the last cursor style
      this._buffer1.getLine(row)?.getCell(col, this._cursorStyle);
    }

    /**
     *  handles actual content
     */
    if (isEmptyCell) {
      this._nullCellCount += cell.getWidth();
    } else {
      if (this._nullCellCount > 0) {
        // we can just assume we have same style with previous one here
        // because style change is handled by previous stage
        // use move right when background is empty, use clear right when there is background.
        if (equalBg(this._cursorStyle, this._nullCell)) {
          this._currentRow += `\x1b[${this._nullCellCount}C`;
        } else {
          this._currentRow += `\x1b[${this._nullCellCount}X`;
          this._currentRow += `\x1b[${this._nullCellCount}C`;
        }
        this._nullCellCount = 0;
      }
      this._currentRow += cell.getChars();
    }

    if (!isNullCell) {
      this._lastCursorRow = row;
      this._lastCursorCol = col + cell.getWidth();
    }
  }

  protected _serializeString(): string {
    let rowEnd = this._allRows.length;

    for (; rowEnd > 0; rowEnd--) {
      if (this._allRows[rowEnd - 1]) {
        break;
      }
    }

    let content = this._allRows.slice(0, rowEnd).join('\r\n');

    if (this._option.withCursor ?? true) {
      const realCursorRow = this._buffer1.baseY + this._buffer1.cursorY;
      const realCursorCol = this._buffer1.cursorX;

      const hasScroll = this._buffer1.length > this._terminal.rows!;
      const hasEmptyLine = hasScroll ? (this._buffer1.length - 1 > this._lastCursorRow) : (realCursorRow > this._lastCursorRow);
      const cursorMoved =
        hasScroll
          ? hasEmptyLine
            ? (realCursorCol !== 0 || realCursorRow !== this._buffer1.length - 1)
            : (realCursorRow !== this._lastCursorRow || realCursorCol !== this._lastCursorCol)
          : hasEmptyLine
            // we don't need to check the row because empty row count are based on cursor
            ? realCursorCol !== 0
            : (realCursorRow !== this._lastCursorRow || realCursorCol !== this._lastCursorCol);

      const moveRight = (offset: number): void => {
        if (offset > 0) {
          content += `\u001b[${offset}C`;
        } else if (offset < 0) {
          content += `\u001b[${-offset}D`;
        }
      };
      const moveDown = (offset: number): void => {
        if (offset > 0) {
          content += `\u001b[${offset}B`;
        } else if (offset < 0) {
          content += `\u001b[${-offset}A`;
        }
      };

      // Fix empty lines
      if (hasEmptyLine) {
        if (hasScroll) {
          content += '\r\n'.repeat(this._buffer1.length - 1 - this._lastCursorRow);
        } else {
          content += '\r\n'.repeat(realCursorRow - this._lastCursorRow);
        }
      }

      if (cursorMoved) {
        if (hasEmptyLine) {
          if (hasScroll) {
            moveRight(realCursorCol);
            moveDown(realCursorRow - (this._buffer1.length - 1));
          } else {
            moveRight(realCursorCol);
          }
        } else {
          moveDown(realCursorRow - this._lastCursorRow);
          moveRight(realCursorCol - this._lastCursorCol);
        }
      }
    }

    return content;
  }
}

export class SerializeAddon implements ITerminalAddon {
  private _terminal: Terminal | undefined;

  constructor() { }

  public activate(terminal: Terminal): void {
    this._terminal = terminal;
  }

  private _getString(buffer: IBuffer, scrollback?: number, option?: ISerializeOptions): string {
    const maxRows = buffer.length;
    const handler = new StringSerializeHandler(buffer, this._terminal!, option);

    const correctRows = (scrollback === undefined) ? maxRows : constrain(scrollback + this!._terminal!.rows, 0, maxRows);
    const result = handler.serialize(maxRows - correctRows, maxRows);

    return result;
  }

  public inspectBuffer(buffer: IBuffer): { x: number, y: number, data: any[][] } {
    const lines: any[] = [];
    const cell = buffer.getNullCell();

    for (let i = 0; i < buffer.length; i++) {
      const line = [];
      const bufferLine = buffer.getLine(i)!;
      for (let j = 0; j < bufferLine.length; j++) {
        const cellData: any = {};
        bufferLine.getCell(j, cell)!;
        cellData.getBgColor = cell.getBgColor();
        cellData.getBgColorMode = cell.getBgColorMode();
        cellData.getChars = cell.getChars();
        cellData.getCode = cell.getCode();
        cellData.getFgColor = cell.getFgColor();
        cellData.getFgColorMode = cell.getFgColorMode();
        cellData.getWidth = cell.getWidth();
        cellData.isAttributeDefault = cell.isAttributeDefault();
        cellData.isBlink = cell.isBlink();
        cellData.isBold = cell.isBold();
        cellData.isDim = cell.isDim();
        cellData.isInverse = cell.isInverse();
        cellData.isInvisible = cell.isInvisible();

        line.push(cellData);
      }

      lines.push(line);
    }

    return {
      x: buffer.cursorX,
      y: buffer.cursorY,
      data: lines
    };
  }

  public serialize(scrollback?: number, options: ISerializeOptions = {}): string {
    // TODO: Add word wrap mode support
    // TODO: Add combinedData support
    if (!this._terminal) {
      throw new Error('Cannot use addon until it has been loaded');
    }

    if (this._terminal.buffer.active.type === 'normal' || !(options.withAlternate ?? true)) {
      return this._getString(this._terminal.buffer.active, scrollback, options);
    }

    const normalScreenContent = this._getString(this._terminal.buffer.normal, scrollback, options);
    // alt screen don't have scrollback
    const alternativeScreenContent = this._getString(this._terminal.buffer.alternate, undefined, options);

    return normalScreenContent
      + '\u001b[?1049h\u001b[H'
      + alternativeScreenContent;
  }

  public dispose(): void { }
}
