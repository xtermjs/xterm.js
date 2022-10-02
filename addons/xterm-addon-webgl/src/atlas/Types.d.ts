/**
 * Copyright (c) 2017 The xterm.js authors. All rights reserved.
 * @license MIT
 */

export interface IGlyphIdentifier {
  chars: string;
  code: number;
  bg: number;
  fg: number;
  bold: boolean;
  dim: boolean;
  italic: boolean;
}
