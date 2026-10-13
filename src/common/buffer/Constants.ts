/**
 * Copyright (c) 2019 The xterm.js authors. All rights reserved.
 * @license MIT
 */

export const DEFAULT_COLOR = 0;
export const DEFAULT_ATTR = (0 << 18) | (DEFAULT_COLOR << 9) | (256 << 0);
export const DEFAULT_EXT = 0;

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
 * Value of content property for a null cell.
 */
export const NULL_CELL_CONTENT = 0;

/**
 * Whitespace cell.
 * This is meant as a replacement for empty cells when needed
 * during rendering lines to preserve correct alignment.
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
   *              read:   `codepoint = content & Content.CODEPOINT_MASK;`
   *              write:  `content |= codepoint & Content.CODEPOINT_MASK;`
   *                      shortcut if precondition `codepoint <= 0x10FFFF` is met:
   *                      `content |= codepoint;`
   */
  CODEPOINT_MASK = 0x1FFFFF,

  /**
   * bit 22       flag indicating whether a cell contains combined content
   *              read:   `isCombined = content & Content.IS_COMBINED_MASK;`
   *              set:    `content |= Content.IS_COMBINED_MASK;`
   *              clear:  `content &= ~Content.IS_COMBINED_MASK;`
   */
  IS_COMBINED_MASK = 0x200000,  // 1 << 21

  /**
   * bit 1..22    mask to check whether a cell contains any string data
   *              we need to check for codepoint and isCombined bits to see
   *              whether a cell contains anything
   *              read:   `isEmpty = !(content & Content.HAS_CONTENT_MASK)`
   */
  HAS_CONTENT_MASK = 0x3FFFFF,

  /**
   * bit 31       set if part of a wide character (i.e. wcwidth > 1)
   *              The HAS_CONTENT_MASK is non-zero for the 1st cell, and zero for following cells.
   */
  IS_WIDE_MASK = 0x80000000 // 1 << 31
}

export const enum Attributes {
  /**
   * bit 1..8     blue in RGB, color in P256 and P16
   */
  BLUE_MASK = 0xFF,
  BLUE_SHIFT = 0,
  PCOLOR_MASK = 0xFF,
  PCOLOR_SHIFT = 0,

  /**
   * bit 9..16    green in RGB
   */
  GREEN_MASK = 0xFF00,
  GREEN_SHIFT = 8,

  /**
   * bit 17..24   red in RGB
   */
  RED_MASK = 0xFF0000,
  RED_SHIFT = 16,

  /**
   * bit 25..26   color mode: DEFAULT (0) | P16 (1) | P256 (2) | RGB (3)
   */
  CM_MASK = 0x3000000,
  CM_DEFAULT = 0,
  CM_P16 = 0x1000000,
  CM_P256 = 0x2000000,
  CM_RGB = 0x3000000,

  /**
   * bit 1..24  RGB room
   */
  RGB_MASK = 0xFFFFFF
}

export const enum FgFlags {
  /**
   * bit 27..32
   */
  INVERSE = 0x4000000,
  BOLD = 0x8000000,
  UNDERLINE = 0x10000000,
  BLINK = 0x20000000,
  INVISIBLE = 0x40000000,
  STRIKETHROUGH = 0x80000000,
}

export const enum BgFlags {
  /**
   * bit 27..32 (upper 2 unused)
   */
  ITALIC = 0x4000000,
  DIM = 0x8000000,
  HAS_EXTENDED = 0x10000000,
  PROTECTED = 0x20000000,
  OVERLINE = 0x40000000
}

export const enum ExtFlags {
  /**
   * bit 27..29
   */
  UNDERLINE_STYLE = 0x1C000000,

  /**
   * bit 30..32
   *
   * An optional variant for the glyph, this can be used for example to offset underlines by a
   * number of pixels to create a perfect pattern.
   */
  VARIANT_OFFSET = 0xE0000000
}

export const enum UnderlineStyle {
  NONE = 0,
  SINGLE = 1,
  DOUBLE = 2,
  CURLY = 3,
  DOTTED = 4,
  DASHED = 5
}
