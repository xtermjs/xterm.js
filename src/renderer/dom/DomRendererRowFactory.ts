/**
 * Copyright (c) 2018 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import { ITerminalOptions } from '../../Types';
import { IBufferLine } from '../../core/Types';
import { INVERTED_DEFAULT_COLOR } from '../atlas/Types';
import { CellData, AttributeData, NULL_CELL_CODE } from '../../core/buffer/BufferLine';

export const BOLD_CLASS = 'xterm-bold';
export const DIM_CLASS = 'xterm-dim';
export const ITALIC_CLASS = 'xterm-italic';
export const UNDERLINE_CLASS = 'xterm-underline';
export const CURSOR_CLASS = 'xterm-cursor';
export const CURSOR_BLINK_CLASS = 'xterm-cursor-blink';
export const CURSOR_STYLE_BLOCK_CLASS = 'xterm-cursor-block';
export const CURSOR_STYLE_BAR_CLASS = 'xterm-cursor-bar';
export const CURSOR_STYLE_UNDERLINE_CLASS = 'xterm-cursor-underline';

export class DomRendererRowFactory {
  private _workCell: CellData = new CellData();
  private _combinedMatch: {[key: string]: boolean};
  private _codepointMatch: Int8Array;
  private _measureElement: HTMLSpanElement;
  private _charWidth: number = -1;

  constructor(
    private _terminalOptions: ITerminalOptions,
    private _document: Document
  ) {
    // Hack: sloppy own measuring here since we get different values
    // TODO: merge with charMeasure above
    this._combinedMatch = Object.create(null);
    this._codepointMatch = new Int8Array(65536);
    this._measureElement = document.createElement('span');
    this._measureElement.style.visibility = 'hidden';
    this._measureElement.style.cssFloat = 'left';
    setTimeout(() => {
      this._document.getElementsByClassName('xterm-rows')[0].appendChild(this._measureElement);
      // do some precalc for ascii chars to get typical width
      const widths: number[] = [];
      let max = 0;
      const distribution: {[key: number]: number} = {};
      for (let i = 33; i < 127; ++i) {
        this._measureElement.textContent = String.fromCharCode(i).repeat(64);
        const width = this._measureElement.clientWidth / 64;
        widths.push(width);
        if (!distribution[width]) {
          distribution[width] = 0;
        }
        distribution[width]++;
        max = Math.max(max, width);
        this._charWidth = max;
      }
      for (let i = 0; i < widths.length; ++i) {
        this._codepointMatch[i + 33] = +(this._charWidth === widths[i]) + 1;
      }

    }, 0);
  }

  private _charWidthMatches(ch: string): boolean {
    this._measureElement.textContent = ch.repeat(64);
    return this._measureElement.clientWidth / 64 === this._charWidth;
  }

  // FIXME: also handle bold as some fonts change char width for bold
  public widthMatch(): boolean {
    if (this._workCell.isCombined()) {
      let ch = this._workCell.getChars();
      if (!ch || ch === ' ') {
        ch = '\xa0';
      }
      if (!this._combinedMatch[ch]) {
        this._combinedMatch[ch] = this._charWidthMatches(ch);
      }
      return this._combinedMatch[ch];
    }
    const cp = this._workCell.getCode();
    if (cp > 0xFFFF) {
      return this._charWidthMatches(this._workCell.getChars());
    }
    if (!this._codepointMatch[cp]) {
      this._codepointMatch[cp] = +this._charWidthMatches(this._workCell.getChars()) + 1;
    }
    return !!(this._codepointMatch[cp] - 1);
  }

  public createRow(lineData: IBufferLine, isCursorRow: boolean, cursorStyle: string | undefined, cursorX: number, cursorBlink: boolean, cellWidth: number, cols: number): DocumentFragment {
    const fragment = this._document.createDocumentFragment();

    // Find the line length first, this prevents the need to output a bunch of
    // empty cells at the end. This cannot easily be integrated into the main
    // loop below because of the colCount feature (which can be removed after we
    // properly support reflow and disallow data to go beyond the right-side of
    // the viewport).
    let lineLength = 0;
    for (let x = Math.min(lineData.length, cols) - 1; x >= 0; x--) {
      if (lineData.loadCell(x, this._workCell).getCode() !== NULL_CELL_CODE || (isCursorRow && x === cursorX)) {
        lineLength = x + 1;
        break;
      }
    }
    
    let oldFg = -1;
    let oldBg = -1;
    let text = '';
    let charElement: HTMLSpanElement | null = null;

    for (let x = 0; x < lineLength; x++) {
      lineData.loadCell(x, this._workCell);
      const width = this._workCell.getWidth();
      const ch = this._workCell.getChars();

      // The character to the left is a wide character, drawing is owned by the char at x-1
      if (width === 0) {
        continue;
      }

      // if (width > 1) {
      //   charElement.style.width = `${cellWidth * width}px`;
      // }

      const widthMismatch = !this.widthMatch();

      if (this._workCell.fg !== oldFg
          || this._workCell.bg !== oldBg
          || widthMismatch) {
        if (charElement) {
          charElement.textContent = text;
          fragment.appendChild(charElement);
          text = '';
        }
        oldFg = (widthMismatch) ? -1 : this._workCell.fg;
        oldBg = (widthMismatch) ? -1 : this._workCell.bg;
        charElement = this._document.createElement('span');

        if (widthMismatch) {
          charElement.style.width = `${this._charWidth * width}px`;
        }

        if (this._workCell.isBold()) {
          charElement.classList.add(BOLD_CLASS);
        }

        if (this._workCell.isItalic()) {
          charElement.classList.add(ITALIC_CLASS);
        }

        if (this._workCell.isDim()) {
          charElement.classList.add(DIM_CLASS);
        }

        if (this._workCell.isUnderline()) {
          charElement.classList.add(UNDERLINE_CLASS);
        }

        const swapColor = this._workCell.isInverse();

        // fg
        if (this._workCell.isFgRGB()) {
          let style = charElement.getAttribute('style') || '';
          style += `${swapColor ? 'background-' : ''}color:rgb(${(AttributeData.toColorRGB(this._workCell.getFgColor())).join(',')});`;
          charElement.setAttribute('style', style);
        } else if (this._workCell.isFgPalette()) {
          let fg = this._workCell.getFgColor();
          if (this._workCell.isBold() && fg < 8 && !swapColor && this._terminalOptions.drawBoldTextInBrightColors) {
            fg += 8;
          }
          charElement.classList.add(`xterm-${swapColor ? 'b' : 'f'}g-${fg}`);
        } else if (swapColor) {
          charElement.classList.add(`xterm-bg-${INVERTED_DEFAULT_COLOR}`);
        }

        // bg
        if (this._workCell.isBgRGB()) {
          let style = charElement.getAttribute('style') || '';
          style += `${swapColor ? '' : 'background-'}color:rgb(${(AttributeData.toColorRGB(this._workCell.getBgColor())).join(',')});`;
          charElement.setAttribute('style', style);
        } else if (this._workCell.isBgPalette()) {
          charElement.classList.add(`xterm-${swapColor ? 'f' : 'b'}g-${this._workCell.getBgColor()}`);
        } else if (swapColor) {
          charElement.classList.add(`xterm-fg-${INVERTED_DEFAULT_COLOR}`);
        }

      }
      text += (!ch || ch === ' ') ? '\xa0' : ch;

      // FIXME: no cursor atm
      /*
      if (isCursorRow && x === cursorX) {
        charElement.classList.add(CURSOR_CLASS);

        if (cursorBlink) {
          charElement.classList.add(CURSOR_BLINK_CLASS);
        }

        switch (cursorStyle) {
          case 'bar':
            charElement.classList.add(CURSOR_STYLE_BAR_CLASS);
            break;
          case 'underline':
            charElement.classList.add(CURSOR_STYLE_UNDERLINE_CLASS);
            break;
          default:
            charElement.classList.add(CURSOR_STYLE_BLOCK_CLASS);
            break;
        }
      }
      */
    }

    if (charElement) {
      charElement.textContent = text;
      fragment.appendChild(charElement);
    }

    return fragment;
  }
}
