/**
 * Copyright (c) 2018 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import {  NULL_CELL_CODE, WHITESPACE_CELL_CHAR } from '../../Buffer';
import { IBufferLine } from '../../Types';
import { INVERTED_DEFAULT_COLOR } from '../atlas/Types';
import { CellData } from '../../BufferLine';

export const BOLD_CLASS = 'xterm-bold';
export const ITALIC_CLASS = 'xterm-italic';
export const CURSOR_CLASS = 'xterm-cursor';
export const CURSOR_STYLE_BLOCK_CLASS = 'xterm-cursor-block';
export const CURSOR_STYLE_BAR_CLASS = 'xterm-cursor-bar';
export const CURSOR_STYLE_UNDERLINE_CLASS = 'xterm-cursor-underline';

export class DomRendererRowFactory {
  private _cell: CellData = new CellData();
  constructor(
    private _document: Document
  ) {
  }

  public createRow(lineData: IBufferLine, isCursorRow: boolean, cursorStyle: string | undefined, cursorX: number, cellWidth: number, cols: number): DocumentFragment {
    const fragment = this._document.createDocumentFragment();

    // Find the line length first, this prevents the need to output a bunch of
    // empty cells at the end. This cannot easily be integrated into the main
    // loop below because of the colCount feature (which can be removed after we
    // properly support reflow and disallow data to go beyond the right-side of
    // the viewport).
    let lineLength = 0;
    for (let x = Math.min(lineData.length, cols) - 1; x >= 0; x--) {
      if (lineData.loadCell(x, this._cell).code !== NULL_CELL_CODE || (isCursorRow && x === cursorX)) {
        lineLength = x + 1;
        break;
      }
    }

    for (let x = 0; x < lineLength; x++) {
      lineData.loadCell(x, this._cell);
      const width = this._cell.width;

      // The character to the left is a wide character, drawing is owned by the char at x-1
      if (width === 0) {
        continue;
      }

      const charElement = this._document.createElement('span');
      if (width > 1) {
        charElement.style.width = `${cellWidth * width}px`;
      }

      if (isCursorRow && x === cursorX) {
        charElement.classList.add(CURSOR_CLASS);

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

      if (this._cell.isBold()) {
        charElement.classList.add(BOLD_CLASS);
      }

      if (this._cell.isItalic()) {
        charElement.classList.add(ITALIC_CLASS);
      }

      charElement.textContent = this._cell.chars || WHITESPACE_CELL_CHAR;

      const swapColor = !!this._cell.isInverse();

      // fg
      if (this._cell.isFgRGB()) {
        let style = charElement.getAttribute('style') || '';
        style += `${swapColor ? 'background-' : ''}color: rgb(${(this._cell.getFgColor(true) as number[]).join(',')});`;
        charElement.setAttribute('style', style);
      } else if (this._cell.isFgPalette()) {
        let fg = this._cell.getFgColor() as number;
        if (this._cell.isBold() && fg < 8 && !swapColor) {
          fg += 8;
        }
        charElement.classList.add(`xterm-${swapColor ? 'b' : 'f'}g-${fg}`);
      } else if (swapColor) {
        charElement.classList.add(`xterm-bg-${INVERTED_DEFAULT_COLOR}`);
      }

      // bg
      if (this._cell.isBgRGB()) {
        let style = charElement.getAttribute('style') || '';
        style += `${swapColor ? '' : 'background-'}color: rgb(${(this._cell.getBgColor(true) as number[]).join(',')});`;
        charElement.setAttribute('style', style);
      } else if (this._cell.isBgPalette()) {
        charElement.classList.add(`xterm-${swapColor ? 'f' : 'b'}g-${this._cell.getBgColor()}`);
      } else if (swapColor) {
        charElement.classList.add(`xterm-fg-${INVERTED_DEFAULT_COLOR}`);
      }

      fragment.appendChild(charElement);
    }
    return fragment;
  }
}
