/**
 * Copyright (c) 2019 The xterm.js authors. All rights reserved.
 * @license MIT
 *
 * (EXPERIMENTAL) This Addon is still under development
 */

import type { IBuffer, IBufferCell, IBufferRange, ITerminalAddon, Terminal } from '@xterm/xterm';
import type { IHTMLSerializeOptions, SerializeAddon as ISerializeApi, ISerializeOptions, ISerializeRange } from '@xterm/addon-serialize';
import { DEFAULT_ANSI_COLORS } from 'browser/services/ThemeService';
import { IAttributeData, IColor } from 'common/Types';

function constrain(value: number, low: number, high: number): number {
  return Math.max(low, Math.min(value, high));
}

function escapeHTMLChar(c: string): string {
  switch (c) {
    case '&': return '&amp;';
    case '<': return '&lt;';
  }
  return c;
}

// TODO: Refine this template class later
abstract class BaseSerializeHandler {
  constructor(
    protected readonly _buffer: IBuffer
  ) {
  }

  public serialize(range: IBufferRange, excludeFinalCursorPosition?: boolean): string {
    // we need two of them to flip between old and new cell
    const cell1 = this._buffer.getNullCell();
    const cell2 = this._buffer.getNullCell();
    let oldCell = cell1;

    const startRow = range.start.y;
    const endRow = range.end.y;
    const startColumn = range.start.x;
    const endColumn = range.end.x;

    this._beforeSerialize(endRow - startRow, startRow, endRow);

    for (let row = startRow; row <= endRow; row++) {
      const line = this._buffer.getLine(row);
      if (line) {
        const startLineColumn = row === range.start.y ? startColumn : 0;
        const endLineColumn = row === range.end.y ? endColumn: line.length;
        for (let col = startLineColumn; col < endLineColumn; col++) {
          const c = line.getCell(col, oldCell === cell1 ? cell2 : cell1);
          if (!c) {
            console.warn(`Can't get cell at row=${row}, col=${col}`);
            continue;
          }
          this._nextCell(c, oldCell, row, col);
          oldCell = c;
        }
      }
      this._rowEnd(row, row === endRow);
    }

    this._afterSerialize();

    return this._serializeString(excludeFinalCursorPosition);
  }

  protected _nextCell(cell: IBufferCell, oldCell: IBufferCell, row: number, col: number): void { }
  protected _rowEnd(row: number, isLastRow: boolean): void { }
  protected _beforeSerialize(rows: number, startRow: number, endRow: number): void { }
  protected _afterSerialize(): void { }
  protected _serializeString(excludeFinalCursorPosition?: boolean): string { return ''; }
}

function equalFg(cell1: IBufferCell | IAttributeData, cell2: IBufferCell): boolean {
  return cell1.getFgColorMode() === cell2.getFgColorMode()
    && cell1.getFgColor() === cell2.getFgColor();
}

function equalBg(cell1: IBufferCell | IAttributeData, cell2: IBufferCell): boolean {
  return cell1.getBgColorMode() === cell2.getBgColorMode()
    && cell1.getBgColor() === cell2.getBgColor();
}

function equalFlags(cell1: IBufferCell | IAttributeData, cell2: IBufferCell): boolean {
  return cell1.isInverse() === cell2.isInverse()
    && cell1.isBold() === cell2.isBold()
    && cell1.isUnderline() === cell2.isUnderline()
    && cell1.isOverline() === cell2.isOverline()
    && cell1.isBlink() === cell2.isBlink()
    && cell1.isInvisible() === cell2.isInvisible()
    && cell1.isItalic() === cell2.isItalic()
    && cell1.isDim() === cell2.isDim()
    && cell1.isStrikethrough() === cell2.isStrikethrough();
}

class StringSerializeHandler extends BaseSerializeHandler {
  private _rowIndex: number = 0;
  private _allRows: string[] = new Array<string>();
  private _allRowSeparators: string[] = new Array<string>();
  private _currentRow: string = '';
  private _nullCellCount: number = 0;

