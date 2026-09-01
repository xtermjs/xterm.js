/**
 * Copyright (c) 2026 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import { IDrawable } from './Types';

export function createCanvas(
  localDocument: Document | undefined,
  width: number,
  height: number,
  cssWidth?: number,
  cssHeight?: number
): HTMLCanvasElement {
  /**
   * NOTE: We normally dont care, from which document the canvas
   * gets created, so we can fall back to global document,
   * if the terminal has no document associated yet.
   * This way early image loads before calling .open keep working
   * (still discouraged though, as the metrics will be screwed up).
   * Only the DOM output canvas should be on the terminal's document,
   * which gets explicitly checked in `insertLayerToDom`.
   */
  const canvas = (localDocument ?? document).createElement('canvas');
  canvas.width = width | 0;
  canvas.height = height | 0;
  canvas.style.width = `${(cssWidth ?? width) | 0}px`;
  canvas.style.height = `${(cssHeight ?? height) | 0}px`;
  return canvas;
}


/**
 * Drawable is a resource the ImageRenderer knows to draw on the screen.
 */
export class Drawable implements IDrawable {
  public readonly width: number;
  public readonly height: number;
  // @readonly: only for memory tracking
  public bytes: number;

  constructor(public native: ImageBitmap | VideoFrame | HTMLCanvasElement) {
    if (native instanceof VideoFrame) {
      this.width = native.displayWidth;
      this.height = native.displayHeight;
      // NOTE: native.allocationSize() is too expensive
      this.bytes = native.codedWidth * native.codedHeight * 4;
    } else {
      this.width = native.width;
      this.height = native.height;
      this.bytes = native.width * native.height * 4;
    }
  }

  public close(): void {
    if (this.bytes === 0) return;
    this.bytes = 0;
    try {
      if (this.native instanceof HTMLCanvasElement) {
        this.native.width = 0;
        this.native.height = 0;
      } else {
        this.native.close?.();
      }
    } catch {}
    this.native = null!;
  }
}
