/**
 * Copyright (c) 2026 The xterm.js authors. All rights reserved.
 * @license MIT
 */

/**
 * Accumulates string data from multiple chunks without O(n²) string concatenation.
 */
export class StringBuilder {
  private _chunks: string[] = [];
  private _length = 0;

  public get length(): number {
    return this._length;
  }

  public reset(): void {
    this._chunks.length = 0;
    this._length = 0;
  }

  public append(chunk: string): void {
    this._chunks.push(chunk);
    this._length += chunk.length;
  }

  public toString(): string {
    return this._chunks.join('');
  }
}

/**
 * String builder that rejects payloads larger than a fixed limit.
 */
export class LimitedStringBuilder {
  private readonly _builder = new StringBuilder();

  constructor(private readonly _limit: number) { }

  public get length(): number {
    return this._builder.length;
  }

  public get limit(): number {
    return this._limit;
  }

  public reset(): void {
    this._builder.reset();
  }

  /**
   * @returns true if the limit was exceeded (buffer is cleared in that case)
   */
  public append(chunk: string): boolean {
    this._builder.append(chunk);
    if (this._builder.length > this._limit) {
      this._builder.reset();
      return true;
    }
    return false;
  }

  public toString(): string {
    return this._builder.toString();
  }
}
