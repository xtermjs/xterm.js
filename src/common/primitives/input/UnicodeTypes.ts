/**
 * Copyright (c) 2019 The xterm.js authors. All rights reserved.
 * @license MIT
 */

/*
 * Width and Grapheme_Cluster_Break properties of a character as a bit mask.
 *
 * bit 0: shouldJoin - should combine with preceding character.
 * bit 1..2: wcwidth - see UnicodeCharWidth.
 * bit 3..31: class of character (currently only 4 bits are used).
 */
export type UnicodeCharProperties = number;

/**
 * Width in columns of a character.
 */
export type UnicodeCharWidth = 0 | 1 | 2;

export interface IUnicodeVersionProvider {
  readonly version: string;
  wcwidth(ucs: number): UnicodeCharWidth;
  charProperties(codepoint: number, preceding: UnicodeCharProperties): UnicodeCharProperties;
}