  // we can see a full colored cell and a null cell that only have background the same style
  // but the information isn't preserved by null cell itself
  // so wee need to record it when required.
  private _cursorStyle: IBufferCell = this._buffer.getNullCell();

  // where exact the cursor styles comes from
  // because we can't copy the cell directly
  // so we remember where the content comes from instead
  private _cursorStyleRow: number = 0;
  private _cursorStyleCol: number = 0;

  // this is a null cell for reference for checking whether background is empty or not
  private _backgroundCell: IBufferCell = this._buffer.getNullCell();

  private _firstRow: number = 0;
  private _lastCursorRow: number = 0;
  private _lastCursorCol: number = 0;
  private _lastContentCursorRow: number = 0;
  private _lastContentCursorCol: number = 0;

  constructor(
    buffer: IBuffer,
    private readonly _terminal: Terminal
  ) {
    super(buffer);
  }

  protected _beforeSerialize(rows: number, start: number, end: number): void {
    this._allRows = new Array<string>(rows);
    this._lastContentCursorRow = start;
    this._lastCursorRow = start;
    this._firstRow = start;
  }

  private _thisRowLastChar: IBufferCell = this._buffer.getNullCell();
  private _thisRowLastSecondChar: IBufferCell = this._buffer.getNullCell();
  private _nextRowFirstChar: IBufferCell = this._buffer.getNullCell();
  protected _rowEnd(row: number, isLastRow: boolean): void {
    // if there is colorful empty cell at line end, whe must pad it back, or the the color block
    // will missing
    if (this._nullCellCount > 0 && !equalBg(this._cursorStyle, this._backgroundCell)) {
      // use clear right to set background.
      this._currentRow += `\u001b[${this._nullCellCount}X`;
    }

    let rowSeparator = '';

    // handle row separator
    if (!isLastRow) {
      // Enable BCE
      if (row - this._firstRow >= this._terminal.rows) {
        this._buffer.getLine(this._cursorStyleRow)?.getCell(this._cursorStyleCol, this._backgroundCell);
      }

      // Fetch current line
      const currentLine = this._buffer.getLine(row)!;
      // Fetch next line
      const nextLine = this._buffer.getLine(row + 1)!;

      if (!nextLine.isWrapped) {
        // just insert the line break
        rowSeparator = '\r\n';
        // we sended the enter
        this._lastCursorRow = row + 1;
        this._lastCursorCol = 0;
      } else {
        rowSeparator = '';
        const thisRowLastChar = currentLine.getCell(currentLine.length - 1, this._thisRowLastChar)!;
        const thisRowLastSecondChar = currentLine.getCell(currentLine.length - 2, this._thisRowLastSecondChar)!;
        const nextRowFirstChar = nextLine.getCell(0, this._nextRowFirstChar)!;
        const isNextRowFirstCharDoubleWidth = nextRowFirstChar.getWidth() > 1;

        // validate whether this line wrap is ever possible
        // which mean whether cursor can placed at a overflow position (x === row) naturally
        let isValid = false;

        if (
          // you must output character to cause overflow, control sequence can't do this
          nextRowFirstChar.getChars() &&
            isNextRowFirstCharDoubleWidth ? this._nullCellCount <= 1 : this._nullCellCount <= 0
        ) {
          if (
            // the last character can't be null,
            // you can't use control sequence to move cursor to (x === row)
            (thisRowLastChar.getChars() || thisRowLastChar.getWidth() === 0) &&
            // change background of the first wrapped cell also affects BCE
            // so we mark it as invalid to simply the process to determine line separator
            equalBg(thisRowLastChar, nextRowFirstChar)
          ) {
            isValid = true;
          }

          if (
            // the second to last character can't be null if the next line starts with CJK,
            // you can't use control sequence to move cursor to (x === row)
            isNextRowFirstCharDoubleWidth &&
            (thisRowLastSecondChar.getChars() || thisRowLastSecondChar.getWidth() === 0) &&
            // change background of the first wrapped cell also affects BCE
            // so we mark it as invalid to simply the process to determine line separator
            equalBg(thisRowLastChar, nextRowFirstChar) &&
            equalBg(thisRowLastSecondChar, nextRowFirstChar)
          ) {
            isValid = true;
          }
        }

        if (!isValid) {
          // force the wrap with magic
          // insert enough character to force the wrap
          rowSeparator = '-'.repeat(this._nullCellCount + 1);
          // move back and erase next line head
          rowSeparator += '\u001b[1D\u001b[1X';

          if (this._nullCellCount > 0) {
            // do these because we filled the last several null slot, which we shouldn't
            rowSeparator += '\u001b[A';
            rowSeparator += `\u001b[${currentLine.length - this._nullCellCount}C`;
            rowSeparator += `\u001b[${this._nullCellCount}X`;
            rowSeparator += `\u001b[${currentLine.length - this._nullCellCount}D`;
            rowSeparator += '\u001b[B';
          }

          // This is content and need the be serialized even it is invisible.
          // without this, wrap will be missing from outputs.
          this._lastContentCursorRow = row + 1;
          this._lastContentCursorCol = 0;

          // force commit the cursor position
          this._lastCursorRow = row + 1;
          this._lastCursorCol = 0;
        }
      }
    }

    this._allRows[this._rowIndex] = this._currentRow;
    this._allRowSeparators[this._rowIndex++] = rowSeparator;
    this._currentRow = '';
    this._nullCellCount = 0;
  }

