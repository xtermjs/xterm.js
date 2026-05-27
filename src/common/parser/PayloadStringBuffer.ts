/**
 * Copyright (c) 2026 The xterm.js authors. All rights reserved.
 * @license MIT
 */

/**
 * Accumulates string payloads from multiple chunks without O(n²) string concatenation.
 */
export class PayloadStringBuffer {
  private _chunks: string[] = [];
  private _length = 0;

  public reset(): void {
    this._chunks.length = 0;
    this._length = 0;
  }

  /**
   * @returns true if the payload limit was exceeded (buffer is cleared in that case)
   */
  public add(chunk: string, limit: number): boolean {
    this._chunks.push(chunk);
    this._length += chunk.length;
    if (this._length > limit) {
      this.reset();
      return true;
    }
    return false;
  }

  public toString(): string {
    return this._chunks.join('');
  }
}
