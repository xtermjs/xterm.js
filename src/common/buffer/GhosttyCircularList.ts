/**
 * Copyright (c) 2026 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import { ICircularList, IBufferLine } from 'common/Types';
import { Disposable } from 'common/Lifecycle';
import { Emitter } from 'common/Event';
import { IDeleteEvent, IInsertEvent } from 'common/CircularList';
import { GhosttyWasmBuffer } from 'common/buffer/GhosttyWasmBuffer';
import { GhosttyBufferLine } from 'common/buffer/GhosttyBufferLine';
import { CellData } from 'common/buffer/CellData';
import { BgFlags, Content } from 'common/buffer/Constants';

export class GhosttyCircularList extends Disposable implements ICircularList<IBufferLine> {
  private _startIndex: number = 0;
  private _length: number = 0;
  private _lines: GhosttyBufferLine[];

  public readonly onDeleteEmitter = this._register(new Emitter<IDeleteEvent>());
  public readonly onDelete = this.onDeleteEmitter.event;
  public readonly onInsertEmitter = this._register(new Emitter<IInsertEvent>());
  public readonly onInsert = this.onInsertEmitter.event;
  public readonly onTrimEmitter = this._register(new Emitter<number>());
  public readonly onTrim = this.onTrimEmitter.event;

  private _workCell = new CellData();

  constructor(
    private _buffer: GhosttyWasmBuffer,
    private _maxLength: number
  ) {
    super();
    this._lines = new Array<GhosttyBufferLine>(_maxLength);
    for (let i = 0; i < _maxLength; i++) {
      this._lines[i] = new GhosttyBufferLine(this._buffer, i);
    }
  }

  public get maxLength(): number {
    return this._maxLength;
  }

  public set maxLength(newMaxLength: number) {
    if (this._maxLength === newMaxLength) {
      return;
    }

    const nextLength = Math.min(newMaxLength, this.length);
    const oldLines = this._getLogicalLines(nextLength);
    const newLines = new Array<GhosttyBufferLine>(newMaxLength);
    for (let i = 0; i < newMaxLength; i++) {
      newLines[i] = new GhosttyBufferLine(this._buffer, i);
    }
    for (let i = 0; i < nextLength; i++) {
      this._buffer.copyRow(oldLines[i].row, newLines[i].row);
    }

    this._lines = newLines;
    this._maxLength = newMaxLength;
    this._startIndex = 0;
    this._length = nextLength;
  }

  public get length(): number {
    return this._length;
  }

  public set length(newLength: number) {
    this._length = newLength;
  }

  public get isFull(): boolean {
    return this._length === this._maxLength;
  }

  public get(index: number): IBufferLine | undefined {
    if (index < 0 || index >= this._length) {
      return undefined;
    }
    return this._lines[this._getCyclicIndex(index)];
  }

  public set(index: number, value: IBufferLine): void {
    if (index < 0) {
      return;
    }
    if (index >= this._length) {
      this._length = Math.min(index + 1, this._maxLength);
    }
    this._setIndex(index, value);
  }

  public push(value: IBufferLine): void {
    if (this._length === this._maxLength) {
      this._startIndex = ++this._startIndex % this._maxLength;
      this.onTrimEmitter.fire(1);
    } else {
      this._length++;
    }
    this.set(this._length - 1, value);
  }

  public recycle(): GhosttyBufferLine {
    if (!this.isFull) {
      throw new Error('recycle is only supported when buffer is full');
    }
    this._startIndex = ++this._startIndex % this._maxLength;
    this.onTrimEmitter.fire(1);
    return this._lines[this._getCyclicIndex(this._length - 1)];
  }

  public pop(): IBufferLine | undefined {
    if (this._length === 0) {
      return undefined;
    }
    const value = this._lines[this._getCyclicIndex(this._length - 1)];
    this._length--;
    return value;
  }

  public splice(start: number, deleteCount: number, ...items: IBufferLine[]): void {
    if (deleteCount === 0 && items.length === 0) {
      return;
    }

    const before = Math.max(0, Math.min(start, this._length));
    const actualDeleteCount = Math.min(deleteCount, this._length - before);

    if (actualDeleteCount) {
      for (let i = before; i < this._length - actualDeleteCount; i++) {
        const src = this.get(i + actualDeleteCount);
        if (src) {
          this._setIndex(i, src);
        }
      }
      this._length -= actualDeleteCount;
      this.onDeleteEmitter.fire({ index: before, amount: actualDeleteCount });
    }

    if (items.length) {
      for (let i = this._length - 1; i >= before; i--) {
        const src = this.get(i);
        if (src) {
          this._setIndex(i + items.length, src);
        }
      }
      for (let i = 0; i < items.length; i++) {
        this._setIndex(before + i, items[i]);
      }
      this.onInsertEmitter.fire({ index: before, amount: items.length });

      if (this._length + items.length > this._maxLength) {
        const countToTrim = this._length + items.length - this._maxLength;
        this._startIndex = (this._startIndex + countToTrim) % this._maxLength;
        this._length = this._maxLength;
        this.onTrimEmitter.fire(countToTrim);
      } else {
        this._length += items.length;
      }
    }
  }

  public trimStart(count: number): void {
    if (count <= 0) {
      return;
    }
    count = Math.min(count, this._length);
    if (count > 0) {
      this._startIndex = (this._startIndex + count) % this._maxLength;
      this._length -= count;
      this.onTrimEmitter.fire(count);
    }
  }

  public shiftElements(start: number, count: number, offset: number): void {
    if (count <= 0) {
      return;
    }
    if (start < 0 || start >= this._length) {
      throw new Error('start argument out of range');
    }
    if (start + offset < 0) {
      throw new Error('Cannot shift elements in list beyond index 0');
    }

    if (offset > 0) {
      for (let i = count - 1; i >= 0; i--) {
        const srcLine = this.get(start + i);
        if (srcLine) {
          this._setIndex(start + i + offset, srcLine);
        }
      }
      const expandListBy = (start + count + offset) - this._length;
      if (expandListBy > 0) {
        this._length += expandListBy;
        while (this._length > this._maxLength) {
          this._length--;
          this._startIndex = (this._startIndex + 1) % this._maxLength;
          this.onTrimEmitter.fire(1);
        }
      }
    } else if (offset < 0) {
      for (let i = 0; i < count; i++) {
        const srcLine = this.get(start + i);
        if (srcLine) {
          this._setIndex(start + i + offset, srcLine);
        }
      }
    }
  }

  public normalize(): void {
    if (this._startIndex === 0) {
      return;
    }
    const snapshot = this._getLogicalLines(this._length).map(line => line.clone());
    for (let i = 0; i < snapshot.length; i++) {
      this._copyInto(this._lines[i].row, snapshot[i]);
    }
    this._startIndex = 0;
  }

  private _setIndex(index: number, value: IBufferLine): void {
    const line = this._lines[this._getCyclicIndex(index)];
    this._copyInto(line.row, value);
  }

  private _getCyclicIndex(index: number): number {
    return (this._startIndex + index) % this._maxLength;
  }

  private _copyInto(rowIndex: number, value: IBufferLine): void {
    const nullContent = 1 << Content.WIDTH_SHIFT;
    if (value instanceof GhosttyBufferLine) {
      this._buffer.copyRow(value.row, rowIndex);
      return;
    }

    const colsToCopy = Math.min(this._buffer.cols, value.length);
    for (let col = 0; col < colsToCopy; col++) {
      const cell = value.loadCell(col, this._workCell);
      this._buffer.setCell(rowIndex, col, cell.content, cell.fg, cell.bg);
      if (cell.content & Content.IS_COMBINED_MASK) {
        this._buffer.setCombined(rowIndex, col, cell.combinedData);
      } else {
        this._buffer.clearCombined(rowIndex, col);
      }
      if (cell.bg & BgFlags.HAS_EXTENDED) {
        this._buffer.setExtended(rowIndex, col, cell.extended);
      } else {
        this._buffer.clearExtended(rowIndex, col);
      }
    }
    for (let col = colsToCopy; col < this._buffer.cols; col++) {
      this._buffer.setCell(rowIndex, col, nullContent, 0, 0);
      this._buffer.clearCombined(rowIndex, col);
      this._buffer.clearExtended(rowIndex, col);
    }
    this._buffer.setRowWrap(rowIndex, value.isWrapped);
  }

  private _getLogicalLines(count: number): GhosttyBufferLine[] {
    const result: GhosttyBufferLine[] = [];
    for (let i = 0; i < count; i++) {
      result.push(this._lines[this._getCyclicIndex(i)]);
    }
    return result;
  }
}
