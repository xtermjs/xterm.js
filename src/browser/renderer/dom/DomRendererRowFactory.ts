/**
 * Copyright (c) 2018 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import { IBufferLine } from 'common/Types';
import { INVERTED_DEFAULT_COLOR } from 'browser/renderer/atlas/Constants';
import { NULL_CELL_CODE, WHITESPACE_CELL_CHAR, Attributes } from 'common/buffer/Constants';
import { CellData } from 'common/buffer/CellData';
import { IOptionsService } from 'common/services/Services';
import { color, rgba } from 'browser/Color';
import { IColorSet, IColor } from 'browser/Types';

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

  constructor(
    private readonly _document: Document,
    private readonly _optionsService: IOptionsService,
    private _colors: IColorSet
  ) {
  }

  public setColors(colors: IColorSet): void {
    this._colors = colors;
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

    for (let x = 0; x < lineLength; x++) {
      lineData.loadCell(x, this._workCell);
      const width = this._workCell.getWidth();

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

      if (this._workCell.isInvisible()) {
        charElement.textContent = WHITESPACE_CELL_CHAR;
      } else {
        charElement.textContent = this._workCell.getChars() || WHITESPACE_CELL_CHAR;
      }

      let fg = this._workCell.getFgColor();
      let fgColorMode = this._workCell.getFgColorMode();
      let bg = this._workCell.getBgColor();
      let bgColorMode = this._workCell.getBgColorMode();
      const isInverse = !!this._workCell.isInverse();
      if (isInverse) {
        const temp = fg;
        fg = bg;
        bg = temp;
        const temp2 = fgColorMode;
        fgColorMode = bgColorMode;
        bgColorMode = temp2;
      }

      // Foreground
      switch (fgColorMode) {
        case Attributes.CM_P16:
        case Attributes.CM_P256:
          if (this._workCell.isBold() && fg < 8 && this._optionsService.options.drawBoldTextInBrightColors) {
            fg += 8;
          }
          if (!this._applyMinimumContrast(charElement, this._colors.background, this._colors.ansi[fg])) {
            charElement.classList.add(`xterm-fg-${fg}`);
          }
          break;
        case Attributes.CM_RGB:
          const color = rgba.toColor(
            (fg >> 16) & 0xFF,
            (fg >>  8) & 0xFF,
            (fg      ) & 0xFF
          );
          if (!this._applyMinimumContrast(charElement, this._colors.background, color)) {
            this._addStyle(charElement, `color:#${padStart(fg.toString(16), '0', 6)}`);
          }
          break;
        case Attributes.CM_DEFAULT:
        default:
          if (!this._applyMinimumContrast(charElement, this._colors.background, this._colors.foreground)) {
            if (isInverse) {
              charElement.classList.add(`xterm-fg-${INVERTED_DEFAULT_COLOR}`);
            }
          }
      }

      // Background
      switch (bgColorMode) {
        case Attributes.CM_P16:
        case Attributes.CM_P256:
          charElement.classList.add(`xterm-bg-${bg}`);
          break;
        case Attributes.CM_RGB:
          this._addStyle(charElement, `background-color:#${padStart(bg.toString(16), '0', 6)}`);
          break;
        case Attributes.CM_DEFAULT:
        default:
          if (isInverse) {
            charElement.classList.add(`xterm-bg-${INVERTED_DEFAULT_COLOR}`);
          }
      }

      fragment.appendChild(charElement);
    }
    return fragment;
  }

  private _applyMinimumContrast(element: HTMLElement, bg: IColor, fg: IColor): boolean {
    if (this._optionsService.options.minimumContrastRatio === 1) {
      return false;
    }

    // Try get from cache first
    let adjustedColor = this._colors.contrastCache.getColor(this._workCell.bg, this._workCell.fg);

    // Calculate and store in cache
    if (adjustedColor === undefined) {
      adjustedColor = color.ensureContrastRatio(bg, fg, this._optionsService.options.minimumContrastRatio);
      this._colors.contrastCache.setColor(this._workCell.bg, this._workCell.fg, adjustedColor ?? null);
    }

    if (adjustedColor) {
      this._addStyle(element, `color:${adjustedColor.css}`);
      return true;
    }

    return false;
  }

  private _addStyle(element: HTMLElement, style: string): void {
    element.setAttribute('style', `${element.getAttribute('style') || ''}${style};`);
  }
}

function padStart(text: string, padChar: string, length: number): string {
  while (text.length < length) {
    text = padChar + text;
  }
  return text;
}
