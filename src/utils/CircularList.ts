/**
 * xterm.js: xterm, in the browser
 * Copyright (c) 2016, SourceLair Private Company <www.sourcelair.com> (MIT License)
 */

/**
 * Represents a circular list; a list with a maximum size that wraps around when push is called,
 * overriding values at the start of the list.
 */
export class CircularList<T> {
  private _array: T[];
  private _startIndex: number;
  private _length: number;

  constructor(maxLength: number) {
    this._array = new Array<T>(maxLength);
    this._startIndex = 0;
    this._length = 0;
  }

  public get maxLength(): number {
    return this._array.length;
  }

  public set maxLength(newMaxLength: number) {
    // Reconstruct array, starting at index 0. Only transfer values from the
    // indexes 0 to length.
    let newArray = new Array<T>(newMaxLength);
    for (let i = 0; i < Math.min(newMaxLength, this.length); i++) {
      newArray[i] = this._array[this._getCyclicIndex(i)];
    }
    this._array = newArray;
    this._startIndex = 0;
  }

  public get length(): number {
    return this._length;
  }

  public set length(newLength: number) {
    // TODO: Is this auto fill is needed or can it be
    if (newLength > this._length) {
      for (let i = this._length; i < newLength; i++) {
        this._array[i] = undefined;
      }
    }
    this._length = newLength;
  }

  public get forEach(): (callbackfn: (value: T, index: number, array: T[]) => void) => void {
    return this._array.forEach;
  }

  /**
   * Gets the value at an index.
   *
   * Note that for performance reasons there is no bounds checking here, the index reference is
   * circular so this should always return a value and never throw.
   * @param index The index of the value to get.
   * @return The value corresponding to the index.
   */
  public get(index: number): T {
    return this._array[this._getCyclicIndex(index)];
  }

  /**
   * Sets the value at an index.
   *
   * Note that for performance reasons there is no bounds checking here, the index reference is
   * circular so this should always return a value and never throw.
   * @param index The index to set.
   * @param value The value to set.
   */
  public set(index: number, value: T): void {
    this._array[this._getCyclicIndex(index)] = value;
  }

  /**
   * Pushes a new value onto the list, wrapping around to the start of the array, overriding index 0
   * if the maximum length is reached.
   * @param value The value to push onto the list.
   */
  public push(value: T): void {
    this._array[this._getCyclicIndex(this._length)] = value;
    if (this._length === this.maxLength) {
      this._startIndex++;
    } else {
      this._length++;
    }
  }

  public pop(): T {
    return this._array[this._getCyclicIndex(this._length-- - 1)];
  }

  public removeItemsFromStart(amount: number): void {
    this._startIndex += this._length -amount;
    this._length = amount;
  }

  // TODO: Warn there's no error handling and that this is a slow operation
  public splice(start: number, deleteCount: number, ...items: T[]) {
    if (deleteCount) {
      for (let i = start; i < this._length - deleteCount; i++) {
        this._array[this._getCyclicIndex(i)] = this._array[this._getCyclicIndex(i + deleteCount)];
      }
      this._length -= deleteCount;
    }
    if (items && items.length) {
      for (let i = this._length - 1; i >= start; i--) {
        this._array[this._getCyclicIndex(i + items.length)] = this._array[this._getCyclicIndex(i)];
      }
      for (let i = 0; i < items.length; i++) {
        this._array[this._getCyclicIndex(start + i)] = items[i];
      }

      if (this._length + items.length > this.maxLength) {
        this._startIndex += (this._length + items.length) - this.maxLength;
        this._length = this.maxLength;
      } else {
        this._length += items.length;
      }
    }
  }

  private _getCyclicIndex(index: number): number {
    return (this._startIndex + index) % this.maxLength;
  }
}
