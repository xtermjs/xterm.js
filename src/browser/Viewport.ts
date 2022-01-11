/**
 * Copyright (c) 2016 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import { Disposable } from 'common/Lifecycle';
import { addDisposableDomListener } from 'browser/Lifecycle';
import { IColorSet, IViewport } from 'browser/Types';
import { ICharSizeService, IRenderService } from 'browser/services/Services';
import { IBufferService, IOptionsService } from 'common/services/Services';
import { IBuffer } from 'common/buffer/Types';
import { IRenderDimensions } from 'browser/renderer/Types';

const FALLBACK_SCROLL_BAR_WIDTH = 15;

/**
 * Represents the viewport of a terminal, the visible area within the larger buffer of output.
 * Logic for the virtual scroll bar is included in this object.
 */
export class Viewport extends Disposable implements IViewport {
  public scrollBarWidth: number = 0;
  private _currentRowHeight: number = 0;
  private _currentScaledCellHeight: number = 0;
  private _lastRecordedBufferLength: number = 0;
  private _lastRecordedViewportHeight: number = 0;
  private _lastRecordedBufferHeight: number = 0;
  private _lastTouchY: number = 0;
  private _lastScrollTop: number = 0;
  private _lastHadScrollBar: boolean = false;
  private _activeBuffer: IBuffer;
  private _renderDimensions: IRenderDimensions;

  // Stores a partial line amount when scrolling, this is used to keep track of how much of a line
  // is scrolled so we can "scroll" over partial lines and feel natural on touchpads. This is a
  // quick fix and could have a more robust solution in place that reset the value when needed.
  private _wheelPartialScroll: number = 0;

  private _refreshAnimationFrame: number | null = null;
  private _ignoreNextScrollEvent: boolean = false;

  constructor(
    private readonly _scrollLines: (amount: number) => void,
    private readonly _viewportElement: HTMLElement,
    private readonly _scrollArea: HTMLElement,
    private readonly _element: HTMLElement,
    @IBufferService private readonly _bufferService: IBufferService,
    @IOptionsService private readonly _optionsService: IOptionsService,
    @ICharSizeService private readonly _charSizeService: ICharSizeService,
    @IRenderService private readonly _renderService: IRenderService
  ) {
    super();

    // Measure the width of the scrollbar. If it is 0 we can assume it's an OSX overlay scrollbar.
    // Unfortunately the overlay scrollbar would be hidden underneath the screen element in that case,
    // therefore we account for a standard amount to make it visible
    this.scrollBarWidth = (this._viewportElement.offsetWidth - this._scrollArea.offsetWidth) || FALLBACK_SCROLL_BAR_WIDTH;
    this._lastHadScrollBar = true;
    this.register(addDisposableDomListener(this._viewportElement, 'scroll', this._onScroll.bind(this)));

    // Track properties used in performance critical code manually to avoid using slow getters
    this._activeBuffer = this._bufferService.buffer;
    this.register(this._bufferService.buffers.onBufferActivate(e => this._activeBuffer = e.activeBuffer));
    this._renderDimensions = this._renderService.dimensions;
    this.register(this._renderService.onDimensionsChange(e => this._renderDimensions = e));

    // Perform this async to ensure the ICharSizeService is ready.
    setTimeout(() => this.syncScrollArea(), 0);
  }

  public onThemeChange(colors: IColorSet): void {
    this._viewportElement.style.backgroundColor = colors.background.css;
  }

  /**
   * Refreshes row height, setting line-height, viewport height and scroll area height if
   * necessary.
   */
  private _refresh(immediate: boolean): void {
    if (immediate) {
      this._innerRefresh();
      if (this._refreshAnimationFrame !== null) {
        cancelAnimationFrame(this._refreshAnimationFrame);
      }
      return;
    }
    if (this._refreshAnimationFrame === null) {
      this._refreshAnimationFrame = requestAnimationFrame(() => this._innerRefresh());
    }
  }

