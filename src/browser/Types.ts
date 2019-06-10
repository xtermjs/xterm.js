/**
 * Copyright (c) 2017 The xterm.js authors. All rights reserved.
 * @license MIT
 */

export interface IColorManager {
  colors: IColorSet;
}

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

export interface IMouseHelper {
  getCoords(event: { clientX: number, clientY: number }, element: HTMLElement, colCount: number, rowCount: number, isSelection?: boolean): [number, number] | undefined;
  getRawByteCoords(event: MouseEvent, element: HTMLElement, colCount: number, rowCount: number): { x: number | undefined, y: number | undefined };
}
