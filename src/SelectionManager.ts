/**
 * @license MIT
 */

import { CharMeasure } from './utils/CharMeasure';
import { CircularList } from './utils/CircularList';
import { EventEmitter } from './EventEmitter';
import * as Mouse from './utils/Mouse';
import { ITerminal } from './Interfaces';

/**
 * The number of pixels the mouse needs to be above or below the viewport in
 * order to scroll at the maximum speed.
 */
const DRAG_SCROLL_MAX_THRESHOLD = 100;

/**
 * The maximum scrolling speed
 */
const DRAG_SCROLL_MAX_SPEED = 5;

/**
 * The number of milliseconds between drag scroll updates.
 */
const DRAG_SCROLL_INTERVAL = 100;

export class SelectionManager extends EventEmitter {
  // TODO: Create a SelectionModel
  private _selectionStart: [number, number];
  private _selectionEnd: [number, number];
  private _dragScrollAmount: number;

  private _bufferTrimListener: any;
  private _mouseMoveListener: EventListener;
  private _mouseDownListener: EventListener;
  private _mouseUpListener: EventListener;
  private _dblClickListener: EventListener;

  private _dragScrollTimeout: NodeJS.Timer;

  constructor(
    private _terminal: ITerminal,
    private _buffer: CircularList<any>,
    private _rowContainer: HTMLElement,
    private _selectionContainer: HTMLElement,
    private _charMeasure: CharMeasure
  ) {
    super();
    this._initListeners();
    this.enable();
  }

  private _initListeners() {
    this._bufferTrimListener = (amount: number) => this._onTrim(amount);
    this._mouseMoveListener = event => this._onMouseMove(<MouseEvent>event);
    this._mouseDownListener = event => this._onMouseDown(<MouseEvent>event);
    this._mouseUpListener = event => this._onMouseUp(<MouseEvent>event);
    this._dblClickListener = event => this._onDblClick(<MouseEvent>event);
  }

  /**
   * Disables the selection manager. This is useful for when terminal mouse
   * are enabled.
   */
  public disable() {
    this._selectionStart = null;
    this._selectionEnd = null;
    this.refresh();
    this._buffer.off('trim', this._bufferTrimListener);
    this._rowContainer.removeEventListener('mousedown', this._mouseDownListener);
    this._rowContainer.removeEventListener('dblclick', this._dblClickListener);
    this._rowContainer.ownerDocument.removeEventListener('mousemove', this._mouseMoveListener);
    this._rowContainer.ownerDocument.removeEventListener('mouseup', this._mouseUpListener);
    clearInterval(this._dragScrollTimeout);
  }

  /**
   * Enable the selection manager.
   */
  public enable() {
    this._buffer.on('trim', this._bufferTrimListener);
    this._rowContainer.addEventListener('mousedown', this._mouseDownListener);
    this._rowContainer.addEventListener('dblclick', this._dblClickListener);
  }

  public get selectionText(): string {
    if (!this._selectionStart || !this._selectionEnd) {
      return '';
    }
    const flipValues = this._selectionStart[1] > this._selectionEnd[1] ||
        (this._selectionStart[1] === this._selectionEnd[1] && this._selectionStart[0] > this._selectionEnd[0]);
    const start = flipValues ? this._selectionEnd : this._selectionStart;
    const end = flipValues ? this._selectionStart : this._selectionEnd;
    const startRowEndCol = start[1] === end[1] ? end[0] : null;
    let result: string[] = [];
    result.push(this._translateBufferLineToString(this._buffer.get(start[1]), start[0], startRowEndCol));
    for (let i = start[1] + 1; i <= end[1] - 1; i++) {
      result.push(this._translateBufferLineToString(this._buffer.get(i)));
    }
    if (start[1] !== end[1]) {
      result.push(this._translateBufferLineToString(this._buffer.get(end[1]), 0, end[1]));
    }
    console.log('selectionText result: ' + result);
    return result.join('\n');
  }

  private _translateBufferLineToString(line: any, startCol: number = 0, endCol: number = null): string {
    // TODO: This function should live in a buffer or buffer line class
    endCol = endCol || line.length;
    let result = '';
    for (let i = startCol; i < endCol; i++) {
      result += line[i][1];
    }
    // TODO: Trim line here instead of in handlers/Clipboard?
    // TODO: Only trim off the whitespace at the end of a line
    // TODO: Handle the double-width character case
    return result;
  }

  /**
   * Redraws the selection.
   */
  public refresh(): void {
    // TODO: Figure out when to refresh the selection vs when to refresh the viewport
    this.emit('refresh', { start: this._selectionStart, end: this._selectionEnd });
  }

  /**
   * Handle the buffer being trimmed, adjust the selection position.
   * @param amount The amount the buffer is being trimmed.
   */
  private _onTrim(amount: number) {
    // Adjust the selection position based on the trimmed amount.
    if (this._selectionStart) {
      this._selectionStart[0] -= amount;
    }
    if (this._selectionEnd) {
      this._selectionEnd[0] -= amount;
    }

    // The selection has moved off the buffer, clear it.
    if (this._selectionEnd && this._selectionEnd[0] < 0) {
      this._selectionStart = null;
      this._selectionEnd = null;
      this.refresh();
      return;
    }

    // If the selection start is trimmed, ensure the start column is 0.
    if (this._selectionStart && this._selectionStart[0] < 0) {
      this._selectionStart[1] = 0;
    }
  }

