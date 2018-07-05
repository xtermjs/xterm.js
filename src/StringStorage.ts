/**
 * Copyright (c) 2018 The xterm.js authors. All rights reserved.
 * @license MIT
 */

/**
 * StringStorage - class to hold terminal cell string data.
 * 
 * The strings are represented by a 32bit slot index number `idx`
 * with the following meaning:
 *    - a single unicode codepoint (1 - 0x110000)     --> idx > 0
 *    - a pointer to a combined unicode string        --> idx < 0
 * 
 * This is a special optimization to avoid additional allocation
 * for single unicode codepoints (UTF-32). The data storage jumps in for unicode strings,
 * the address range of 2**31 - 1 should be big enough for this case.
 * The storage itself is UTF-16 based to allow fast conversions to JS strings.
 * 
 * NOTE: The content strings are saved null terminated and
 * must not contain zeros, otherwise memory will be corrupted/lost.
 */
export class StringStorage {
  private _data: Uint16Array;
  constructor(size: number) {
    if (!size || size & 3) throw new Error('size must be multiple of 4');
    this._data = new Uint16Array(size);
  }

  /**
   * Get memory to hold string data as UTF-16 char codes.
   * 
   * The allocation is done in 4 byte segments, 0 is reserved as NULL.
   * The allocator does a simple forward search for consecutive free segments
   * big enough to hold a string of length `size` (must not include null termination).
   * 
   * A segment is considered as free if the segment start index and the previous index are 0.
   * The previous index must be checked to handle the case where null termination
   * ends on a segment start.
   * Since string data are written right after allocation, the segment borders are not
   * marked explicitly as taken which saves bytes to distingish taken segments.
   * This implies always to write the string data after calling `_alloc` in the caller.
   * 
   * This allocator always tries to return a legal pointer to hold the data,
   * if not enough memory is available the underlying array will be resized
   * by power of 2 (plus additional space if the requested space is bigger than the gain).
   * 
   * Returns the positive pointer value, for outside usage as slot `idx` the value must be
   * negative (always return `idx | 2147483648` from the caller).
   * 
   * @param size length of string data (excluding null termination)
   */
  private _alloc(size: number): number {
    // add null termination
    size++;
    // find a free area to hold size
    const neededSegments = (size >> 2) + ((size & 3) ? 1 : 0);
    for (let i = 4; i < this._data.length; i += 4) {
      // an empty segment contains 0 at idx and idx-1
      // we have to test for idx-1 to handle null termination at a segment border 
      if (!this._data[i] && !this._data[i - 1]) {
        // segment is free
        const idx = i;
        // break on right overflow - need resize
        if ((neededSegments << 2) + idx > this._data.length) break;
        // check there is enough space: walk next segments
        for (let j = i + 4; j < neededSegments; j += 4) {
          if (this._data[j] || this._data[j - 1]) {
            i = j;
            break;
          }
        }
        // we can return right away
        // we also do not mark segments as taken since
        // the class does not expose uninitialized pointers
        if (idx === i) return idx;
      }
    }

    // resize storage and return first free segment (start of new memory)
    let newLength = this._data.length * 2;
    if (this._data.length < size) newLength += (((size - this._data.length) >> 2) + 1) << 2;
    const data = new Uint16Array(newLength);
    for (let i = 0; i < this._data.length; ++i) data[i] = this._data[i];
    const idx = this._data.length;
    this._data = data;
    return idx;
  }

  /**
   * Get stats of the storage.
   */
  public getStats(): any {
    let free = 0;
    for (let i = 4; i < this._data.length; i += 4) {
      if (!this._data[i] && !this._data[i - 1]) {
        free++;
      }
    }
    return {
      mem: this._data,
      size: this._data.length,
      segments: (this._data.length >> 2) - 1,
      freeSegments: free
    }
  }

  /**
   * Free slot `idx`. Also zeros the mem. NOOP for codepoints.
   * @param idx 
   */
  public free(idx: number) {
    // noop for single chars
    if (idx > 0) return;
    idx &= 2147483647;
    // noop if already freed or illegal pointer
    // previous should be zero already
    // TODO: should we test&zero previous too?
    if (!this._data[idx]) return;
    this._data[idx] = 0;
    // search for null termination and mark as free
    // TODO: clear only segment borders?
    //       --> not much to gain from this since we zero every second slot still
    while (this._data[++idx]) this._data[idx] = 0;
  }
  
  /**
   * Return `true` if slot does not need to be freed.
   * Returns always `true` for codepoints.
   * @param idx 
   */
  public isFreed(idx: number): boolean {
    if (idx < 1) {
      idx &= 2147483647;
      if (!this._data[idx] && !this._data[idx - 1]) return true;
      return false;
    }
    return true;
  }

  /**
   * Return `true` if `idx` represents a pointer.
   * @param idx 
   */
  public isPointer(idx: number): boolean {
    return idx < 1;
  }

  /**
   * Return `true` if `idx` represents a codepoint.
   * @param idx 
   */
  public isCodepoint(idx: number): boolean {
    return idx > 0;
  }

  /**
   * Get the positive value from a pointer. -1 for codepoints.
   * @param idx 
   */
  pointerValue(idx: number) {
    return (this.isPointer(idx)) ? idx & 2147483647 : -1;
  }

