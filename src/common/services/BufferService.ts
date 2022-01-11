/**
 * Copyright (c) 2019 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import { IBufferService, IOptionsService } from 'common/services/Services';
import { BufferSet } from 'common/buffer/BufferSet';
import { IBufferSet, IBuffer } from 'common/buffer/Types';
import { EventEmitter, IEvent } from 'common/EventEmitter';
import { Disposable } from 'common/Lifecycle';
import { IAttributeData, IBufferLine, ScrollSource } from 'common/Types';

export const MINIMUM_COLS = 2; // Less than 2 can mess with wide chars
export const MINIMUM_ROWS = 1;

export class BufferService extends Disposable implements IBufferService {
  public serviceBrand: any;

  public cols: number;
  public rows: number;
  public buffers: IBufferSet;
  /** Whether the user is scrolling (locks the scroll position) */
  public isUserScrolling: boolean = false;

  private _onResize = new EventEmitter<{ cols: number, rows: number }>();
  public get onResize(): IEvent<{ cols: number, rows: number }> { return this._onResize.event; }
  private _onScroll = new EventEmitter<number>();
  public get onScroll(): IEvent<number> { return this._onScroll.event; }

  public get buffer(): IBuffer { return this.buffers.active; }

  /** An IBufferline to clone/copy from for new blank lines */
  private _cachedBlankLine: IBufferLine | undefined;

  constructor(
    @IOptionsService private _optionsService: IOptionsService
  ) {
    super();
    this.cols = Math.max(_optionsService.rawOptions.cols || 0, MINIMUM_COLS);
    this.rows = Math.max(_optionsService.rawOptions.rows || 0, MINIMUM_ROWS);
    this.buffers = new BufferSet(_optionsService, this);
  }

  public dispose(): void {
    super.dispose();
    this.buffers.dispose();
  }

  public resize(cols: number, rows: number): void {
    this.cols = cols;
    this.rows = rows;
    this.buffers.resize(cols, rows);
    this.buffers.setupTabStops(this.cols);
    this._onResize.fire({ cols, rows });
  }

  public reset(): void {
    this.buffers.reset();
    this.isUserScrolling = false;
  }

  /**
   * Scroll the terminal down 1 row, creating a blank line.
   * @param isWrapped Whether the new line is wrapped from the previous line.
   */
  public scroll(eraseAttr: IAttributeData, isWrapped: boolean = false): void {
    const buffer = this.buffer;

    let newLine: IBufferLine | undefined;
    newLine = this._cachedBlankLine;
    if (!newLine || newLine.length !== this.cols || newLine.getFg(0) !== eraseAttr.fg || newLine.getBg(0) !== eraseAttr.bg) {
      newLine = buffer.getBlankLine(eraseAttr, isWrapped);
      this._cachedBlankLine = newLine;
    }
    newLine.isWrapped = isWrapped;

    const topRow = buffer.ybase + buffer.scrollTop;
    const bottomRow = buffer.ybase + buffer.scrollBottom;

    if (buffer.scrollTop === 0) {
      // Determine whether the buffer is going to be trimmed after insertion.
      const willBufferBeTrimmed = buffer.lines.isFull;

      // Insert the line using the fastest method
      if (bottomRow === buffer.lines.length - 1) {
        if (willBufferBeTrimmed) {
          buffer.lines.recycle().copyFrom(newLine);
        } else {
          buffer.lines.push(newLine.clone());
        }
      } else {
        buffer.lines.splice(bottomRow + 1, 0, newLine.clone());
      }

      // Only adjust ybase and ydisp when the buffer is not trimmed
      if (!willBufferBeTrimmed) {
        buffer.ybase++;
        // Only scroll the ydisp with ybase if the user has not scrolled up
        if (!this.isUserScrolling) {
          buffer.ydisp++;
        }
      } else {
        // When the buffer is full and the user has scrolled up, keep the text
        // stable unless ydisp is right at the top
        if (this.isUserScrolling) {
          buffer.ydisp = Math.max(buffer.ydisp - 1, 0);
        }
      }
    } else {
      // scrollTop is non-zero which means no line will be going to the
      // scrollback, instead we can just shift them in-place.
      const scrollRegionHeight = bottomRow - topRow + 1 /* as it's zero-based */;
      buffer.lines.shiftElements(topRow + 1, scrollRegionHeight - 1, -1);
      buffer.lines.set(bottomRow, newLine.clone());
    }

    // Move the viewport to the bottom of the buffer unless the user is
    // scrolling.
    if (!this.isUserScrolling) {
      buffer.ydisp = buffer.ybase;
    }

    this._onScroll.fire(buffer.ydisp);
  }

  /**
   * Scroll the display of the terminal
   * @param disp The number of lines to scroll down (negative scroll up).
   * @param suppressScrollEvent Don't emit the scroll event as scrollLines. This is used
   * to avoid unwanted events being handled by the viewport when the event was triggered from the
   * viewport originally.
   */
  public scrollLines(disp: number, suppressScrollEvent?: boolean, source?: ScrollSource): void {
    const buffer = this.buffer;
    if (disp < 0) {
      if (buffer.ydisp === 0) {
        return;
      }
      this.isUserScrolling = true;
    } else if (disp + buffer.ydisp >= buffer.ybase) {
      this.isUserScrolling = false;
    }

    const oldYdisp = buffer.ydisp;
    buffer.ydisp = Math.max(Math.min(buffer.ydisp + disp, buffer.ybase), 0);

    // No change occurred, don't trigger scroll/refresh
    if (oldYdisp === buffer.ydisp) {
      return;
    }

    if (!suppressScrollEvent) {
      this._onScroll.fire(buffer.ydisp);
    }
  }

  /**
   * Scroll the display of the terminal by a number of pages.
   * @param pageCount The number of pages to scroll (negative scrolls up).
   */
  public scrollPages(pageCount: number): void {
    this.scrollLines(pageCount * (this.rows - 1));
  }

  /**
   * Scrolls the display of the terminal to the top.
   */
  public scrollToTop(): void {
    this.scrollLines(-this.buffer.ydisp);
  }

  /**
   * Scrolls the display of the terminal to the bottom.
   */
  public scrollToBottom(): void {
    this.scrollLines(this.buffer.ybase - this.buffer.ydisp);
  }

  public scrollToLine(line: number): void {
    const scrollAmount = line - this.buffer.ydisp;
    if (scrollAmount !== 0) {
      this.scrollLines(scrollAmount);
    }
  }
}
