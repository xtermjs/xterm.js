/**
 * Copyright (c) 2018 The xterm.js authors. All rights reserved.
 * @license MIT
 */

export interface IColor {
  readonly css: string;
  readonly rgba: number; // 32-bit int with rgba in each byte
}

export type IColorRGB = [red: number, green: number, blue: number];
