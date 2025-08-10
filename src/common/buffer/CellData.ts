/**
 * Copyright (c) 2018 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import { CharData, ICellData, IExtendedAttrs } from 'common/Types';
import { stringFromCodePoint } from 'common/input/TextDecoder';
import { CHAR_DATA_CHAR_INDEX, CHAR_DATA_WIDTH_INDEX, CHAR_DATA_ATTR_INDEX, Content } from 'common/buffer/Constants';
import { AttributeData, ExtendedAttrs } from 'common/buffer/AttributeData';

/**
 * CellData - represents a single Cell in the terminal buffer.
 */
export class CellData extends AttributeData implements ICellData {
  /** Helper to create CellData from CharData. */
  public static fromCharData(value: CharData): CellData {
    const obj = new CellData();
    obj.setFromCharData(value);
    return obj;
  }

  public static fromChar(text: string, width: number = -1, fg: number = 0): CellData {
    const obj = new CellData();
    obj.setFromChar(text, width, fg);
    return obj;
  }

  /** Primitives from terminal buffer.
   * @deprecated
  */
  public content = 0;
  public fg = 0;
  public bg = 0;

  public combinedData = '';

  public copyFrom(src: CellData): void {
    this.content = src.content;
    this.fg = src.fg;
    this.bg = src.bg;
    this.extended = src.extended;
  }

  /** Whether cell contains a combined string. DEPRECTED */
  public isCombined(): number {
    return this.content & Content.IS_COMBINED_MASK;
  }
  /** Width of the cell. */
  public getWidth(): number {
    return this.content >> Content.WIDTH_SHIFT;
  }
  /** JS string of the content. */
  public getChars(): string {
    if (this.content & Content.IS_COMBINED_MASK) {
      return this.combinedData;
    }
    if (this.content & Content.CODEPOINT_MASK) {
      return stringFromCodePoint(this.content & Content.CODEPOINT_MASK);
    }
    return '';
  }
  /**
   * Codepoint of cell
   * Note this returns the UTF32 codepoint of single chars,
   * if content is a combined string it returns the codepoint
   * of the last char in string to be in line with code in CharData.
   */
  public getCode(): number {
    if (this.isCombined()) {
      const chars = this.getChars();
      return chars.charCodeAt(chars.length - 1);
    }
    return this.content & Content.CODEPOINT_MASK;
  }
  public setFromChar(text: string, width: number = -1, fg: number = 0) {
    width = width >= 0 ? width : stringFromCodePoint.length === 0 ? 0 : 1;
    this.fg = fg;
    this.bg = 0;
    let code = text.charCodeAt(0) || 0;
    let combined = false;
    const length = text.length;
    // surrogates and combined strings need special treatment
    if (length > 2) {
      combined = true;
    }
    else if (length === 2) {
      // if the 2-char string is a surrogate create single codepoint
      // everything else is combined
      if (0xD800 <= code && code <= 0xDBFF) {
        const second = text.charCodeAt(1);
        if (0xDC00 <= second && second <= 0xDFFF) {
          code = ((code - 0xD800) * 0x400 + second - 0xDC00 + 0x10000);
        }
        else {
          combined = true;
        }
      }
      else {
        combined = true;
      }
    }
    if (combined) {
      this.combinedData = text;
      code |= Content.IS_COMBINED_MASK;
    }
    this.content = code | (width << Content.WIDTH_SHIFT);
  }

  /** Set data from CharData */
  public setFromCharData(value: CharData): void {
    this.setFromChar(value[CHAR_DATA_CHAR_INDEX], value[CHAR_DATA_WIDTH_INDEX], value[CHAR_DATA_ATTR_INDEX]);
  }

  /** Get data as CharData. */
  public getAsCharData(): CharData {
    return [this.fg, this.getChars(), this.getWidth(), this.getCode()];
  }
}
