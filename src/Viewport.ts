/**
 * Copyright (c) 2016 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import { IColorSet } from './renderer/Types';
import { ITerminal, IViewport } from './Types';
import { CharMeasure } from './utils/CharMeasure';

const FALLBACK_SCROLL_BAR_WIDTH = 15;

/**
 * Represents the viewport of a terminal, the visible area within the larger buffer of output.
 * Logic for the virtual scroll bar is included in this object.
 */
export class Viewport implements IViewport {
  public scrollBarWidth: number = 0;
  private _currentRowHeight: number = 0;
  private _lastRecordedBufferLength: number = 0;
  private _lastRecordedViewportHeight: number = 0;
  private _lastRecordedBufferHeight: number = 0;
  private _lastTouchY: number;

  /**
   * Creates a new Viewport.
   * @param _terminal The terminal this viewport belongs to.
   * @param _viewportElement The DOM element acting as the viewport.
   * @param _scrollArea The DOM element acting as the scroll area.
   * @param _charMeasure A DOM element used to measure the character size of. the terminal.
   */
  constructor(
    private _terminal: ITerminal,
    private _viewportElement: HTMLElement,
    private _scrollArea: HTMLElement,
    private _charMeasure: CharMeasure
  ) {
    // Measure the width of the scrollbar. If it is 0 we can assume it's an OSX overlay scrollbar.
    // Unfortunately the overlay scrollbar would be hidden underneath the screen element in that case,
    // therefore we account for a standard amount to make it visible
    this.scrollBarWidth = (this._viewportElement.offsetWidth - this._scrollArea.offsetWidth) || FALLBACK_SCROLL_BAR_WIDTH;
    this._viewportElement.addEventListener('scroll', this._onScroll.bind(this));

    // Perform this async to ensure the CharMeasure is ready.
    setTimeout(() => this.syncScrollArea(), 0);
  }

  public onThemeChanged(colors: IColorSet): void {
    this._viewportElement.style.backgroundColor = colors.background;
  }

  /**
   * Refreshes row height, setting line-height, viewport height and scroll area height if
   * necessary.
   */
  private _refresh(): void {
    if (this._charMeasure.height > 0) {
      this._currentRowHeight = this._terminal.renderer.dimensions.scaledCellHeight / window.devicePixelRatio;
      this._lastRecordedViewportHeight = this._viewportElement.offsetHeight;
      const newBufferHeight = Math.round(this._currentRowHeight * this._lastRecordedBufferLength) + (this._lastRecordedViewportHeight - this._terminal.renderer.dimensions.canvasHeight);
      if (this._lastRecordedBufferHeight !== newBufferHeight) {
        this._lastRecordedBufferHeight = newBufferHeight;
        this._scrollArea.style.height = this._lastRecordedBufferHeight + 'px';
      }
    }
  }

  /**
   * Updates dimensions and synchronizes the scroll area if necessary.
   */
  public syncScrollArea(): void {
    if (this._lastRecordedBufferLength !== this._terminal.buffer.lines.length) {
      // If buffer height changed
      this._lastRecordedBufferLength = this._terminal.buffer.lines.length;
      this._refresh();
    } else if (this._lastRecordedViewportHeight !== (<any>this._terminal).renderer.dimensions.canvasHeight) {
      // If viewport height changed
      this._refresh();
    } else {
      // If size has changed, refresh viewport
      if (this._terminal.renderer.dimensions.scaledCellHeight / window.devicePixelRatio !== this._currentRowHeight) {
        this._refresh();
      }
    }

    // Sync scrollTop
    const scrollTop = this._terminal.buffer.ydisp * this._currentRowHeight;
    if (this._viewportElement.scrollTop !== scrollTop) {
      this._viewportElement.scrollTop = scrollTop;
    }
  }

  /**
   * Handles scroll events on the viewport, calculating the new viewport and requesting the
   * terminal to scroll to it.
   * @param ev The scroll event.
   */
  private _onScroll(ev: Event): void {
    // Don't attempt to scroll if the element is not visible, otherwise scrollTop will be corrupt
    // which causes the terminal to scroll the buffer to the top
    if (!this._viewportElement.offsetParent) {
      return;
    }

    const newRow = Math.round(this._viewportElement.scrollTop / this._currentRowHeight);
    const diff = newRow - this._terminal.buffer.ydisp;
    this._terminal.scrollLines(diff, true);
  }

  /**
   * Handles mouse wheel events by adjusting the viewport's scrollTop and delegating the actual
   * scrolling to `onScroll`, this event needs to be attached manually by the consumer of
   * `Viewport`.
   * @param ev The mouse wheel event.
   */
  public onWheel(ev: WheelEvent): void {
    if (ev.deltaY === 0) {
      // Do nothing if it's not a vertical scroll event
      return;
    }
    // Fallback to WheelEvent.DOM_DELTA_PIXEL
    let multiplier = 1;
    if (ev.deltaMode === WheelEvent.DOM_DELTA_LINE) {
      multiplier = this._currentRowHeight;
    } else if (ev.deltaMode === WheelEvent.DOM_DELTA_PAGE) {
      multiplier = this._currentRowHeight * this._terminal.rows;
    }
    this._viewportElement.scrollTop += ev.deltaY * multiplier;
    // Prevent the page from scrolling when the terminal scrolls
    ev.preventDefault();
  }

  /**
   * Handles the touchstart event, recording the touch occurred.
   * @param ev The touch event.
   */
  public onTouchStart(ev: TouchEvent): void {
    this._lastTouchY = ev.touches[0].pageY;
  }

  /**
   * Handles the touchmove event, scrolling the viewport if the position shifted.
   * @param ev The touch event.
   */
  public onTouchMove(ev: TouchEvent): void {
    let deltaY = this._lastTouchY - ev.touches[0].pageY;
    this._lastTouchY = ev.touches[0].pageY;
    if (deltaY === 0) {
      return;
    }
    this._viewportElement.scrollTop += deltaY;
    ev.preventDefault();
  }
}
