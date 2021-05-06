/**
 * Copyright (c) 2021 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import { IBufferRange } from 'xterm';

export function getRangeLength(range: IBufferRange, cols: number): number {
  if (range.start.y === range.end.y) {
    return range.end.x - range.start.x + 1;
  }
  if (range.start.y > range.end.y) {
    throw new Error(`Buffer range end (${range.end.x}, ${range.end.y}) cannot be before start (${range.start.x}, ${range.start.y})`);
  }
  return cols * (range.end.y - range.start.y - 1) + cols - range.start.x + range.end.x;
}
