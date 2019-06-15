/**
 * Copyright (c) 2019 The xterm.js authors. All rights reserved.
 * @license MIT
 */

export const DEFAULT_COLOR = 256;
export const DEFAULT_ATTR = (0 << 18) | (DEFAULT_COLOR << 9) | (256 << 0);

export const CHAR_DATA_ATTR_INDEX = 0;
export const CHAR_DATA_CHAR_INDEX = 1;
export const CHAR_DATA_WIDTH_INDEX = 2;
export const CHAR_DATA_CODE_INDEX = 3;

/**
 * Null cell - a real empty cell (containing nothing).
 * Note that code should always be 0 for a null cell as
 * several test condition of the buffer line rely on this.
 */
export const NULL_CELL_CHAR = '';
export const NULL_CELL_WIDTH = 1;
export const NULL_CELL_CODE = 0;

/**
 * Whitespace cell.
 * This is meant as a replacement for empty cells when needed
 * during rendering lines to preserve correct aligment.
 */
export const WHITESPACE_CELL_CHAR = ' ';
export const WHITESPACE_CELL_WIDTH = 1;
export const WHITESPACE_CELL_CODE = 32;

/**
 * Bitmasks for accessing data in `content`.
 */
export const enum Content {
  /**
   * bit 1..21    codepoint, max allowed in UTF32 is 0x10FFFF (21 bits taken)
   *              read:   `codepoint = content & Content.codepointMask;`
   *              write:  `content |= codepoint & Content.codepointMask;`
   *                      shortcut if precondition `codepoint <= 0x10FFFF` is met:
   *                      `content |= codepoint;`
   */
  CODEPOINT_MASK = 0x1FFFFF,

  /**
   * bit 22       flag indication whether a cell contains combined content
   *              read:   `isCombined = content & Content.isCombined;`
   *              set:    `content |= Content.isCombined;`
   *              clear:  `content &= ~Content.isCombined;`
   */
  IS_COMBINED_MASK = 0x200000,  // 1 << 21

  /**
   * bit 1..22    mask to check whether a cell contains any string data
   *              we need to check for codepoint and isCombined bits to see
   *              whether a cell contains anything
   *              read:   `isEmpty = !(content & Content.hasContent)`
   */
  HAS_CONTENT_MASK = 0x3FFFFF,

  /**
   * bit 23..24   wcwidth value of cell, takes 2 bits (ranges from 0..2)
   *              read:   `width = (content & Content.widthMask) >> Content.widthShift;`
   *                      `hasWidth = content & Content.widthMask;`
   *                      as long as wcwidth is highest value in `content`:
   *                      `width = content >> Content.widthShift;`
   *              write:  `content |= (width << Content.widthShift) & Content.widthMask;`
   *                      shortcut if precondition `0 <= width <= 3` is met:
   *                      `content |= width << Content.widthShift;`
   */
  WIDTH_MASK = 0xC00000,   // 3 << 22
  WIDTH_SHIFT = 22
}
