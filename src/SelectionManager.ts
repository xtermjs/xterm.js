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

/**
 * The amount of time before mousedown events are no stacked to create double
 * click events.
 */
const CLEAR_MOUSE_DOWN_TIME = 400;

export class SelectionManager extends EventEmitter {
  // TODO: Create a SelectionModel

  /**
   * Whether select all is currently active.
   */
  private _isSelectAllActive: boolean;

  /**
   * The [x, y] position the selection starts at.
   */
  private _selectionStart: [number, number];

  /**
   * The minimal length of the selection from the start position. When double
   * clicking on a word, the word will be selected which makes the selection
   * start at the start of the word and makes this variable the length.
   */
  private _selectionStartLength: number;

  /**
   * The [x, y] position the selection ends at.
   */
  private _selectionEnd: [number, number];

  /**
   * The amount to scroll every drag scroll update (depends on how far the mouse
   * drag is above or below the terminal).
   */
  private _dragScrollAmount: number;

  /**
   * The last time the mousedown event fired, this is used to track double and
   * triple clicks.
   */
  private _lastMouseDownTime: number;

  private _clickCount: number;

  private _bufferTrimListener: any;
  private _mouseMoveListener: EventListener;
  private _mouseDownListener: EventListener;
  private _mouseUpListener: EventListener;

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

    this._lastMouseDownTime = 0;
  }

  private _initListeners() {
    this._bufferTrimListener = (amount: number) => this._onTrim(amount);
    this._mouseMoveListener = event => this._onMouseMove(<MouseEvent>event);
    this._mouseDownListener = event => this._onMouseDown(<MouseEvent>event);
    this._mouseUpListener = event => this._onMouseUp(<MouseEvent>event);
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
  }

  /**
   * Gets the text currently selected.
   */
  public get selectionText(): string {
    const start = this.finalSelectionStart;
    const end = this.finalSelectionEnd;
    if (!start || !end) {
      return '';
    }

    // Get first row
    const startRowEndCol = start[1] === end[1] ? end[0] : null;
    let result: string[] = [];
    result.push(this._translateBufferLineToString(this._buffer.get(start[1]), start[0], startRowEndCol));

    // Get middle rows
    for (let i = start[1] + 1; i <= end[1] - 1; i++) {
      result.push(this._translateBufferLineToString(this._buffer.get(i)));
    }

    // Get final row
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
   * The final selection start, taking into consideration select all.
   */
  private get finalSelectionStart(): [number, number] {
    if (this._isSelectAllActive) {
      return [0, 0];
    }

    if (!this._selectionEnd) {
      return this._selectionStart;
    }

    return this._areSelectionValuesReversed() ? this._selectionEnd : this._selectionStart;
  }

  /**
   * The final selection end, taking into consideration select all, double click
   * word selection and triple click line selection.
   */
  private get finalSelectionEnd(): [number, number] {
    if (this._isSelectAllActive) {
      return [this._terminal.cols - 1, this._terminal.ydisp + this._terminal.rows - 1];
    }

    // Ensure the the word/line is selected after a double/triple click
    if (this._selectionStartLength) {
      // Select just the word/line if there is no selection end yet or it's above the line
      if (!this._selectionEnd || this._areSelectionValuesReversed()) {
        return [this._selectionStart[0] + this._selectionStartLength, this._selectionStart[1]];
      }
      // Select the larger of the two when start and end are on the same line
      if (this._selectionEnd[1] === this._selectionStart[1]) {
        return [Math.max(this._selectionStart[0] + this._selectionStartLength, this._selectionEnd[0]), this._selectionEnd[1]];
      }
    }
    return this._selectionEnd;
  }

  /**
   * Returns whether the selection start and end are reversed.
   */
  private _areSelectionValuesReversed(): boolean {
    const start = this._selectionStart;
    const end = this._selectionEnd;
    return start[1] > end[1] || (start[1] === end[1] && start[0] > end[0]);
  }

  /**
   * Redraws the selection.
   */
  public refresh(): void {
    // TODO: Figure out when to refresh the selection vs when to refresh the viewport
    this.emit('refresh', { start: this.finalSelectionStart, end: this.finalSelectionEnd });
  }

  /**
   * Selects all text within the terminal.
   */
  public selectAll(): void {
    this._isSelectAllActive = true;
    this.refresh();
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

    this._setMouseClickCount();
    console.log(this._clickCount);

    if (this._clickCount === 1) {
        this._onSingleClick(event);
    } else if (this._clickCount === 2) {
        this._onDoubleClick(event);
    } else if (this._clickCount === 3) {
        this._onTripleClick(event);
    }

    // Listen on the document so that dragging outside of viewport works
    this._rowContainer.ownerDocument.addEventListener('mousemove', this._mouseMoveListener);
    this._rowContainer.ownerDocument.addEventListener('mouseup', this._mouseUpListener);
    this._dragScrollTimeout = setInterval(() => this._dragScroll(), DRAG_SCROLL_INTERVAL);
    this.refresh();
  }

  private _onSingleClick(event: MouseEvent): void {
    this._selectionStartLength = 0;
    this._isSelectAllActive = false;
    this._selectionStart = this._getMouseBufferCoords(event);
    if (this._selectionStart) {
      this._selectionEnd = null;
    }
  }

  private _onDoubleClick(event: MouseEvent): void {
    const coords = this._getMouseBufferCoords(event);
    if (coords) {
      this._selectWordAt(coords);
    }
  }

  private _onTripleClick(event: MouseEvent): void {
    const coords = this._getMouseBufferCoords(event);
    if (coords) {
      this._selectLineAt(coords[1]);
    }
  }

  private _setMouseClickCount(): void {
    let currentTime = (new Date()).getTime();
		if (currentTime - this._lastMouseDownTime > CLEAR_MOUSE_DOWN_TIME) {
      this._clickCount = 0;
		}
		this._lastMouseDownTime = currentTime;
    this._clickCount++;

    // TODO: Invalidate click count if the position is different
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
    this._selectionStartLength = endCol - startCol;
  }

  private _selectLineAt(line: number): void {
    this._selectionStart = [0, line];
    this._selectionStartLength = this._terminal.cols;
  }
}