  private _innerRefresh(): void {
    if (this._charSizeService.height > 0) {
      this._currentRowHeight = this._renderService.dimensions.scaledCellHeight / window.devicePixelRatio;
      this._currentScaledCellHeight = this._renderService.dimensions.scaledCellHeight;
      this._lastRecordedViewportHeight = this._viewportElement.offsetHeight;
      const newBufferHeight = Math.round(this._currentRowHeight * this._lastRecordedBufferLength) + (this._lastRecordedViewportHeight - this._renderService.dimensions.canvasHeight);
      if (this._lastRecordedBufferHeight !== newBufferHeight) {
        this._lastRecordedBufferHeight = newBufferHeight;
        this._scrollArea.style.height = this._lastRecordedBufferHeight + 'px';
      }
    }

    // Sync scrollTop
    const scrollTop = this._bufferService.buffer.ydisp * this._currentRowHeight;
    if (this._viewportElement.scrollTop !== scrollTop) {
      // Ignore the next scroll event which will be triggered by setting the scrollTop as we do not
      // want this event to scroll the terminal
      this._ignoreNextScrollEvent = true;
      this._viewportElement.scrollTop = scrollTop;
    }

    // Update scroll bar width
    if (this._optionsService.rawOptions.scrollback === 0) {
      this.scrollBarWidth = 0;
    } else {
      this.scrollBarWidth = (this._viewportElement.offsetWidth - this._scrollArea.offsetWidth) || FALLBACK_SCROLL_BAR_WIDTH;
    }
    this._lastHadScrollBar = this.scrollBarWidth > 0;

    const elementStyle = window.getComputedStyle(this._element);
    const elementPadding = parseInt(elementStyle.paddingLeft) + parseInt(elementStyle.paddingRight);
    this._viewportElement.style.width = (this._renderService.dimensions.actualCellWidth * (this._bufferService.cols) + this.scrollBarWidth + (this._lastHadScrollBar ? elementPadding : 0)).toString() + 'px';
    this._refreshAnimationFrame = null;
  }

  /**
   * Updates dimensions and synchronizes the scroll area if necessary.
   */
  public syncScrollArea(immediate: boolean = false): void {
    // If buffer height changed
    if (this._lastRecordedBufferLength !== this._bufferService.buffer.lines.length) {
      this._lastRecordedBufferLength = this._bufferService.buffer.lines.length;
      this._refresh(immediate);
      return;
    }

    // If viewport height changed
    if (this._lastRecordedViewportHeight !== this._renderService.dimensions.canvasHeight) {
      this._refresh(immediate);
      return;
    }

    // If the buffer position doesn't match last scroll top
    if (this._lastScrollTop !== this._activeBuffer.ydisp * this._currentRowHeight) {
      this._refresh(immediate);
      return;
    }

    // If row height changed
    if (this._renderDimensions.scaledCellHeight !== this._currentScaledCellHeight) {
      this._refresh(immediate);
      return;
    }

    // If the scroll bar visibility changed
    if (this._lastHadScrollBar !== (this._optionsService.rawOptions.scrollback > 0)) {
      this._refresh(immediate);
    }
  }

  /**
   * Handles scroll events on the viewport, calculating the new viewport and requesting the
   * terminal to scroll to it.
   * @param ev The scroll event.
   */
  private _onScroll(ev: Event): void {
    // Record current scroll top position
    this._lastScrollTop = this._viewportElement.scrollTop;

    // Don't attempt to scroll if the element is not visible, otherwise scrollTop will be corrupt
    // which causes the terminal to scroll the buffer to the top
    if (!this._viewportElement.offsetParent) {
      return;
    }

    // Ignore the event if it was flagged to ignore (when the source of the event is from Viewport)
    if (this._ignoreNextScrollEvent) {
      this._ignoreNextScrollEvent = false;
      // Still trigger the scroll so lines get refreshed
      this._scrollLines(0);
      return;
    }

    const newRow = Math.round(this._lastScrollTop / this._currentRowHeight);
    const diff = newRow - this._bufferService.buffer.ydisp;
    this._scrollLines(diff);
  }

