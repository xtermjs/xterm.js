/**
 * Copyright (c) 2026 The xterm.js authors. All rights reserved.
 * @license MIT
 */

export function createCanvas(localDocument: Document | undefined, width: number, height: number): HTMLCanvasElement {
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
  return canvas;
}

