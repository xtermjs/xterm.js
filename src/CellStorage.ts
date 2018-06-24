/**
 * CellStorage
 * 
 * we have to support these cases:
 * - a single unicode char (1 - 0x110000) --> idx < 2**31
 * - a combined unicode string            --> idx >= 2**31
 * 
 * The data storage only jumps in for idx >= 2**31 (negative numbers),
 * which should give enough addressing space for combined unicode strings.
 * The storage itself is UTF-16 based to allow fast conversions.
 * Lower indices are real unicode codepoints.
 */
export class CellStorage {
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
   * big enough to hold a string of length `size` (must include null termination).
   * 
   * A segment is considered as free if the start index and the previous index are 0.
   * The previous index must be checked to handle the case where null termination
   * end on a segment border.
   * Since string data are written right after allocation,
   * the segment borders are not marked explicitly as taken.
   * 
   * @param size length of string data (including null termination)
   */
  private _alloc(size: number): number {
    // find a free area to hold size
    const neededSegments = (size >> 2) + ((size & 3) ? 1 : 0);
    for (let i = 4; i < this._data.length; i += 4) {
      // an empty segment contains 0 at idx and idx-1
      // we have to test for idx-1 to handle null termination at a segment border 
      if (!this._data[i] && !this._data[i - 1]) {
        // segment is free
        // check there is enough space
        const idx = i;
        for (let j = i + 4; j < neededSegments - 1; j += 4) {
          if (this._data[j] || this._data[j - 1]) {
            i = j;
            break;
          }
        }
        // we can return right away and do not mark
        // segments as taken since the class does not
        // expose uninitialized pointers
        if (idx === i) return idx;
      }
    }

    // resize storage
    let newLength = this._data.length * 2;
    if (this._data.length < size) newLength += (((size - this._data.length) >> 2) + 1) << 2;
    const data = new Uint16Array(newLength);
    for (let i = 0; i < this._data.length; ++i) data[i] = this._data[i];
    const idx = this._data.length;
    this._data = data;
    return idx;
  }
  /**
   * Free the storage pointer.
   * @param idx 
   */
  free(idx: number) {
    // noop for single chars
    if (idx > 0) return;
    idx &= 2147483647;
    // noop if already freed or illegal pointer
    if (!this._data[idx]) return;
    this._data[idx] = 0;
    // search for null termination and mark as free
    // TODO: clear only segment borders?
    while (this._data[++idx]) this._data[idx] = 0;
  }
  /**
   * Get a JS string representation for `idx`.
   * @param idx 
   */
  getString(idx: number): string {
    if (idx > 0) {
      if (idx < 65536) return String.fromCharCode(idx);
      idx -= 0x10000;
      return String.fromCharCode((idx >> 10) + 0xD800) + String.fromCharCode((idx % 0x400) + 0xDC00);
    }
    idx &= 2147483647;
    let s = '';
    do s += String.fromCharCode(this._data[idx]);
    while (this._data[++idx])
    return s;
  }
  /**
   * Insert data from a Uint16Array.
   * @param buffer 
   * @param start 
   * @param end 
   */
  setData(buffer: Uint16Array, start: number, end: number): number {
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
    const idx = this._alloc(length + 1);
    for (let i = start, j = idx; i < end; ++i, ++j) this._data[j] = buffer[i];
    this._data[idx + length] = 0;
    return idx | 2147483648;
  }
  /**
   * Insert data from a JS string.
   * @param s 
   */
  setString(s: string): number {
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
    const idx = this._alloc(s.length + 1);
    for (let i = 0, j = idx; i < s.length; ++i, ++j) this._data[j] = s.charCodeAt(i);
    this._data[idx + s.length] = 0;
    return idx | 2147483648;
  }
}
