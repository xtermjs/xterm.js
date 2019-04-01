/**
 * Copyright (c) 2018 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import {  NULL_CELL_CODE, WHITESPACE_CELL_CHAR } from '../../Buffer';
import { FLAGS } from '../Types';
import { IBufferLine, ITerminalOptions } from '../../Types';
import { DEFAULT_COLOR, INVERTED_DEFAULT_COLOR } from '../atlas/Types';
import { CellData } from '../../BufferLine';

export const BOLD_CLASS = 'xterm-bold';
export const ITALIC_CLASS = 'xterm-italic';
export const CURSOR_CLASS = 'xterm-cursor';
export const CURSOR_BLINK_CLASS = 'xterm-cursor-blink';
export const CURSOR_STYLE_BLOCK_CLASS = 'xterm-cursor-block';
export const CURSOR_STYLE_BAR_CLASS = 'xterm-cursor-bar';
export const CURSOR_STYLE_UNDERLINE_CLASS = 'xterm-cursor-underline';

export class DomRendererRowFactory {
  private _cell: CellData = new CellData();
  constructor(
    private _terminalOptions: ITerminalOptions,
    private _document: Document
  ) {
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
      if (lineData.loadCell(x, this._cell).getCode() !== NULL_CELL_CODE || (isCursorRow && x === cursorX)) {
        lineLength = x + 1;
        break;
      }
    }

    for (let x = 0; x < lineLength; x++) {
      lineData.loadCell(x, this._cell);
      const attr = this._cell.fg;
      const width = this._cell.getWidth();

      // The character to the left is a wide character, drawing is owned by the char at x-1
      if (width === 0) {
        continue;
      }

      const charElement = this._document.createElement('span');
      if (width > 1) {
        charElement.style.width = `${cellWidth * width}px`;
      }

      const flags = attr >> 18;
      let bg = attr & 0x1ff;
      let fg = (attr >> 9) & 0x1ff;

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

      // If inverse flag is on, the foreground should become the background.
      if (flags & FLAGS.INVERSE) {
        const temp = bg;
        bg = fg;
        fg = temp;
        if (fg === DEFAULT_COLOR) {
          fg = INVERTED_DEFAULT_COLOR;
        }
        if (bg === DEFAULT_COLOR) {
          bg = INVERTED_DEFAULT_COLOR;
        }
      }

      if (flags & FLAGS.BOLD && this._terminalOptions.enableBold) {
        // Convert the FG color to the bold variant. This should not happen when
        // the fg is the inverse default color as there is no bold variant.
        if (fg < 8 && this._terminalOptions.drawBoldTextInBrightColors) {
          fg += 8;
        }
        charElement.classList.add(BOLD_CLASS);
      }

      if (flags & FLAGS.ITALIC) {
        charElement.classList.add(ITALIC_CLASS);
      }

      charElement.textContent = this._cell.getChars() || WHITESPACE_CELL_CHAR;
      if (fg !== DEFAULT_COLOR) {
        charElement.classList.add(`xterm-fg-${fg}`);
      }
      if (bg !== DEFAULT_COLOR) {
        charElement.classList.add(`xterm-bg-${bg}`);
      }
      fragment.appendChild(charElement);
    }
    return fragment;
  }
}
