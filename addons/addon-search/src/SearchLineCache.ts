/**
 * Copyright (c) 2017 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import type { Terminal } from '@xterm/xterm';
import { combinedDisposable, Disposable, MutableDisposable, toDisposable } from 'vs/base/common/lifecycle';
import { disposableTimeout } from 'vs/base/common/async';

export type LineCacheEntry = [
  /**
   * The string representation of a line (as opposed to the buffer cell representation).
   */
  lineAsString: string,
  /**
   * The offsets where each line starts when the entry describes a wrapped line.
   */
  lineOffsets: number[]
];

/**
 * Configuration constants for the search line cache functionality.
 */
const enum Constants {
  /**
   * Time-to-live for cached search results in milliseconds. After this duration, cached search
   * results will be invalidated to ensure they remain consistent with terminal content changes.
   */
  LINES_CACHE_TIME_TO_LIVE = 15000
}

export class SearchLineCache extends Disposable {
  /**
   * translateBufferLineToStringWithWrap is a fairly expensive call.
   * We memoize the calls into an array that has a time based ttl.
   * _linesCache is also invalidated when the terminal cursor moves.
   */
  private _linesCache: LineCacheEntry[] | undefined;
  private _linesCacheTimeout = this._register(new MutableDisposable());
  private _linesCacheDisposables = this._register(new MutableDisposable());

  constructor(private readonly _terminal: Terminal) {
    super();
    this._register(toDisposable(() => this._destroyLinesCache()));
  }

  /**
   * Sets up a line cache with a ttl
   */
  public initLinesCache(): void {
    if (!this._linesCache) {
      this._linesCache = new Array(this._terminal.buffer.active.length);
      this._linesCacheDisposables.value = combinedDisposable(
        this._terminal.onLineFeed(() => this._destroyLinesCache()),
        this._terminal.onCursorMove(() => this._destroyLinesCache()),
        this._terminal.onResize(() => this._destroyLinesCache())
      );
    }

    this._linesCacheTimeout.value = disposableTimeout(() => this._destroyLinesCache(), Constants.LINES_CACHE_TIME_TO_LIVE);
  }

  private _destroyLinesCache(): void {
    this._linesCache = undefined;
    this._linesCacheDisposables.clear();
    this._linesCacheTimeout.clear();
  }

  public getLineFromCache(row: number): LineCacheEntry | undefined {
    return this._linesCache?.[row];
  }

  public setLineInCache(row: number, entry: LineCacheEntry): void {
    if (this._linesCache) {
      this._linesCache[row] = entry;
    }
  }

  /**
   * Translates a buffer line to a string, including subsequent lines if they are wraps.
   * Wide characters will count as two columns in the resulting string. This
   * function is useful for getting the actual text underneath the raw selection
   * position.
   * @param lineIndex The index of the line being translated.
   * @param trimRight Whether to trim whitespace to the right.
   */
  public translateBufferLineToStringWithWrap(lineIndex: number, trimRight: boolean): LineCacheEntry {
    const strings = [];
    const lineOffsets = [0];
    let line = this._terminal.buffer.active.getLine(lineIndex);
    while (line) {
      const nextLine = this._terminal.buffer.active.getLine(lineIndex + 1);
      const lineWrapsToNext = nextLine ? nextLine.isWrapped : false;
      let string = line.translateToString(!lineWrapsToNext && trimRight);
      if (lineWrapsToNext && nextLine) {
        const lastCell = line.getCell(line.length - 1);
        const lastCellIsNull = lastCell && lastCell.getCode() === 0 && lastCell.getWidth() === 1;
        // a wide character wrapped to the next line
        if (lastCellIsNull && nextLine.getCell(0)?.getWidth() === 2) {
          string = string.slice(0, -1);
        }
      }
      strings.push(string);
      if (lineWrapsToNext) {
        lineOffsets.push(lineOffsets[lineOffsets.length - 1] + string.length);
      } else {
        break;
      }
      lineIndex++;
      line = nextLine;
    }
    return [strings.join(''), lineOffsets];
  }
}