  /**
   * Handles bubbling of scroll event in case the viewport has reached top or bottom
   * @param ev The scroll event.
   * @param amount The amount scrolled
   */
  private _bubbleScroll(ev: Event, amount: number): boolean {
    const scrollPosFromTop = this._viewportElement.scrollTop + this._lastRecordedViewportHeight;
    if ((amount < 0 && this._viewportElement.scrollTop !== 0) ||
      (amount > 0 && scrollPosFromTop < this._lastRecordedBufferHeight)) {
      if (ev.cancelable) {
        ev.preventDefault();
      }
      return false;
    }
    return true;
  }

  /**
   * Handles mouse wheel events by adjusting the viewport's scrollTop and delegating the actual
   * scrolling to `onScroll`, this event needs to be attached manually by the consumer of
   * `Viewport`.
   * @param ev The mouse wheel event.
   */
  public onWheel(ev: WheelEvent): boolean {
    const amount = this._getPixelsScrolled(ev);
    if (amount === 0) {
      return false;
    }
    this._viewportElement.scrollTop += amount;
    return this._bubbleScroll(ev, amount);
  }

  private _getPixelsScrolled(ev: WheelEvent): number {
    // Do nothing if it's not a vertical scroll event
    if (ev.deltaY === 0 || ev.shiftKey) {
      return 0;
    }

    // Fallback to WheelEvent.DOM_DELTA_PIXEL
    let amount = this._applyScrollModifier(ev.deltaY, ev);
    if (ev.deltaMode === WheelEvent.DOM_DELTA_LINE) {
      amount *= this._currentRowHeight;
    } else if (ev.deltaMode === WheelEvent.DOM_DELTA_PAGE) {
      amount *= this._currentRowHeight * this._bufferService.rows;
    }
    return amount;
  }

  /**
   * Gets the number of pixels scrolled by the mouse event taking into account what type of delta
   * is being used.
   * @param ev The mouse wheel event.
   */
  public getLinesScrolled(ev: WheelEvent): number {
    // Do nothing if it's not a vertical scroll event
    if (ev.deltaY === 0 || ev.shiftKey) {
      return 0;
    }

    // Fallback to WheelEvent.DOM_DELTA_LINE
    let amount = this._applyScrollModifier(ev.deltaY, ev);
    if (ev.deltaMode === WheelEvent.DOM_DELTA_PIXEL) {
      amount /= this._currentRowHeight + 0.0; // Prevent integer division
      this._wheelPartialScroll += amount;
      amount = Math.floor(Math.abs(this._wheelPartialScroll)) * (this._wheelPartialScroll > 0 ? 1 : -1);
      this._wheelPartialScroll %= 1;
    } else if (ev.deltaMode === WheelEvent.DOM_DELTA_PAGE) {
      amount *= this._bufferService.rows;
    }
    return amount;
  }

  private _applyScrollModifier(amount: number, ev: WheelEvent): number {
    const modifier = this._optionsService.rawOptions.fastScrollModifier;
    // Multiply the scroll speed when the modifier is down
    if ((modifier === 'alt' && ev.altKey) ||
      (modifier === 'ctrl' && ev.ctrlKey) ||
      (modifier === 'shift' && ev.shiftKey)) {
      return amount * this._optionsService.rawOptions.fastScrollSensitivity * this._optionsService.rawOptions.scrollSensitivity;
    }

    return amount * this._optionsService.rawOptions.scrollSensitivity;
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
  public onTouchMove(ev: TouchEvent): boolean {
    const deltaY = this._lastTouchY - ev.touches[0].pageY;
    this._lastTouchY = ev.touches[0].pageY;
    if (deltaY === 0) {
      return false;
    }
    this._viewportElement.scrollTop += deltaY;
    return this._bubbleScroll(ev, deltaY);
  }
}