  private _diffStyle(cell: IBufferCell | IAttributeData, oldCell: IBufferCell): number[] {
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
          if (cell.isOverline() !== oldCell.isOverline()) { sgrSeq.push(cell.isOverline() ? 53 : 55); }
          if (cell.isBlink() !== oldCell.isBlink()) { sgrSeq.push(cell.isBlink() ? 5 : 25); }
          if (cell.isInvisible() !== oldCell.isInvisible()) { sgrSeq.push(cell.isInvisible() ? 8 : 28); }
          if (cell.isItalic() !== oldCell.isItalic()) { sgrSeq.push(cell.isItalic() ? 3 : 23); }
          if (cell.isDim() !== oldCell.isDim()) { sgrSeq.push(cell.isDim() ? 2 : 22); }
          if (cell.isStrikethrough() !== oldCell.isStrikethrough()) { sgrSeq.push(cell.isStrikethrough() ? 9 : 29); }
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

    const sgrSeq = this._diffStyle(cell, this._cursorStyle);

    // the empty cell style is only assumed to be changed when background changed, because
    // foreground is always 0.
    const styleChanged = isEmptyCell ? !equalBg(this._cursorStyle, cell) : sgrSeq.length > 0;

    /**
     *  handles style change
     */
    if (styleChanged) {
      // before update the style, we need to fill empty cell back
      if (this._nullCellCount > 0) {
        // use clear right to set background.
        if (!equalBg(this._cursorStyle, this._backgroundCell)) {
          this._currentRow += `\u001b[${this._nullCellCount}X`;
        }
        // use move right to move cursor.
        this._currentRow += `\u001b[${this._nullCellCount}C`;
        this._nullCellCount = 0;
      }

      this._lastContentCursorRow = this._lastCursorRow = row;
      this._lastContentCursorCol = this._lastCursorCol = col;

      this._currentRow += `\u001b[${sgrSeq.join(';')}m`;

      // update the last cursor style
      const line = this._buffer.getLine(row);
      if (line !== undefined) {
        line.getCell(col, this._cursorStyle);
        this._cursorStyleRow = row;
        this._cursorStyleCol = col;
      }
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
        if (equalBg(this._cursorStyle, this._backgroundCell)) {
          this._currentRow += `\u001b[${this._nullCellCount}C`;
        } else {
          this._currentRow += `\u001b[${this._nullCellCount}X`;
          this._currentRow += `\u001b[${this._nullCellCount}C`;
        }
        this._nullCellCount = 0;
      }

      this._currentRow += cell.getChars();

      // update cursor
      this._lastContentCursorRow = this._lastCursorRow = row;
      this._lastContentCursorCol = this._lastCursorCol = col + cell.getWidth();
    }
  }

  protected _serializeString(excludeFinalCursorPosition: boolean): string {
    let rowEnd = this._allRows.length;

    // the fixup is only required for data without scrollback
    // because it will always be placed at last line otherwise
    if (this._buffer.length - this._firstRow <= this._terminal.rows) {
      rowEnd = this._lastContentCursorRow + 1 - this._firstRow;
      this._lastCursorCol = this._lastContentCursorCol;
      this._lastCursorRow = this._lastContentCursorRow;
    }

    let content = '';

    for (let i = 0; i < rowEnd; i++) {
      content += this._allRows[i];
      if (i + 1 < rowEnd) {
        content += this._allRowSeparators[i];
      }
    }

    // restore the cursor
    if (!excludeFinalCursorPosition) {
      const realCursorRow = this._buffer.baseY + this._buffer.cursorY;
      const realCursorCol = this._buffer.cursorX;

      const cursorMoved = (realCursorRow !== this._lastCursorRow || realCursorCol !== this._lastCursorCol);

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

      if (cursorMoved) {
        moveDown(realCursorRow - this._lastCursorRow);
        moveRight(realCursorCol - this._lastCursorCol);
      }
    }

    // Restore the cursor's current style, see https://github.com/xtermjs/xterm.js/issues/3677
    // HACK: Internal API access since it's awkward to expose this in the API and serialize will
    // likely be the only consumer
    const curAttrData: IAttributeData = (this._terminal as any)._core._inputHandler._curAttrData;
    const sgrSeq = this._diffStyle(curAttrData, this._cursorStyle);
    if (sgrSeq.length > 0) {
      content += `\u001b[${sgrSeq.join(';')}m`;
    }

    return content;
  }
}

