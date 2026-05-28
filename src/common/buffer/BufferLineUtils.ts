/**
 * Copyright (c) 2026 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import { BufferLine } from 'common/buffer/BufferLine';
import { BufferOverflowLine } from 'common/buffer/BufferOverflowLine';
import { IAttributeData, IBufferLine, ICellData } from 'common/Types';
import { IBufferLineStringCache } from 'common/buffer/BufferLine';

export function getLogicalHead(line: IBufferLine): BufferLine {
  if (line instanceof BufferOverflowLine) {
    return line.head;
  }
  return line as BufferLine;
}

export function isBufferOverflowLine(line: IBufferLine): line is BufferOverflowLine {
  return line instanceof BufferOverflowLine;
}

/**
 * Returns the logical cell offset for the start of a buffer row.
 */
export function getSegmentStart(line: IBufferLine): number {
  if (line instanceof BufferOverflowLine) {
    return line.segmentStart;
  }
  return 0;
}

/**
 * Marks the row at `y` as a wrapped continuation of the logical line above.
 * Extends the logical line storage and replaces the row with a {@link BufferOverflowLine}.
 */
export function attachWrappedRow(
  lines: { get(index: number): IBufferLine | undefined; set(index: number, line: IBufferLine): void },
  y: number,
  stringCache: IBufferLineStringCache,
  cols: number,
  fillCellData: ICellData
): IBufferLine {
  const headY = y > 0 ? getWrappedRangeStart(lines, y - 1) : y;
  const head = getLogicalHead(lines.get(headY)!);
  const segmentStart = head.logicalCellCount;
  head.ensureLogicalCapacity(segmentStart + cols, fillCellData);

  const existingLine = lines.get(y);
  if (existingLine && !(existingLine instanceof BufferOverflowLine) && existingLine.getTrimmedLength() > 0) {
    head.copyCellsFrom(existingLine as BufferLine, 0, segmentStart, existingLine.length, false);
  }

  const overflowLine = new BufferOverflowLine(head, segmentStart, stringCache, cols, fillCellData);
  lines.set(y, overflowLine);
  head.registerOverflowRow();
  return overflowLine;
}

/**
 * Clears the wrapped state for a row, detaching overflow rows from their logical line.
 */
export function clearWrappedRow(
  lines: { get(index: number): IBufferLine | undefined; set(index: number, line: IBufferLine): void },
  y: number,
  fillCellData: ICellData,
  stringCache?: IBufferLineStringCache,
  cols?: number,
  preserveContent: boolean = true
): void {
  const line = lines.get(y);
  if (!line) {
    return;
  }
  if (line.isWrapped) {
    if (line instanceof BufferOverflowLine) {
      if (preserveContent) {
        lines.set(y, line.materializeToStandalone(fillCellData));
      } else if (stringCache !== undefined && cols !== undefined) {
        line.head.unregisterOverflowRow();
        lines.set(y, new BufferLine(stringCache, cols, fillCellData, false));
      } else {
        lines.set(y, line.materializeToStandalone(fillCellData));
      }
    } else if (line instanceof BufferLine) {
      (line as BufferLine).materializeFromLogicalHead(fillCellData);
    }
    return;
  }
  const head = line as BufferLine;
  head.clearOverflowRows();
}

export function getWrappedRangeStart(lines: { get(index: number): IBufferLine | undefined }, y: number): number {
  let first = y;
  while (first > 0 && lines.get(first)?.isWrapped) {
    first--;
  }
  return first;
}

export function getWrappedRangeEnd(lines: { get(index: number): IBufferLine | undefined; length: number }, y: number): number {
  let last = y;
  while (last + 1 < lines.length && lines.get(last + 1)?.isWrapped) {
    last++;
  }
  return last;
}

/**
 * Copies a logical line group into a single standalone buffer row and removes overflow rows.
 * Used before reflow so existing reflow algorithms can operate on independent lines.
 */
export function flattenLogicalGroup(
  lines: { get(index: number): IBufferLine | undefined; set(index: number, line: IBufferLine): void; length: number },
  headY: number,
  cols: number,
  fillCellData: ICellData,
  stringCache: IBufferLineStringCache
): void {
  const last = getWrappedRangeEnd(lines, headY);
  if (last <= headY) {
    return;
  }
  const head = getLogicalHead(lines.get(headY)!);
  lines.set(headY, head.toStandaloneLogicalLine(cols, fillCellData, stringCache));
  for (let i = headY + 1; i <= last; i++) {
    const line = lines.get(i);
    if (line instanceof BufferOverflowLine) {
      const standalone = line.materializeToStandalone(fillCellData);
      standalone.isWrapped = true;
      lines.set(i, standalone);
    }
  }
}

export function materializeLogicalLinesForReflow(
  lines: { get(index: number): IBufferLine | undefined; set(index: number, line: IBufferLine): void; length: number },
  cols: number,
  fillCellData: ICellData,
  stringCache: IBufferLineStringCache
): void {
  let y = 0;
  while (y < lines.length) {
    const line = lines.get(y);
    const next = lines.get(y + 1);
    if (line && next instanceof BufferOverflowLine && next.head === getLogicalHead(line)) {
      flattenLogicalGroup(lines, y, cols, fillCellData, stringCache);
      y++;
      continue;
    }
    y++;
  }
}

export function createScrollWrappedLine(
  lineAbove: IBufferLine | undefined,
  stringCache: IBufferLineStringCache,
  cols: number,
  fillCellData: ICellData,
  attr: IAttributeData
): IBufferLine {
  if (!lineAbove) {
    return new BufferLine(stringCache, cols, fillCellData, true);
  }
  const head = getLogicalHead(lineAbove);
  const segmentStart = head.logicalCellCount;
  head.ensureLogicalCapacity(segmentStart + cols, fillCellData);
  const overflowLine = new BufferOverflowLine(head, segmentStart, stringCache, cols, fillCellData);
  head.registerOverflowRow();
  return overflowLine;
}
