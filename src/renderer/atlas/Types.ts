/**
 * Copyright (c) 2017 The xterm.js authors. All rights reserved.
 * @license MIT
 */

export const INVERTED_DEFAULT_COLOR = -1;
export const DIM_OPACITY = 0.5;

export interface IGlyphIdentifier {
  chars: string;
  code: number;
  bg: number;
  fg: number;
  bold: boolean;
  dim: boolean;
  italic: boolean;
}