export class SerializeAddon implements ITerminalAddon , ISerializeApi {
  private _terminal: Terminal | undefined;

  public activate(terminal: Terminal): void {
    this._terminal = terminal;
  }

  private _serializeBufferByScrollback(terminal: Terminal, buffer: IBuffer, scrollback?: number): string {
    const maxRows = buffer.length;
    const correctRows = (scrollback === undefined) ? maxRows : constrain(scrollback + terminal.rows, 0, maxRows);
    return this._serializeBufferByRange(terminal, buffer, {
      start: maxRows - correctRows,
      end: maxRows - 1
    }, false);
  }

  private _serializeBufferByRange(terminal: Terminal, buffer: IBuffer, range: ISerializeRange, excludeFinalCursorPosition: boolean): string {
    const handler = new StringSerializeHandler(buffer, terminal);
    return handler.serialize({
      start: { x: 0,             y: typeof range.start === 'number' ? range.start : range.start.line },
      end:   { x: terminal.cols, y: typeof range.end   === 'number' ? range.end   : range.end.line   }
    }, excludeFinalCursorPosition);
  }

  private _serializeBufferAsHTML(terminal: Terminal, options: Partial<IHTMLSerializeOptions>): string {
    const buffer = terminal.buffer.active;
    const handler = new HTMLSerializeHandler(buffer, terminal, options);
    const onlySelection = options.onlySelection ?? false;
    if (!onlySelection) {
      const maxRows = buffer.length;
      const scrollback = options.scrollback;
      const correctRows = (scrollback === undefined) ? maxRows : constrain(scrollback + terminal.rows, 0, maxRows);
      return handler.serialize({
        start: { x: 0,             y: maxRows - correctRows },
        end:   { x: terminal.cols, y: maxRows - 1           }
      });
    }

    const selection = this._terminal?.getSelectionPosition();
    if (selection !== undefined) {
      return handler.serialize({
        start: { x: selection.start.x, y: selection.start.y },
        end:   { x: selection.end.x,   y: selection.end.y   }
      });
    }

    return '';
  }

