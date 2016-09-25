/**
 * xterm.js: xterm, in the browser
 * Copyright (c) 2016, SourceLair Limited <www.sourcelair.com> (MIT License)
 */

/**
 * Represents the viewport of a terminal, the visible area within the larger buffer of output.
 * Logic for the virtual scroll bar is included in this object.
 * @param {Terminal} terminal The Terminal object.
 * @param {HTMLElement} viewportElement The DOM element acting as the viewport
 * @param {HTMLElement} charMeasureElement A DOM element used to measure the character size of
 *   the terminal.
 */
function Viewport(terminal, viewportElement, scrollArea, charMeasureElement) {
  this.terminal = terminal;
  this.viewportElement = viewportElement;
  this.scrollArea = scrollArea;
  this.charMeasureElement = charMeasureElement;
  this.currentRowHeight = 0;
  this.lastRecordedBufferLength = 0;
  this.lastRecordedViewportHeight = 0;

  this.terminal.on('scroll', this.syncScrollArea.bind(this));
  this.terminal.on('resize', this.syncScrollArea.bind(this));
  this.viewportElement.addEventListener('scroll', this.onScroll.bind(this));

  this.syncScrollArea();
}

/**
 * Refreshes row height, setting line-height, viewport height and scroll area height if
 * necessary.
 * @param {number|undefined} charSize A character size measurement bounding rect object, if it
 *   doesn't exist it will be created.
 */
Viewport.prototype.refresh = function(charSize) {
  var size = charSize || this.charMeasureElement.getBoundingClientRect();
  if (size.height > 0) {
    var rowHeightChanged = size.height !== this.currentRowHeight;
    if (rowHeightChanged) {
      this.currentRowHeight = size.height;
      this.viewportElement.style.lineHeight = size.height + 'px';
      this.terminal.rowContainer.style.lineHeight = size.height + 'px';
    }
    var viewportHeightChanged = this.lastRecordedViewportHeight !== this.terminal.rows;
    if (rowHeightChanged || viewportHeightChanged) {
      this.lastRecordedViewportHeight = this.terminal.rows;
      this.viewportElement.style.height = size.height * this.terminal.rows + 'px';
    }
    this.scrollArea.style.height = (size.height * this.lastRecordedBufferLength) + 'px';
  }
};

/**
 * Updates dimensions and synchronizes the scroll area if necessary.
 */
Viewport.prototype.syncScrollArea = function() {
  if (this.lastRecordedBufferLength !== this.terminal.lines.length) {
    // If buffer height changed
    this.lastRecordedBufferLength = this.terminal.lines.length;
    this.refresh();
  } else if (this.lastRecordedViewportHeight !== this.terminal.rows) {
    // If viewport height changed
    this.refresh();
  } else {
    // If size has changed, refresh viewport
    var size = this.charMeasureElement.getBoundingClientRect();
    if (size.height !== this.currentRowHeight) {
      this.refresh(size);
    }
  }

  // Sync scrollTop
  var scrollTop = this.terminal.ydisp * this.currentRowHeight;
  if (this.viewportElement.scrollTop !== scrollTop) {
    this.viewportElement.scrollTop = scrollTop;
  }
};

/**
 * Handles scroll events on the viewport, calculating the new viewport and requesting the
 * terminal to scroll to it.
 * @param {Event} ev The scroll event.
 */
Viewport.prototype.onScroll = function(ev) {
  var newRow = Math.round(this.viewportElement.scrollTop / this.currentRowHeight);
  var diff = newRow - this.terminal.ydisp;
  this.terminal.scrollDisp(diff, true);
};

/**
 * Handles mouse wheel events by adjusting the viewport's scrollTop and delegating the actual
 * scrolling to `onScroll`, this event needs to be attached manually by the consumer of
 * `Viewport`.
 * @param {WheelEvent} ev The mouse wheel event.
 */
Viewport.prototype.onWheel = function(ev) {
  if (ev.deltaY === 0) {
    // Do nothing if it's not a vertical scroll event
    return;
  }
  // Fallback to WheelEvent.DOM_DELTA_PIXEL
  var multiplier = 1;
  if (ev.deltaMode === WheelEvent.DOM_DELTA_LINE) {
    multiplier = this.currentRowHeight;
  } else if (ev.deltaMode === WheelEvent.DOM_DELTA_PAGE) {
    multiplier = this.currentRowHeight * this.terminal.rows;
  }
  this.viewportElement.scrollTop += ev.deltaY * multiplier;
  // Prevent the page from scrolling when the terminal scrolls
  ev.preventDefault();
};

export { Viewport };
