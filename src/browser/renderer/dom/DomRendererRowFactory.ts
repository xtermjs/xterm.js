/**
 * Copyright (c) 2018 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import { IBufferLine, ICellData, IColor } from 'common/Types';
import { INVERTED_DEFAULT_COLOR } from 'browser/renderer/atlas/Constants';
import { NULL_CELL_CODE, WHITESPACE_CELL_CHAR, Attributes } from 'common/buffer/Constants';
import { CellData } from 'common/buffer/CellData';
import { IBufferService, ICoreService, IDecorationService, IOptionsService } from 'common/services/Services';
import { color, rgba } from 'common/Color';
import { IColorSet } from 'browser/Types';
import { ICharacterJoinerService, ISelectionService } from 'browser/services/Services';
import { JoinedCellData } from 'browser/services/CharacterJoinerService';
import { excludeFromContrastRatioDemands } from 'browser/renderer/RendererUtils';

export const BOLD_CLASS = 'xterm-bold';
export const DIM_CLASS = 'xterm-dim';
export const ITALIC_CLASS = 'xterm-italic';
export const UNDERLINE_CLASS = 'xterm-underline';
export const STRIKETHROUGH_CLASS = 'xterm-strikethrough';
export const CURSOR_CLASS = 'xterm-cursor';
export const CURSOR_BLINK_CLASS = 'xterm-cursor-blink';
export const CURSOR_STYLE_BLOCK_CLASS = 'xterm-cursor-block';
export const CURSOR_STYLE_BAR_CLASS = 'xterm-cursor-bar';
export const CURSOR_STYLE_UNDERLINE_CLASS = 'xterm-cursor-underline';

export class DomRendererRowFactory {
  private _workCell: CellData = new CellData();

  private _selectionStart: [number, number] | undefined;
  private _selectionEnd: [number, number] | undefined;
  private _columnSelectMode: boolean = false;

  constructor(
    private readonly _document: Document,
    private _colors: IColorSet,
    @ICharacterJoinerService private readonly _characterJoinerService: ICharacterJoinerService,
    @IOptionsService private readonly _optionsService: IOptionsService,
    @ICoreService private readonly _coreService: ICoreService,
    @IDecorationService private readonly _decorationService: IDecorationService
  ) {
  }

  public setColors(colors: IColorSet): void {
    this._colors = colors;
  }

  public onSelectionChanged(start: [number, number] | undefined, end: [number, number] | undefined, columnSelectMode: boolean): void {
    this._selectionStart = start;
    this._selectionEnd = end;
    this._columnSelectMode = columnSelectMode;
  }

  public createRow(lineData: IBufferLine, row: number, isCursorRow: boolean, cursorStyle: string | undefined, cursorX: number, cursorBlink: boolean, cellWidth: number, cols: number): DocumentFragment {
    const fragment = this._document.createDocumentFragment();

    const joinedRanges = this._characterJoinerService.getJoinedCharacters(row);
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
      let width = this._workCell.getWidth();

      // The character to the left is a wide character, drawing is owned by the char at x-1
      if (width === 0) {
        continue;
      }

      // If true, indicates that the current character(s) to draw were joined.
      let isJoined = false;
      let lastCharX = x;

      // Process any joined character ranges as needed. Because of how the
      // ranges are produced, we know that they are valid for the characters
      // and attributes of our input.
      let cell = this._workCell;
      if (joinedRanges.length > 0 && x === joinedRanges[0][0]) {
        isJoined = true;
        const range = joinedRanges.shift()!;

        // We already know the exact start and end column of the joined range,
        // so we get the string and width representing it directly
        cell = new JoinedCellData(
          this._workCell,
          lineData.translateToString(true, range[0], range[1]),
          range[1] - range[0]
        );

        // Skip over the cells occupied by this range in the loop
        lastCharX = range[1] - 1;

        // Recalculate width
        width = cell.getWidth();
      }

      const charElement = this._document.createElement('span');
      if (width > 1) {
        charElement.style.width = `${cellWidth * width}px`;
      }

      if (isJoined) {
        // Ligatures in the DOM renderer must use display inline, as they may not show with
        // inline-block if they are outside the bounds of the element
        charElement.style.display = 'inline';

        // The DOM renderer colors the background of the cursor but for ligatures all cells are
        // joined. The workaround here is to show a cursor around the whole ligature so it shows up,
        // the cursor looks the same when on any character of the ligature though
        if (cursorX >= x && cursorX <= lastCharX) {
          cursorX = x;
        }
      }

      if (!this._coreService.isCursorHidden && isCursorRow && x === cursorX) {
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

      if (cell.isBold()) {
        charElement.classList.add(BOLD_CLASS);
      }

      if (cell.isItalic()) {
        charElement.classList.add(ITALIC_CLASS);
      }

      if (cell.isDim()) {
        charElement.classList.add(DIM_CLASS);
      }

      if (cell.isUnderline()) {
        charElement.classList.add(UNDERLINE_CLASS);
      }

      if (cell.isInvisible()) {
        charElement.textContent = WHITESPACE_CELL_CHAR;
      } else {
        charElement.textContent = cell.getChars() || WHITESPACE_CELL_CHAR;
      }

      if (cell.isStrikethrough()) {
        charElement.classList.add(STRIKETHROUGH_CLASS);
      }

      let fg = cell.getFgColor();
      let fgColorMode = cell.getFgColorMode();
      let bg = cell.getBgColor();
      let bgColorMode = cell.getBgColorMode();
      const isInverse = !!cell.isInverse();
      if (isInverse) {
        const temp = fg;
        fg = bg;
        bg = temp;
        const temp2 = fgColorMode;
        fgColorMode = bgColorMode;
        bgColorMode = temp2;
      }

      // Apply any decoration foreground/background overrides, this must happen after inverse has
      // been applied
      let bgOverride: IColor | undefined;
      let fgOverride: IColor | undefined;
      let isTop = false;
      for (const d of this._decorationService.getDecorationsAtCell(x, row)) {
        if (d.options.layer !== 'top' && isTop) {
          continue;
        }
        if (d.backgroundColorRGB) {
          bgColorMode = Attributes.CM_RGB;
          bg = d.backgroundColorRGB.rgba >> 8 & 0xFFFFFF;
          bgOverride = d.backgroundColorRGB;
        }
        if (d.foregroundColorRGB) {
          fgColorMode = Attributes.CM_RGB;
          fg = d.foregroundColorRGB.rgba >> 8 & 0xFFFFFF;
          fgOverride = d.foregroundColorRGB;
        }
        isTop = d.options.layer === 'top';
      }

      // Apply selection foreground if applicable
      const isInSelection = this._isCellInSelection(x, row);
      if (!isTop) {
        if (this._colors.selectionForeground && isInSelection) {
          fgColorMode = Attributes.CM_RGB;
          fg = this._colors.selectionForeground.rgba >> 8 & 0xFFFFFF;
          fgOverride = this._colors.selectionForeground;
        }
      }

      // If in the selection, force the element to be above the selection to improve contrast and
      // support opaque selections
      if (isInSelection) {
        bgOverride = this._colors.selectionOpaque;
        isTop = true;
      }

      // If it's a top decoration, render above the selection
      if (isTop) {
        charElement.classList.add(`xterm-decoration-top`);
      }

      // Background
      let resolvedBg: IColor;
      switch (bgColorMode) {
        case Attributes.CM_P16:
        case Attributes.CM_P256:
          resolvedBg = this._colors.ansi[bg];
          charElement.classList.add(`xterm-bg-${bg}`);
          break;
        case Attributes.CM_RGB:
          resolvedBg = rgba.toColor(bg >> 16, bg >> 8 & 0xFF, bg & 0xFF);
          this._addStyle(charElement, `background-color:#${padStart((bg >>> 0).toString(16), '0', 6)}`);
          break;
        case Attributes.CM_DEFAULT:
        default:
          if (isInverse) {
            resolvedBg = this._colors.foreground;
            charElement.classList.add(`xterm-bg-${INVERTED_DEFAULT_COLOR}`);
          } else {
            resolvedBg = this._colors.background;
          }
      }

      // Foreground
      switch (fgColorMode) {
        case Attributes.CM_P16:
        case Attributes.CM_P256:
          if (cell.isBold() && fg < 8 && this._optionsService.rawOptions.drawBoldTextInBrightColors) {
            fg += 8;
          }
          if (!this._applyMinimumContrast(charElement, resolvedBg, this._colors.ansi[fg], cell, bgOverride, undefined)) {
            charElement.classList.add(`xterm-fg-${fg}`);
          }
          break;
        case Attributes.CM_RGB:
          const color = rgba.toColor(
            (fg >> 16) & 0xFF,
            (fg >>  8) & 0xFF,
            (fg      ) & 0xFF
          );
          if (!this._applyMinimumContrast(charElement, resolvedBg, color, cell, bgOverride, fgOverride)) {
            this._addStyle(charElement, `color:#${padStart(fg.toString(16), '0', 6)}`);
          }
          break;
        case Attributes.CM_DEFAULT:
        default:
          if (!this._applyMinimumContrast(charElement, resolvedBg, this._colors.foreground, cell, bgOverride, undefined)) {
            if (isInverse) {
              charElement.classList.add(`xterm-fg-${INVERTED_DEFAULT_COLOR}`);
            }
          }
      }

      fragment.appendChild(charElement);

      x = lastCharX;
    }
    return fragment;
  }

  private _applyMinimumContrast(element: HTMLElement, bg: IColor, fg: IColor, cell: ICellData, bgOverride: IColor | undefined, fgOverride: IColor | undefined): boolean {
    if (this._optionsService.rawOptions.minimumContrastRatio === 1 || excludeFromContrastRatioDemands(cell.getCode())) {
      return false;
    }

    // Try get from cache first, only use the cache when there are no decoration overrides
    let adjustedColor: IColor | undefined | null = undefined;
    if (!bgOverride && !fgOverride) {
      adjustedColor = this._colors.contrastCache.getColor(bg.rgba, fg.rgba);
    }

    // Calculate and store in cache
    if (adjustedColor === undefined) {
      adjustedColor = color.ensureContrastRatio(bgOverride || bg, fgOverride || fg, this._optionsService.rawOptions.minimumContrastRatio);
      this._colors.contrastCache.setColor((bgOverride || bg).rgba, (fgOverride || fg).rgba, adjustedColor ?? null);
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

  private _isCellInSelection(x: number, y: number): boolean {
    const start = this._selectionStart;
    const end = this._selectionEnd;
    if (!start || !end) {
      return false;
    }
    if (this._columnSelectMode) {
      if (start[0] <= end[0]) {
        return x >= start[0] && y >= start[1] &&
          x < end[0] && y <= end[1];
      }
      return x < start[0] && y >= start[1] &&
        x >= end[0] && y <= end[1];
    }
    return (y > start[1] && y < end[1]) ||
        (start[1] === end[1] && y === start[1] && x >= start[0] && x < end[0]) ||
        (start[1] < end[1] && y === end[1] && x < end[0]) ||
        (start[1] < end[1] && y === start[1] && x >= start[0]);
  }
}

function padStart(text: string, padChar: string, length: number): string {
  while (text.length < length) {
    text = padChar + text;
  }
  return text;
}
