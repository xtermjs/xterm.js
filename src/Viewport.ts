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
  private currentRowHeight: number = 0;
  private lastRecordedBufferLength: number = 0;
  private lastRecordedViewportHeight: number = 0;
  private lastRecordedBufferHeight: number = 0;
  private lastTouchY: number;

  /**
   * Creates a new Viewport.
   * @param terminal The terminal this viewport belongs to.
   * @param viewportElement The DOM element acting as the viewport.
   * @param scrollArea The DOM element acting as the scroll area.
   * @param charMeasure A DOM element used to measure the character size of. the terminal.
   */
  constructor(
    private terminal: ITerminal,
    private viewportElement: HTMLElement,
    private scrollArea: HTMLElement,
    private charMeasure: CharMeasure
  ) {
    // Measure the width of the scrollbar. If it is 0 we can assume it's an OSX overlay scrollbar.
    // Unfortunately the overlay scrollbar would be hidden underneath the screen element in that case,
    // therefore we account for a standard amount to make it visible
    this.scrollBarWidth = (this.viewportElement.offsetWidth - this.scrollArea.offsetWidth) || FALLBACK_SCROLL_BAR_WIDTH;
    this.viewportElement.addEventListener('scroll', this.onScroll.bind(this));

    // Perform this async to ensure the CharMeasure is ready.
    setTimeout(() => this.syncScrollArea(), 0);
  }

  public onThemeChanged(colors: IColorSet): void {
    this.viewportElement.style.backgroundColor = colors.background;
  }

  /**
   * Refreshes row height, setting line-height, viewport height and scroll area height if
   * necessary.
   */
  private refresh(): void {
    if (this.charMeasure.height > 0) {
      this.currentRowHeight = this.terminal.renderer.dimensions.scaledCellHeight / window.devicePixelRatio;
      this.lastRecordedViewportHeight = this.viewportElement.offsetHeight;
      const newBufferHeight = Math.round(this.currentRowHeight * this.lastRecordedBufferLength) + (this.lastRecordedViewportHeight - this.terminal.renderer.dimensions.canvasHeight);
      if (this.lastRecordedBufferHeight !== newBufferHeight) {
        this.lastRecordedBufferHeight = newBufferHeight;
        this.scrollArea.style.height = this.lastRecordedBufferHeight + 'px';
      }
    }
  }

  /**
   * Updates dimensions and synchronizes the scroll area if necessary.
   */
  public syncScrollArea(): void {
    if (this.lastRecordedBufferLength !== this.terminal.buffer.lines.length) {
      // If buffer height changed
      this.lastRecordedBufferLength = this.terminal.buffer.lines.length;
      this.refresh();
    } else if (this.lastRecordedViewportHeight !== (<any>this.terminal).renderer.dimensions.canvasHeight) {
      // If viewport height changed
      this.refresh();
    } else {
      // If size has changed, refresh viewport
      if (this.terminal.renderer.dimensions.scaledCellHeight / window.devicePixelRatio !== this.currentRowHeight) {
        this.refresh();
      }
    }

    // Sync scrollTop
    const scrollTop = this.terminal.buffer.ydisp * this.currentRowHeight;
    if (this.viewportElement.scrollTop !== scrollTop) {
      this.viewportElement.scrollTop = scrollTop;
    }
  }

  /**
   * Handles scroll events on the viewport, calculating the new viewport and requesting the
   * terminal to scroll to it.
   * @param ev The scroll event.
   */
  private onScroll(ev: Event): void {
    // Don't attempt to scroll if the element is not visible, otherwise scrollTop will be corrupt
    // which causes the terminal to scroll the buffer to the top
    if (!this.viewportElement.offsetParent) {
      return;
    }

    const newRow = Math.round(this.viewportElement.scrollTop / this.currentRowHeight);
    const diff = newRow - this.terminal.buffer.ydisp;
    this.terminal.scrollLines(diff, true);
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
      multiplier = this.currentRowHeight;
    } else if (ev.deltaMode === WheelEvent.DOM_DELTA_PAGE) {
      multiplier = this.currentRowHeight * this.terminal.rows;
    }
    this.viewportElement.scrollTop += ev.deltaY * multiplier;
    // Prevent the page from scrolling when the terminal scrolls
    ev.preventDefault();
  }

  /**
   * Handles the touchstart event, recording the touch occurred.
   * @param ev The touch event.
   */
  public onTouchStart(ev: TouchEvent): void {
    this.lastTouchY = ev.touches[0].pageY;
  }

  /**
   * Handles the touchmove event, scrolling the viewport if the position shifted.
   * @param ev The touch event.
   */
  public onTouchMove(ev: TouchEvent): void {
    let deltaY = this.lastTouchY - ev.touches[0].pageY;
    this.lastTouchY = ev.touches[0].pageY;
    if (deltaY === 0) {
      return;
    }
    this.viewportElement.scrollTop += deltaY;
    ev.preventDefault();
  }
}