  // TODO: Handle splice/shiftElements in the buffer (just clear the selection?)

  private _getMouseBufferCoords(event: MouseEvent): [number, number] {
    const coords = Mouse.getCoords(event, this._rowContainer, this._charMeasure, this._terminal.cols, this._terminal.rows);
    console.log(coords);
    // Convert to 0-based
    coords[0]--;
    coords[1]--;
    // Convert viewport coords to buffer coords
    coords[1] += this._terminal.ydisp;
    return coords;
  }

  private _getMouseEventScrollAmount(event: MouseEvent): number {
    let offset = Mouse.getCoordsRelativeToElement(event, this._rowContainer)[1];
    const terminalHeight = this._terminal.rows * this._charMeasure.height;
    if (offset >= 0 && offset <= terminalHeight) {
      return 0;
    }
    if (offset > terminalHeight) {
      offset -= terminalHeight;
    }

    offset = Math.min(Math.max(offset, -DRAG_SCROLL_MAX_THRESHOLD), DRAG_SCROLL_MAX_THRESHOLD);
    offset /= DRAG_SCROLL_MAX_THRESHOLD;
    return (offset / Math.abs(offset)) + Math.round(offset * (DRAG_SCROLL_MAX_SPEED - 1));
  }

  /**
   * Handles te mousedown event, setting up for a new selection.
   * @param event The mousedown event.
   */
  private _onMouseDown(event: MouseEvent) {
    // TODO: On right click move the text into the textbox so it can be copied via the context menu

    // Only action the primary button
    if (event.button !== 0) {
      return;
    }

    this._selectionStart = this._getMouseBufferCoords(event);
    if (this._selectionStart) {
      this._selectionEnd = null;
      // Listen on the document so that dragging outside of viewport works
      this._rowContainer.ownerDocument.addEventListener('mousemove', this._mouseMoveListener);
      this._rowContainer.ownerDocument.addEventListener('mouseup', this._mouseUpListener);
      this._dragScrollTimeout = setInterval(() => this._dragScroll(), DRAG_SCROLL_INTERVAL);
      this.refresh();
    }
  }

  /**
   * Handles the mousemove event when the mouse button is down, recording the
   * end of the selection and refreshing the selection.
   * @param event The mousemove event.
   */
  private _onMouseMove(event: MouseEvent) {
    this._selectionEnd = this._getMouseBufferCoords(event);
    // TODO: Perhaps the actual selection setting could be merged into _dragScroll?
    this._dragScrollAmount = this._getMouseEventScrollAmount(event);
    // If the cursor was above or below the viewport, make sure it's at the
    // start or end of the viewport respectively
    if (this._dragScrollAmount > 0) {
      this._selectionEnd[0] = this._terminal.cols - 1;
    } else if (this._dragScrollAmount < 0) {
      this._selectionEnd[0] = 0;
    }
    // TODO: Only draw here if the selection changes
    this.refresh();
  }

  private _dragScroll() {
    if (this._dragScrollAmount) {
      this._terminal.scrollDisp(this._dragScrollAmount, false);
      // Re-evaluate selection
      if (this._dragScrollAmount > 0) {
        this._selectionEnd = [this._terminal.cols - 1, this._terminal.ydisp + this._terminal.rows];
      } else {
        this._selectionEnd = [0, this._terminal.ydisp];
      }
      this.refresh();
    }
  }

  /**
   * Handles the mouseup event, removing the mousemove listener when
   * appropriate.
   * @param event The mouseup event.
   */
  private _onMouseUp(event: MouseEvent) {
    this._dragScrollAmount = 0;
    if (!this._selectionStart) {
      return;
    }
    this._rowContainer.ownerDocument.removeEventListener('mousemove', this._mouseMoveListener);
    this._rowContainer.ownerDocument.removeEventListener('mouseup', this._mouseUpListener);
  }

  private _onDblClick(event: MouseEvent) {
    const coords = this._getMouseBufferCoords(event);
    if (coords) {
      this._selectWordAt(coords);
    }
  }

  /**
   * Selects the word at the coordinates specified. Words are defined as all
   * non-whitespace characters.
   * @param coords The coordinates to get the word at.
   */
  private _selectWordAt(coords: [number, number]): void {
    // TODO: Handle double click and drag in both directions!

    const line = this._translateBufferLineToString(this._buffer.get(coords[1]));
    // Expand the string in both directions until a space is hit
    let startCol = coords[0];
    let endCol = coords[0];
    while (startCol > 0 && line.charAt(startCol - 1) !== ' ') {
      startCol--;
    }
    while (endCol < line.length && line.charAt(endCol) !== ' ') {
      endCol++;
    }
    this._selectionStart = [startCol, coords[1]];
    this._selectionEnd = [endCol, coords[1]];
    this.refresh();
  }
}
