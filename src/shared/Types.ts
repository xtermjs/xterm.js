/**
 * Copyright (c) 2017 The xterm.js authors. All rights reserved.
 * @license MIT
 */

export interface IColor {
  css: string;
  rgba: number; // 32-bit int with rgba in each byte
}

export interface IColorSet {
  foreground: IColor;
  background: IColor;
  cursor: IColor;
  cursorAccent: IColor;
  selection: IColor;
  ansi: IColor[];
}
