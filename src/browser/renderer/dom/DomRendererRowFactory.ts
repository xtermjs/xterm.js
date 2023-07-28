/**
 * Copyright (c) 2018, 2023 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import { IBufferLine, ICellData, IColor } from 'common/Types';
import { INVERTED_DEFAULT_COLOR } from 'browser/renderer/shared/Constants';
import { WHITESPACE_CELL_CHAR, Attributes } from 'common/buffer/Constants';
import { CellData } from 'common/buffer/CellData';
import { ICoreService, IDecorationService, IOptionsService } from 'common/services/Services';
import { color, rgba } from 'common/Color';
import { ICharacterJoinerService, ICoreBrowserService, IThemeService } from 'browser/services/Services';
import { JoinedCellData } from 'browser/services/CharacterJoinerService';
import { excludeFromContrastRatioDemands } from 'browser/renderer/shared/RendererUtils';
import { AttributeData } from 'common/buffer/AttributeData';
import { SpacingCache } from 'browser/renderer/dom/SpacingCache';

export const BOLD_CLASS = 'xterm-bold';
export const DIM_CLASS = 'xterm-dim';
export const ITALIC_CLASS = 'xterm-italic';
export const UNDERLINE_CLASS = 'xterm-underline';
export const OVERLINE_CLASS = 'xterm-overline';
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
    @ICharacterJoinerService private readonly _characterJoinerService: ICharacterJoinerService,
    @IOptionsService private readonly _optionsService: IOptionsService,
    @ICoreBrowserService private readonly _coreBrowserService: ICoreBrowserService,
    @ICoreService private readonly _coreService: ICoreService,
    @IDecorationService private readonly _decorationService: IDecorationService,
    @IThemeService private readonly _themeService: IThemeService
  ) {}

  public handleSelectionChanged(start: [number, number] | undefined, end: [number, number] | undefined, columnSelectMode: boolean): void {
    this._selectionStart = start;
    this._selectionEnd = end;
    this._columnSelectMode = columnSelectMode;
  }

  public createRow(
    lineData: IBufferLine,
    row: number,
    isCursorRow: boolean,
    cursorStyle: string | undefined,
    cursorX: number,
    cursorBlink: boolean,
    cellWidth: number,
    spacingCache: SpacingCache,
    linkStart: number,
    linkEnd: number
  ): DocumentFragment {

    const fragment = this._document.createDocumentFragment();
    const joinedRanges = this._characterJoinerService.getJoinedCharacters(row);
    const colors = this._themeService.colors;

    let lineLength = lineData.getNoBgTrimmedLength();
    if (isCursorRow && lineLength < cursorX + 1) {
      lineLength = cursorX + 1;
    }

    let charElement: HTMLSpanElement | undefined;
    let cellAmount = 0;
    let text = '';
    let oldBg = 0;
    let oldFg = 0;
    let oldExt = 0;
    let oldLinkHover: number | boolean = false;
    let oldSpacing = 0;
    let spacing = 0;

    const hasHover = linkStart !== -1 && linkEnd !== -1;

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

      const isInSelection = this._isCellInSelection(x, row);
      const isCursorCell = isCursorRow && x === cursorX;
      const isLinkHover = hasHover && x >= linkStart && x <= linkEnd;

      let chars = cell.getChars() || WHITESPACE_CELL_CHAR;
      if (chars === ' ' && (cell.isUnderline() || cell.isOverline())) {
        chars = '\xa0';
      }
      spacing = spacingCache.get(chars, width * cellWidth, 0);

      if (!charElement) {
        charElement = this._document.createElement('span');
      } else {
        /**
         * chars can only be merged on existing span if:
         * - existing span only contains mergeable chars (cellAmount != 0)
         * - fg/bg/ul did not change
         * - char not part of a selection
         * - underline from hover state did not change
         * - cell content renders to same letter-spacing
         * - char is not cursor
         */
        if (
          cellAmount
          && cell.bg === oldBg && cell.fg === oldFg && cell.extended.ext === oldExt
          && !isInSelection
          && isLinkHover === oldLinkHover
          && spacing === oldSpacing
          && !isCursorCell
          && !isJoined
        ) {
          text += chars;
          cellAmount++;
          continue;
        } else {
          if (cellAmount) {
            charElement.textContent = text;
          }
          charElement = this._document.createElement('span');
          cellAmount = 0;
          text = '';
        }
      }
      oldBg = cell.bg;
      oldFg = cell.fg;
      oldExt = cell.extended.ext;
      oldLinkHover = isLinkHover;
      oldSpacing = spacing;

      if (isJoined) {
        // The DOM renderer colors the background of the cursor but for ligatures all cells are
        // joined. The workaround here is to show a cursor around the whole ligature so it shows up,
        // the cursor looks the same when on any character of the ligature though
        if (cursorX >= x && cursorX <= lastCharX) {
          cursorX = x;
        }
      }

      if (!this._coreService.isCursorHidden && isCursorCell) {
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

      if (cell.isInvisible()) {
        text = WHITESPACE_CELL_CHAR;
      } else {
        text = cell.getChars() || WHITESPACE_CELL_CHAR;
      }

      if (cell.isUnderline()) {
        charElement.classList.add(`${UNDERLINE_CLASS}-${cell.extended.underlineStyle}`);
        if (text === ' ') {
          text = '\xa0'; // = &nbsp;
        }
        if (!cell.isUnderlineColorDefault()) {
          if (cell.isUnderlineColorRGB()) {
            charElement.style.textDecorationColor = `rgb(${AttributeData.toColorRGB(cell.getUnderlineColor()).join(',')})`;
          } else {
            let fg = cell.getUnderlineColor();
            if (this._optionsService.rawOptions.drawBoldTextInBrightColors && cell.isBold() && fg < 8) {
              fg += 8;
            }
            charElement.style.textDecorationColor = colors.ansi[fg].css;
          }
        }
      }

      if (cell.isOverline()) {
        charElement.classList.add(OVERLINE_CLASS);
        if (text === ' ') {
          text = '\xa0'; // = &nbsp;
        }
      }

      if (cell.isStrikethrough()) {
        charElement.classList.add(STRIKETHROUGH_CLASS);
      }

      // apply link hover underline late, effectively overrides any previous text-decoration settings
      if (isLinkHover) {
        charElement.style.textDecoration = 'underline';
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
      this._decorationService.forEachDecorationAtCell(x, row, undefined, d => {
        if (d.options.layer !== 'top' && isTop) {
          return;
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
      });

      // Apply selection foreground if applicable
      if (!isTop) {
        if (colors.selectionForeground && isInSelection) {
          fgColorMode = Attributes.CM_RGB;
          fg = colors.selectionForeground.rgba >> 8 & 0xFFFFFF;
          fgOverride = colors.selectionForeground;
        }
      }

      // If in the selection, force the element to be above the selection to improve contrast and
      // support opaque selections
      if (isInSelection) {
        bgOverride = this._coreBrowserService.isFocused ? colors.selectionBackgroundOpaque : colors.selectionInactiveBackgroundOpaque;
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
          resolvedBg = colors.ansi[bg];
          charElement.classList.add(`xterm-bg-${bg}`);
          break;
        case Attributes.CM_RGB:
          resolvedBg = rgba.toColor(bg >> 16, bg >> 8 & 0xFF, bg & 0xFF);
          this._addStyle(charElement, `background-color:#${padStart((bg >>> 0).toString(16), '0', 6)}`);
          break;
        case Attributes.CM_DEFAULT:
        default:
          if (isInverse) {
            resolvedBg = colors.foreground;
            charElement.classList.add(`xterm-bg-${INVERTED_DEFAULT_COLOR}`);
          } else {
            resolvedBg = colors.background;
          }
      }

      // If there is no background override by now it's the original color, so apply dim if needed
      if (!bgOverride) {
        if (cell.isDim()) {
          bgOverride = color.multiplyOpacity(resolvedBg, 0.5);
        }
      }

      // Foreground
      switch (fgColorMode) {
        case Attributes.CM_P16:
        case Attributes.CM_P256:
          if (cell.isBold() && fg < 8 && this._optionsService.rawOptions.drawBoldTextInBrightColors) {
            fg += 8;
          }
          if (!this._applyMinimumContrast(charElement, resolvedBg, colors.ansi[fg], cell, bgOverride, undefined)) {
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
          if (!this._applyMinimumContrast(charElement, resolvedBg, colors.foreground, cell, bgOverride, undefined)) {
            if (isInverse) {
              charElement.classList.add(`xterm-fg-${INVERTED_DEFAULT_COLOR}`);
            }
          }
      }

      if (!isCursorCell && !isInSelection && !isJoined) {
        cellAmount++;
      } else {
        charElement.textContent = text;
      }
      if (spacing) {
        charElement.style.letterSpacing = `${spacing}px`;
      }

      fragment.appendChild(charElement);
      x = lastCharX;
    }

    // postfix text of last merged span
    if (charElement && cellAmount) {
      charElement.textContent = text;
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
      adjustedColor = this._themeService.colors.contrastCache.getColor(bg.rgba, fg.rgba);
    }

    // Calculate and store in cache
    if (adjustedColor === undefined) {
      adjustedColor = color.ensureContrastRatio(bgOverride || bg, fgOverride || fg, this._optionsService.rawOptions.minimumContrastRatio);
      this._themeService.colors.contrastCache.setColor((bgOverride || bg).rgba, (fgOverride || fg).rgba, adjustedColor ?? null);
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