  private _serializeModes(terminal: Terminal): string {
    let content = '';
    const modes = terminal.modes;

    // Default: false
    if (modes.applicationCursorKeysMode) content += '\x1b[?1h';
    if (modes.applicationKeypadMode) content += '\x1b[?66h';
    if (modes.bracketedPasteMode) content += '\x1b[?2004h';
    if (modes.insertMode) content += '\x1b[4h';
    if (modes.originMode) content += '\x1b[?6h';
    if (modes.reverseWraparoundMode) content += '\x1b[?45h';
    if (modes.sendFocusMode) content += '\x1b[?1004h';

    // Default: true
    if (modes.wraparoundMode === false) content += '\x1b[?7l';

    // Default: 'none'
    if (modes.mouseTrackingMode !== 'none') {
      switch (modes.mouseTrackingMode) {
        case 'x10': content += '\x1b[?9h'; break;
        case 'vt200': content += '\x1b[?1000h'; break;
        case 'drag': content += '\x1b[?1002h'; break;
        case 'any': content += '\x1b[?1003h'; break;
      }
    }

    return content;
  }

  public serialize(options?: ISerializeOptions): string {
    // TODO: Add combinedData support
    if (!this._terminal) {
      throw new Error('Cannot use addon until it has been loaded');
    }

    // Normal buffer
    let content = options?.range
      ? this._serializeBufferByRange(this._terminal, this._terminal.buffer.normal, options.range, true)
      : this._serializeBufferByScrollback(this._terminal, this._terminal.buffer.normal, options?.scrollback);

    // Alternate buffer
    if (!options?.excludeAltBuffer) {
      if (this._terminal.buffer.active.type === 'alternate') {
        const alternativeScreenContent = this._serializeBufferByScrollback(this._terminal, this._terminal.buffer.alternate, undefined);
        content += `\u001b[?1049h\u001b[H${alternativeScreenContent}`;
      }
    }

    // Modes
    if (!options?.excludeModes) {
      content += this._serializeModes(this._terminal);
    }

    return content;
  }

  public serializeAsHTML(options?: Partial<IHTMLSerializeOptions>): string {
    if (!this._terminal) {
      throw new Error('Cannot use addon until it has been loaded');
    }

    return this._serializeBufferAsHTML(this._terminal, options || {});
  }

  public dispose(): void { }
}

export class HTMLSerializeHandler extends BaseSerializeHandler {
  private _currentRow: string = '';

  private _htmlContent = '';

  private _ansiColors: Readonly<IColor[]>;

  constructor(
    buffer: IBuffer,
    private readonly _terminal: Terminal,
    private readonly _options: Partial<IHTMLSerializeOptions>
  ) {
    super(buffer);

    // For xterm headless: fallback to ansi colors
    if ((_terminal as any)._core._themeService) {
      this._ansiColors = (_terminal as any)._core._themeService.colors.ansi;
    }
    else {
      this._ansiColors = DEFAULT_ANSI_COLORS;
    }
  }

  private _padStart(target: string, targetLength: number, padString: string): string {
    targetLength = targetLength >> 0;
    padString = padString ?? ' ';
    if (target.length > targetLength) {
      return target;
    }

    targetLength -= target.length;
    if (targetLength > padString.length) {
      padString += padString.repeat(targetLength / padString.length);
    }
    return padString.slice(0, targetLength) + target;
  }

