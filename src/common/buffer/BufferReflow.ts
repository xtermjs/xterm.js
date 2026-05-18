/**
 * Copyright (c) 2019 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import { BufferLine } from 'common/buffer/BufferLine';

export interface INewLayoutResult {
  layout: number[];
  countRemoved: number;
}

export function getWrappedLineTrimmedLength(lines: BufferLine[], i: number, cols: number): number {
  // If this is the last row in the wrapped line, get the actual trimmed length
  if (i === lines.length - 1) {
    return lines[i].getTrimmedLength();
  }
  // Detect whether the following line starts with a wide character and the end of the current line
  // is null, if so then we can be pretty sure the null character should be excluded from the line
  // length]
  const endsInNull = !(lines[i].hasContent(cols - 1)) && lines[i].getWidth(cols - 1) === 1;
  const followingLineStartsWithWide = lines[i + 1].getWidth(0) === 2;
  if (endsInNull && followingLineStartsWithWide) {
    return cols - 1;
  }
  return cols;
}
