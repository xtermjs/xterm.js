/**
 * Copyright (c) 2022 The xterm.js authors. All rights reserved.
 * @license MIT
 */

/**
 * A generic list that is maintained in sorted order and allows values with duplicate keys. This
 * list is based on binary search and as such locating a key will take O(log n) amortized, this
 * includes the by key iterator.
 */
export class SortedList<T> {
  private readonly _array: T[] = [];

  constructor(
    private readonly _getKey: (value: T) => number
  ) {
  }

  public clear(): void {
    this._array.length = 0;
  }

  public insert(value: T): void {
    if (this._array.length === 0) {
      this._array.push(value);
      return;
    }
    const i = this._search(this._getKey(value), 0, this._array.length - 1);
    this._array.splice(i, 0, value);
  }

  public delete(value: T): boolean {
    if (this._array.length === 0) {
      return false;
    }
    const key = this._getKey(value);
    let i = this._search(key, 0, this._array.length - 1);
    if (this._getKey(this._array[i]) !== key) {
      return false;
    }
    do {
      if (this._array[i] === value) {
        this._array.splice(i, 1);
        return true;
      }
    } while (++i < this._array.length && this._getKey(this._array[i]) === key);
    return false;
  }

  public *getKeyIterator(key: number): IterableIterator<T> {
    if (this._array.length === 0) {
      return;
    }
    let i = this._search(key, 0, this._array.length - 1);
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

  public values(): IterableIterator<T> {
    return this._array.values();
  }

  private _search(key: number, min: number, max: number): number {
    if (max < min) {
      return min;
    }
    let mid = Math.floor((min + max) / 2);
    if (this._getKey(this._array[mid]) > key) {
      return this._search(key, min, mid - 1);
    }
    if (this._getKey(this._array[mid]) < key) {
      return this._search(key, mid + 1, max);
    }
    // Value found! Since keys can be duplicates, move the result index back to the lowest index
    // that matches the key.
    while (mid > 0 && this._getKey(this._array[mid - 1]) === key) {
      mid--;
    }
    return mid;
  }
}