  protected _beforeSerialize(rows: number, start: number, end: number): void {
    this._htmlContent += '<html><body><!--StartFragment--><pre>';

    let foreground = '#000000';
    let background = '#ffffff';
    if (this._options.includeGlobalBackground ?? false) {
      foreground = this._terminal.options.theme?.foreground ?? '#ffffff';
      background = this._terminal.options.theme?.background ?? '#000000';
    }

    const globalStyleDefinitions = [];
    globalStyleDefinitions.push('color: ' + foreground + ';');
    globalStyleDefinitions.push('background-color: ' + background + ';');
    globalStyleDefinitions.push('font-family: ' + this._terminal.options.fontFamily + ';');
    globalStyleDefinitions.push('font-size: ' + this._terminal.options.fontSize + 'px;');
    this._htmlContent += '<div style=\'' + globalStyleDefinitions.join(' ') + '\'>';
  }

  protected _afterSerialize(): void {
    this._htmlContent += '</div>';
    this._htmlContent += '</pre><!--EndFragment--></body></html>';
  }

  protected _rowEnd(row: number, isLastRow: boolean): void {
    this._htmlContent += '<div><span>' + this._currentRow + '</span></div>';
    this._currentRow = '';
  }

  private _getHexColor(cell: IBufferCell, isFg: boolean): string | undefined {
    const color = isFg ? cell.getFgColor() : cell.getBgColor();
    if (isFg ? cell.isFgRGB() : cell.isBgRGB()) {
      const rgb = [
        (color >> 16) & 255,
        (color >>  8) & 255,
        (color      ) & 255
      ];
      return '#' + rgb.map(x => this._padStart(x.toString(16), 2, '0')).join('');
    }
    if (isFg ? cell.isFgPalette() : cell.isBgPalette()) {
      return this._ansiColors[color].css;
    }
    return undefined;
  }

  private _diffStyle(cell: IBufferCell, oldCell: IBufferCell): string[] | undefined {
    const content: string[] = [];

    const fgChanged = !equalFg(cell, oldCell);
    const bgChanged = !equalBg(cell, oldCell);
    const flagsChanged = !equalFlags(cell, oldCell);

    if (fgChanged || bgChanged || flagsChanged) {
      const fgHexColor = this._getHexColor(cell, true);
      if (fgHexColor) {
        content.push('color: ' + fgHexColor + ';');
      }

      const bgHexColor = this._getHexColor(cell, false);
      if (bgHexColor) {
        content.push('background-color: ' + bgHexColor + ';');
      }

      if (cell.isInverse()) { content.push('color: #000000; background-color: #BFBFBF;'); }
      if (cell.isBold()) { content.push('font-weight: bold;'); }
      if (cell.isUnderline() && cell.isOverline()) { content.push('text-decoration: overline underline;'); }
      else if (cell.isUnderline()) { content.push('text-decoration: underline;'); }
      else if (cell.isOverline()) { content.push('text-decoration: overline;'); }
      if (cell.isBlink()) { content.push('text-decoration: blink;'); }
      if (cell.isInvisible()) { content.push('visibility: hidden;'); }
      if (cell.isItalic()) { content.push('font-style: italic;'); }
      if (cell.isDim()) { content.push('opacity: 0.5;'); }
      if (cell.isStrikethrough()) { content.push('text-decoration: line-through;'); }

      return content;
    }

    return undefined;
  }

  protected _nextCell(cell: IBufferCell, oldCell: IBufferCell, row: number, col: number): void {
    // a width 0 cell don't need to be count because it is just a placeholder after a CJK character;
    const isPlaceHolderCell = cell.getWidth() === 0;
    if (isPlaceHolderCell) {
      return;
    }

    // this cell don't have content
    const isEmptyCell = cell.getChars() === '';

    const styleDefinitions = this._diffStyle(cell, oldCell);

    // handles style change
    if (styleDefinitions) {
      this._currentRow += styleDefinitions.length === 0 ?
        '</span><span>' :
        '</span><span style=\'' + styleDefinitions.join(' ') + '\'>';
    }

    // handles actual content
    if (isEmptyCell) {
      this._currentRow += ' ';
    } else {
      this._currentRow += escapeHTMLChar(cell.getChars());
    }
  }

  protected _serializeString(): string {
    return this._htmlContent;
  }
}
