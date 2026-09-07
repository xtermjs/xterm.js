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
  /*
  public get content(): number { return this._content;}
  public set content(v: number) {
    this._content = v; }
    */
  public fg = 0;
  public bg = 0;
  public extended: IExtendedAttrs = new ExtendedAttrs();
  /**
  * Cache for getChars.
  * If _stringStart == -1: Use codepoint in this.content.
  * If _stringStart == 0 && _stringEnd == -1: Entire _string.
  * Otherwise: substring of _string.
  */
  public _string: string  = '';
  public _stringStart: number = 0;
  public _stringEnd: number = -1; // Whole string
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
    if (this._stringStart === 0 && this._stringEnd < 0) {
      return this._string;
    }
    let str;
    if (this._stringStart < 0) {
      const codePoint = this.content & Content.CODEPOINT_MASK;
      str = codePoint ? stringFromCodePoint(codePoint) : '';
    } else {
      str = this._string.substring(this._stringStart, this._stringEnd);
    }
    this._string = str;
    this._stringStart = 0;
    this._stringEnd = -1;
    return str;
  }
  public _setChars(str: string, strStart: number = 0, strEnd: number = -1): void {
    this._string = str;
    this._stringStart = strStart;
    this._stringEnd = strEnd;
  }
  /**
   * Codepoint of cell
   * Note this returns the UTF32 codepoint of single chars,
   * if content is a combined string it returns the codepoint
   * of the last char in string to be in line with code in CharData.
   */
  public getCode(): number {
    return !this.isCombined() ? this.content & Content.CODEPOINT_MASK
      : this._string.charCodeAt(this._stringEnd < 0 ? this._string.length -1 : this._stringEnd - 1);
  }

  /** Set data from CharData */
  public setFromCharData(value: CharData): void {
    this.fg = value[CHAR_DATA_ATTR_INDEX];
    this.bg = 0;
    let combined = false;
    // surrogates and combined strings need special treatment
    if (value[CHAR_DATA_CHAR_INDEX].length > 2) {
      combined = true;
    }
    else if (value[CHAR_DATA_CHAR_INDEX].length === 2) {
      const code = value[CHAR_DATA_CHAR_INDEX].charCodeAt(0);
      // if the 2-char string is a surrogate create single codepoint
      // everything else is combined
      if (0xD800 <= code && code <= 0xDBFF) {
        const second = value[CHAR_DATA_CHAR_INDEX].charCodeAt(1);
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
      this.content = value[CHAR_DATA_CHAR_INDEX].charCodeAt(0) | (value[CHAR_DATA_WIDTH_INDEX] << Content.WIDTH_SHIFT);
    }
    if (combined) {
      this._string = value[CHAR_DATA_CHAR_INDEX];
      this._stringStart = 0;
      this._stringEnd = -1;
      this.content = Content.IS_COMBINED_MASK | (value[CHAR_DATA_WIDTH_INDEX] << Content.WIDTH_SHIFT);
    } else {
      this._string = '';
      this._stringStart = -1;
      this._stringEnd = 0;
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
