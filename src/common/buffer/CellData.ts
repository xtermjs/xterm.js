/**
 * Copyright (c) 2018 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import { CharData, ICellData, IExtendedAttrs } from './Types';
import { stringFromCodePoint } from '../input/TextDecoder';
import { CHAR_DATA_CHAR_INDEX, CHAR_DATA_WIDTH_INDEX, CHAR_DATA_ATTR_INDEX, Content } from './Constants';
import { AttributeData, ExtendedAttrs } from './AttributeData';
import type { IBufferCell as IBufferCellApi } from '@xterm/xterm';

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
  /** Primitives from terminal buffer. */
  public content = 0;
  public fg = 0;
  public bg = 0;
  public extended: IExtendedAttrs = new ExtendedAttrs();
  /**
   * Base string value of cell.
   * Only valid if STORED_IN_CHARS_MASK is set in content field.
   */
  public _string: string  = '';
  public get combinedData(): string {
    return this.isCombined() ? this.getChars() : '';
  }
  /** Whether cell contains a combined string. */
  public isCombined(): number {
    return this.content & Content.IS_COMBINED_MASK;
  }
  /** Width of the cell. */
  public getWidth(): number {
    return this.content >> Content.WIDTH_SHIFT;
  }
  /** JS string of the content. */
  public getChars(): string {
    const content = this.content;
    if (content & Content.STORED_IN_CHARS_MASK) {
      const start = (content & Content.START_IN_CHARS_MASK) >>> Content.START_IN_CHARS_SHIFT;
      const length = (content & Content.LENGTH_IN_CHARS_MASK) >>> Content.LENGTH_IN_CHARS_SHIFT;
      const str = this._string;
      return start === 0 && length === str.length ? str
        : str.substring(start, start + length);
    }
    const codePoint = this.content & Content.CODEPOINT_MASK;
    if (codePoint) {
      // FIXME maybe cache value in _string field?
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
    const content = this.content;
    if (content & Content.STORED_IN_CHARS_MASK) {
      const start = (content & Content.START_IN_CHARS_MASK) >>> Content.START_IN_CHARS_SHIFT;
      const length = (content & Content.LENGTH_IN_CHARS_MASK) >>> Content.LENGTH_IN_CHARS_SHIFT;
      const code = length ? this._string.charCodeAt(start + length - 1) : 0;
      return !code ? 0
        : code < 0xDC000 || code > 0xDFFF || length < 2 ? code
          : this._string.codePointAt(start + length - 2) || code;
      return code;
    }
    return content & Content.CODEPOINT_MASK;
  }

  /** Set data from CharData */
  public setFromCharData(value: CharData): void {
    this.fg = value[CHAR_DATA_ATTR_INDEX];
    this.bg = 0;
    let combined = false;
    const str = value[CHAR_DATA_CHAR_INDEX];
    // surrogates and combined strings need special treatment
    if (str.length > 2) {
      combined = true;
    }
    else if (str.length === 2) {
      const code = str.charCodeAt(0);
      // if the 2-char string is a surrogate create single codepoint
      // everything else is combined
      if (0xD800 <= code && code <= 0xDBFF) {
        const second = str.charCodeAt(1);
        if (0xDC00 <= second && second <= 0xDFFF) {
          this.content = ((code - 0xD800) * 0x400 + second - 0xDC00 + 0x10000) | (value[CHAR_DATA_WIDTH_INDEX] << Content.WIDTH_SHIFT);
        }
        else {
          combined = true;
        }
      }
      else {
        combined = true;
      }
    }
    else {
      this.content = str.charCodeAt(0) | (value[CHAR_DATA_WIDTH_INDEX] << Content.WIDTH_SHIFT);
    }
    if (combined) {
      this._string = str;
      this.content = encodeRange(Content.IS_COMBINED_MASK | (value[CHAR_DATA_WIDTH_INDEX] << Content.WIDTH_SHIFT),
        0, str.length);
    } else {
      this._string = '';
    }
  }
  /** Get data as CharData.
   * @deprecated
   */
  public getAsCharData(): CharData {
    return [this.fg, this.getChars(), this.getWidth(), this.getCode()];
  }

  public attributesEquals(other: IBufferCellApi): boolean {
    if (this.getFgColorMode() !== other.getFgColorMode() || this.getFgColor() !== other.getFgColor()) {
      return false;
    }
    if (this.getBgColorMode() !== other.getBgColorMode() || this.getBgColor() !== other.getBgColor()) {
      return false;
    }
    if (this.isInverse() !== other.isInverse()) {
      return false;
    }
    if (this.isBold() !== other.isBold()) {
      return false;
    }
    if (this.isUnderline() !== other.isUnderline()) {
      return false;
    }
    if (this.isUnderline()) {
      if (this.getUnderlineStyle() !== other.getUnderlineStyle()) {
        return false;
      }
      const thisDefault = this.isUnderlineColorDefault();
      const otherDefault = other.isUnderlineColorDefault();
      if (!(thisDefault && otherDefault)) {
        if (thisDefault !== otherDefault) {
          return false;
        }
        if (this.getUnderlineColor() !== other.getUnderlineColor()) {
          return false;
        }
        if (this.getUnderlineColorMode() !== other.getUnderlineColorMode()) {
          return false;
        }
      }
    }
    if (this.isOverline() !== other.isOverline()) {
      return false;
    }
    if (this.isBlink() !== other.isBlink()) {
      return false;
    }
    if (this.isInvisible() !== other.isInvisible()) {
      return false;
    }
    if (this.isItalic() !== other.isItalic()) {
      return false;
    }
    if (this.isDim() !== other.isDim()) {
      return false;
    }
    if (this.isStrikethrough() !== other.isStrikethrough()) {
      return false;
    }
    return true;
  }

}

export function encodeRange(content: number, start: number, length: number): number {
  content &= ~(Content.START_IN_CHARS_MASK | Content.LENGTH_IN_CHARS_MASK);
  content |= (start << Content.START_IN_CHARS_SHIFT) | (length << Content.LENGTH_IN_CHARS_SHIFT) | Content.STORED_IN_CHARS_MASK;
  return content;
}
