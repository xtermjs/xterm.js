/**
 * Copyright (c) 2018 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import { CHAR_DATA_CHAR_INDEX, CHAR_DATA_ATTR_INDEX, CHAR_DATA_WIDTH_INDEX, CHAR_DATA_CODE_INDEX, NULL_CELL_CODE } from '../../Buffer';
import { FLAGS } from '../Types';
import { IBufferLine } from '../../Types';

export const BOLD_CLASS = 'xterm-bold';
export const ITALIC_CLASS = 'xterm-italic';
export const CURSOR_CLASS = 'xterm-cursor';
export const CURSOR_STYLE_BLOCK_CLASS = 'xterm-cursor-block';
export const CURSOR_STYLE_BAR_CLASS = 'xterm-cursor-bar';
export const CURSOR_STYLE_UNDERLINE_CLASS = 'xterm-cursor-underline';

export class DomRendererRowFactory {
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
    for (let x = 0; x < lineData.length; x++) {
      const charData = lineData.get(x);
      const code = charData[CHAR_DATA_CODE_INDEX];
      if (code !== NULL_CELL_CODE || (isCursorRow && x === cursorX)) {
        lineLength = x + 1;
      }
    }

    let colCount = 0;
    for (let x = 0; x < lineLength; x++) {
      // Don't allow any buffer to the right to be displayed
      if (colCount >= cols) {
        continue;
      }

      const charData = lineData.get(x);
      const char = charData[CHAR_DATA_CHAR_INDEX];
      const attr = charData[CHAR_DATA_ATTR_INDEX];
      const width = charData[CHAR_DATA_WIDTH_INDEX];

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
        if (fg === 256) {
          fg = 0;
        }
        if (bg === 257) {
          bg = 15;
        }
      }

      if (flags & FLAGS.BOLD) {
        // Convert the FG color to the bold variant
        if (fg < 8) {
          fg += 8;
        }
        charElement.classList.add(BOLD_CLASS);
      }

      if (flags & FLAGS.ITALIC) {
        charElement.classList.add(ITALIC_CLASS);
      }

      charElement.textContent = char;
      if (fg !== 257) {
        charElement.classList.add(`xterm-fg-${fg}`);
      }
      if (bg !== 256) {
        charElement.classList.add(`xterm-bg-${bg}`);
      }
      fragment.appendChild(charElement);
      colCount += width;
    }
    return fragment;
  }
}