  /**
   * Get a JS string representation for slot `idx`.
   * @param idx 
   */
  public getString(idx: number): string {
    if (idx > 0) {
      if (idx < 65536) return String.fromCharCode(idx);
      idx -= 0x10000;
      return String.fromCharCode((idx >> 10) + 0xD800) + String.fromCharCode((idx % 0x400) + 0xDC00);
    }
    idx &= 2147483647;
    let s = '';
    while (this._data[idx]) s += String.fromCharCode(this._data[idx++]);
    return s;
  }

  /**
   * Insert data from a Uint16Array.
   * @param buffer 
   * @param start 
   * @param end 
   */
  public setData(buffer: Uint16Array, start: number, end: number): number {
    const length = end - start;
    // empty or illegal data
    if (length < 1) return 0;
    // single BMP char
    if (length === 1) return buffer[start];
    // possible high unicode char
    if (length === 2) {
      const high = buffer[start];
      const low = buffer[start + 1];
      if (0xD800 <= high && high <= 0xDBFF && 0xDC00 <= low && low <= 0xDFFF) {
        return ((high - 0xD800) * 0x400) + (low - 0xDC00) + 0x10000;
      }
    }
    // combined char data found - save in storage
    const idx = this._alloc(length);
    for (let i = start, j = idx; i < end; ++i, ++j) this._data[j] = buffer[i];
    this._data[idx + length] = 0;
    return idx | 2147483648;
  }

  /**
   * Insert data from a JS string.
   * @param s 
   */
  public setString(s: string): number {
    // empty string
    if (!s.length) return 0;
    // single BMP char
    if (s.length === 1) return s.charCodeAt(0);
    // possible high unicode char
    if (s.length === 2) {
      const high = s.charCodeAt(0);
      const low = s.charCodeAt(1);
      if (0xD800 <= high && high <= 0xDBFF && 0xDC00 <= low && low <= 0xDFFF) {
        return ((high - 0xD800) * 0x400) + (low - 0xDC00) + 0x10000;
      }
    }
    // combined char string found - save in storage
    const idx = this._alloc(s.length);
    for (let i = 0, j = idx; i < s.length; ++i, ++j) this._data[j] = s.charCodeAt(i);
    this._data[idx + s.length] = 0;
    return idx | 2147483648;
  }

  /**
   * Get the actual string length (without null termination).
   * @param idx 
   */
  public getLength(idx: number): number {
    if (idx > 0) return (idx < 65536) ? 1 : 2;
    let length = 0;
    idx &= 2147483647;
    while (this._data[idx++]) length++;
    return length;
  }

  /**
   * Make a copy of slot `idx`. NOOP for codepoints.
   * @param idx 
   */
  public copy(idx: number): number {
    if (idx > 0) return idx;
    const length = this.getLength(idx);
    const newIdx = this._alloc(length);
    let p = newIdx;
    for (let i = idx & 2147483647; this._data[i] !== 0; ++i, ++p) this._data[p] = this._data[i];
    this._data[p] = 0;
    return newIdx | 2147483648;
  }

  /**
   * Concat slot `other` to slot `idx`.
   * NOTE: The default operation tries to add `other` inplace to `idx`,
   * if there is not enough space, a new string will be allocated and the old ones are freed.
   * Set `preserveIdx` or `preserveOther` to `true` if you want to keep `idx` or `other`.
   * @param idx 
   * @param other 
   */
  public concat(idx: number, other: number, preserveIdx?: boolean, preserveOther?: boolean): number {
    const oldLength = this.getLength(idx);
    const newLength = oldLength + this.getLength(other);

    // shortcut - dont alloc if:
    //    - we dont preserve `idx` &
    //    - we have a pointer already &
    //    - there is enough room in the current segment to hold `idx` + `other`
    if (!preserveIdx && idx < 0 && (oldLength >> 2 === newLength >> 2)) {
      let p = (idx & 2147483647) + oldLength;
      if (other > 0) {
        if (other < 65536) {
          this._data[p++] = other;
        } else {
          other -= 0x10000;
          this._data[p++] = (other >> 10) + 0xD800;
          this._data[p++] = (other % 0x400) + 0xDC00;
        }
      } else {
        const end = (idx & 2147483647) + newLength;
        let other_p = other & 2147483647;
        while (p < end) this._data[p++] = this._data[other_p++];
        if (!preserveOther) this.free(other);
      }
      this._data[p] = 0;
      return idx;
    }

    // alloc new memory
    const newIdx = this._alloc(newLength);
    // current mem pointer
    let p = newIdx;

    // transfer old data
    if (idx > 0) {
      // source idx is a codepoint - write data to new mem segment
      // we save UTF-16 data, therefore we have to deconstruct higher UTF-32 values
      if (idx < 65536) {
        this._data[p++] = idx;
      } else {
        idx -= 0x10000;
        this._data[p++] = (idx >> 10) + 0xD800;
        this._data[p++] = (idx % 0x400) + 0xDC00;
      }
    } else {
      // source idx is a pointer - transfer data and free old mem
      for (let i = idx & 2147483647; this._data[i] !== 0; ++i, ++p) this._data[p] = this._data[i];
      if (!preserveIdx) this.free(idx);
    }

    // append new data
    if (other > 0) {
      if (other < 65536) {
        this._data[p++] = other;
      } else {
        other -= 0x10000;
        this._data[p++] = (other >> 10) + 0xD800;
        this._data[p++] = (other % 0x400) + 0xDC00;
      }
    } else {
      const end = newIdx + newLength;
      let other_p = other & 2147483647;
      while (p < end) this._data[p++] = this._data[other_p++];
      if (!preserveOther) this.free(other);
    }
    this._data[p] = 0;
    return newIdx | 2147483648;
  }
}
