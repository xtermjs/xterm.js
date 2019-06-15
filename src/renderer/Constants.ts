/**
 * Copyright (c) 2017 The xterm.js authors. All rights reserved.
 * @license MIT
 */

/**
 * Flags used to render terminal text properly for the old CharData format
 */
export const enum FLAGS {
  BOLD = 1,
  UNDERLINE = 2,
  BLINK = 4,
  INVERSE = 8,
  INVISIBLE = 16,
  DIM = 32,
  ITALIC = 64
}
