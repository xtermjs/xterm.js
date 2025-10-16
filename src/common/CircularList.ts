/**
 * Copyright (c) 2016 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import { ICircularList } from 'common/Types';
import { Disposable } from 'vs/base/common/lifecycle';
import { Emitter } from 'vs/base/common/event';

export interface IInsertEvent {
  index: number;
  amount: number;
}

export interface IDeleteEvent {
  index: number;
  amount: number;
}

/**
 * OLD: Represents a circular list; a list with a maximum size that wraps around when push is called,
 * overriding values at the start of the list.
 * NEW: This is just a renamed list structure. Should perhaps be inlined in Buffer.ts.
 */
export class CircularList<T> extends Disposable implements ICircularList<T> {
  protected _array: (T | undefined)[];
  private _startIndex: number;
  private _length: number;

  public readonly onDeleteEmitter = this._register(new Emitter<IDeleteEvent>());
  public readonly onDelete = this.onDeleteEmitter.event;
  public readonly onInsertEmitter = this._register(new Emitter<IInsertEvent>());
  public readonly onInsert = this.onInsertEmitter.event;
  public readonly onTrimEmitter = this._register(new Emitter<number>());
  public readonly onTrim = this.onTrimEmitter.event;

  constructor(
    private _maxLength: number
  ) {
    super();
    this._array = new Array<T>(this._maxLength);
    this._startIndex = 0;
    this._length = 0;
  }

  public get maxLength(): number {
    return this._maxLength;
  }
  public set maxLength(newMaxLength: number) {
    // There was no change in maxLength, return early.
    if (this._maxLength === newMaxLength) {
      return;
    }
    if (this._startIndex) {
      this._array.copyWithin(0, this._startIndex, this._startIndex + this._length);
      this._startIndex = 0;
    }
    this._array.length = this.length;
    this._maxLength = newMaxLength;
  }

  public get length(): number {
    return this._length;
  }

  public set length(newLength: number) {
    if (newLength > this._length) {
      this._array.length = this._startIndex + newLength;
    }
    this._length = newLength;
  }

  /**
   * How big to let _startIndex get befre we compactify.
   */
  private _maxStart(): number {
    return Math.max(100, this._maxLength >> 3);
  }

  /**
   * Gets the value at an index.
   *
   * Note that for performance reasons there is no bounds checking here, the index reference is
   * circular so this should always return a value and never throw.
   * @param index The index of the value to get.
   * @returns The value corresponding to the index.
   */
  public get(index: number): T | undefined {
    return this._array[index + this._startIndex];
  }

  /**
   * Sets the value at an index.
   *
   * Note that for performance reasons there is no bounds checking here, the index reference is
   * circular so this should always return a value and never throw.
   * @param index The index to set.
   * @param value The value to set.
   */
  public set(index: number, value: T | undefined): void {
    this._array[index + this._startIndex] = value;
  }

  /**
   * Pushes a new value onto the list, wrapping around to the start of the array, overriding index 0
   * if the maximum length is reached.
   * @param value The value to push onto the list.
   */
  public push(value: T): void {
    this._array[this._startIndex + this._length++] = value;
    this.trimIfNeeded();
  }

  /**
   * Ringbuffer is at max length.
   */
  public get isFull(): boolean {
    return this._length === this._maxLength;
  }

  /**
   * Removes and returns the last value on the list.
   * @returns The popped value.
   */
  public pop(): T | undefined {
    return this._array[this._length-- - 1 + this._startIndex];
  }

  /**
   * Deletes and/or inserts items at a particular index (in that order). Unlike
   * Array.prototype.splice, this operation does not return the deleted items as a new array in
   * order to save creating a new array. Note that this operation may shift all values in the list
   * in the worst case.
   * @param start The index to delete and/or insert.
   * @param deleteCount The number of elements to delete.
   * @param items The items to insert.
   */
  public spliceNoTrim(start: number, deleteCount: number, items: T[], fireEvents: boolean = true): void {
    this._array.splice(start + this._startIndex, deleteCount, ...items);
    if (fireEvents) {
      if (deleteCount) {
        this.onDeleteEmitter.fire({ index: start, amount: deleteCount });
      }
      if (items.length) {
        this.onInsertEmitter.fire({ index: start, amount: items.length });
      }
    }
    this._length += items.length - deleteCount;
  }

  public trimIfNeeded(): void {
    if (this._length > this._maxLength) {
      this.trimStart(this._length - this._maxLength);
    }
  }

  public splice(start: number, deleteCount: number, ...items: T[]): void {
    this.spliceNoTrim(start, deleteCount, items);
    // Adjust length as needed
    this.trimIfNeeded();
  }

  /**
   * Trims a number of items from the start of the list.
   * @param count The number of items to remove.
   */
  public trimStart(count: number): void {
    if (count > this._length) {
      count = this._length;
    }
    if (count === 0) {
      return;
    }
    this._startIndex += count;
    this._length -= count;
    if (this._startIndex > this._maxStart()) {
      this._array.copyWithin(0, this._startIndex, this._startIndex + this._length);
      this._startIndex = 0;
      this._array.length = this._length;
    } else {
      // May help garbage collector.
      this._array.fill(undefined, this._startIndex - count, this._startIndex);
    }
    this.onTrimEmitter.fire(count);
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
    const startIndex = start + this._startIndex;
    this._array.copyWithin(startIndex + offset, startIndex, startIndex + count);
    if (offset > 0) {
      const expandListBy = (start + count + offset) - this._length;
      if (expandListBy > 0) {
        this._length += expandListBy;
        this.trimIfNeeded();
      }
    }
  }
}
