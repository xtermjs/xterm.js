/**
 * Copyright (c) 2022 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import { IdleTaskQueue } from 'common/TaskQueue';

// Work variables to avoid garbage collection.
let i = 0;

/**
 * A generic list that is maintained in sorted order and allows values with duplicate keys. This
 * list is based on binary search and as such locating a key will take O(log n) amortized, this
 * includes the by key iterator.
 */
export class SortedList<T> {
  private _array: T[] = [];

  private readonly _insertedValues: Set<T> = new Set();
  private readonly _flushInsertedTask = new IdleTaskQueue();
  private _isFlushingInserted = false;

  private readonly _deletedIndices: Set<number> = new Set();
  private readonly _flushDeletedTask = new IdleTaskQueue();
  private _isflushingDeleted = false;

  constructor(
    private readonly _getKey: (value: T) => number
  ) {
  }

  public clear(): void {
    this._array.length = 0;
    this._deletedIndices.clear();
    this._flushDeletedTask.clear();
    this._isflushingDeleted = false;
  }

  public insert(value: T): void {
    this._flushCleanupDeleted();
    if (this._insertedValues.size === 0) {
      this._flushInsertedTask.enqueue(() => this._flushInserted());
    }
    this._insertedValues.add(value);
  }

  private _flushInserted(): void {
    const sortedAddedValues = Array.from(this._insertedValues).sort((a, b) => this._getKey(a) - this._getKey(b));
    let sortedAddedValuesIndex = 0;
    let arrayIndex = 0;

    const newArray = new Array(this._array.length + this._insertedValues.size);

    for (let newArrayIndex = 0; newArrayIndex < newArray.length; newArrayIndex++) {
      if (arrayIndex >= this._array.length || this._getKey(sortedAddedValues[sortedAddedValuesIndex]) === this._getKey(this._array[arrayIndex])) {
        newArray[newArrayIndex] = sortedAddedValues[sortedAddedValuesIndex];
        sortedAddedValuesIndex++;
      } else {
        newArray[newArrayIndex] = this._array[arrayIndex++];
      }
    }

    this._array = newArray;
    this._insertedValues.clear();
  }

  private _flushCleanupInserted(): void {
    if (!this._isFlushingInserted) {
      this._flushInsertedTask.flush();
    }
  }

  public delete(value: T): boolean {
    this._flushCleanupInserted();
    if (this._array.length === 0) {
      return false;
    }
    const key = this._getKey(value);
    if (key === undefined) {
      return false;
    }
    i = this._search(key);
    if (i === -1) {
      return false;
    }
    if (this._getKey(this._array[i]) !== key) {
      return false;
    }
    do {
      if (this._array[i] === value) {
        if (this._deletedIndices.size === 0) {
          this._flushDeletedTask.enqueue(() => this._flushDeleted());
        }
        this._deletedIndices.add(i);
        return true;
      }
    } while (++i < this._array.length && this._getKey(this._array[i]) === key);
    return false;
  }

  private _flushDeleted(): void {
    this._isflushingDeleted = true;
    const sortedDeletedIndices = Array.from(this._deletedIndices).sort((a, b) => a - b);
    let sortedDeletedIndicesIndex = 0;
    const newArray = new Array(this._array.length - sortedDeletedIndices.length);
    let newArrayIndex = 0;
    for (let i = 0; i < this._array.length; i++) {
      if (sortedDeletedIndices[sortedDeletedIndicesIndex] === i) {
        sortedDeletedIndicesIndex++;
      } else {
        newArray[newArrayIndex++] = this._array[i];
      }
    }
    this._array = newArray;
    this._deletedIndices.clear();
    this._isflushingDeleted = false;
  }

  private _flushCleanupDeleted(): void {
    if (!this._isflushingDeleted) {
      this._flushDeletedTask.flush();
    }
  }

  public *getKeyIterator(key: number): IterableIterator<T> {
    this._flushCleanupInserted();
    this._flushCleanupDeleted();
    if (this._array.length === 0) {
      return;
    }
    i = this._search(key);
    if (i < 0 || i >= this._array.length) {
      return;
    }
    if (this._getKey(this._array[i]) !== key) {
      return;
    }
    do {
      yield this._array[i];
    } while (++i < this._array.length && this._getKey(this._array[i]) === key);
  }

  public forEachByKey(key: number, callback: (value: T) => void): void {
    this._flushCleanupInserted();
    this._flushCleanupDeleted();
    if (this._array.length === 0) {
      return;
    }
    i = this._search(key);
    if (i < 0 || i >= this._array.length) {
      return;
    }
    if (this._getKey(this._array[i]) !== key) {
      return;
    }
    do {
      callback(this._array[i]);
    } while (++i < this._array.length && this._getKey(this._array[i]) === key);
  }

  public values(): IterableIterator<T> {
    this._flushCleanupInserted();
    this._flushCleanupDeleted();
    // Duplicate the array to avoid issues when _array changes while iterating
    return [...this._array].values();
  }

  private _search(key: number): number {
    let min = 0;
    let max = this._array.length - 1;
    while (max >= min) {
      let mid = (min + max) >> 1;
      const midKey = this._getKey(this._array[mid]);
      if (midKey > key) {
        max = mid - 1;
      } else if (midKey < key) {
        min = mid + 1;
      } else {
        // key in list, walk to lowest duplicate
        while (mid > 0 && this._getKey(this._array[mid - 1]) === key) {
          mid--;
        }
        return mid;
      }
    }
    // key not in list
    // still return closest min (also used as insert position)
    return min;
  }
}
