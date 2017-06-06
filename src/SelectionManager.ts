/**
 * @license MIT
 */

import { CharMeasure } from './utils/CharMeasure';
import { CircularList } from './utils/CircularList';
import { EventEmitter } from './EventEmitter';
import * as Mouse from './utils/Mouse';
import { ITerminal } from './Interfaces';
import { SelectionModel } from './SelectionModel';

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

// TODO: Move these constants elsewhere
const LINE_DATA_CHAR_INDEX = 1;
const LINE_DATA_WIDTH_INDEX = 2;

export class SelectionManager extends EventEmitter {
  private _model: SelectionModel;

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

  private _isLineSelectModeActive: boolean;

  private _bufferTrimListener: any;
  private _mouseMoveListener: EventListener;
  private _mouseDownListener: EventListener;
  private _mouseUpListener: EventListener;

  private _dragScrollTimeout: NodeJS.Timer;

  constructor(
    private _terminal: ITerminal,
    private _buffer: CircularList<any>,
    private _rowContainer: HTMLElement,
    private _charMeasure: CharMeasure
  ) {
    super();
    this._initListeners();
    this.enable();

    this._model = new SelectionModel(_terminal);
    this._lastMouseDownTime = 0;
    this._isLineSelectModeActive = false;
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
    this._model.selectionStart = null;
    this._model.selectionEnd = null;
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
    const start = this._model.finalSelectionStart;
    const end = this._model.finalSelectionEnd;
    if (!start || !end) {
      return '';
    }

    // Get first row
    const startRowEndCol = start[1] === end[1] ? end[0] : null;
    let result: string[] = [];
    result.push(this._translateBufferLineToString(this._buffer.get(start[1]), true, start[0], startRowEndCol));

    // Get middle rows
    for (let i = start[1] + 1; i <= end[1] - 1; i++) {
      result.push(this._translateBufferLineToString(this._buffer.get(i), true));
    }

    // Get final row
    if (start[1] !== end[1]) {
      result.push(this._translateBufferLineToString(this._buffer.get(end[1]), true, 0, end[0]));
    }
    console.log('selectionText result: "' + result + '"');
    return result.join('\n');
  }

  private _translateBufferLineToString(line: any, trimRight: boolean, startCol: number = 0, endCol: number = null): string {
    // TODO: This function should live in a buffer or buffer line class

    // Get full line
    let lineString = '';
    let widthAdjustedStartCol = startCol;
    let widthAdjustedEndCol = endCol;
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      lineString += char[LINE_DATA_CHAR_INDEX];
      // Adjust start and end cols for wide characters if they affect their
      // column indexes
      if (char[LINE_DATA_WIDTH_INDEX] === 0) {
        if (startCol >= i) {
          widthAdjustedStartCol--;
        }
        if (endCol >= i) {
          widthAdjustedEndCol--;
        }
      }
    }

    // Calculate the final end col by trimming whitespace on the right of the
    // line if needed.
    let finalEndCol = widthAdjustedEndCol || line.length;
    if (trimRight) {
      const rightWhitespaceIndex = lineString.search(/\s+$/);
      if (rightWhitespaceIndex !== -1) {
        finalEndCol = Math.min(finalEndCol, rightWhitespaceIndex);
      }
      // Return the empty string if only trimmed whitespace is selected
      if (finalEndCol <= widthAdjustedStartCol) {
        return '';
      }
    }

    return lineString.substring(widthAdjustedStartCol, finalEndCol);
  }

  /**
   * Redraws the selection.
   */
  public refresh(): void {
    // TODO: Figure out when to refresh the selection vs when to refresh the viewport
    this.emit('refresh', { start: this._model.finalSelectionStart, end: this._model.finalSelectionEnd });
  }

  /**
   * Selects all text within the terminal.
   */
  public selectAll(): void {
    this._model.isSelectAllActive = true;
    this.refresh();
  }

  /**
   * Handle the buffer being trimmed, adjust the selection position.
   * @param amount The amount the buffer is being trimmed.
   */
  private _onTrim(amount: number) {
    const needsRefresh = this._model.onTrim(amount);
    if (needsRefresh) {
      this.refresh();
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
    // Only action the primary button
    if (event.button !== 0) {
      return;
    }

    this._setMouseClickCount();
    console.log(this._clickCount);

    if (event.shiftKey) {
      this._onShiftClick(event);
    } else {
      if (this._clickCount === 1) {
          this._onSingleClick(event);
      } else if (this._clickCount === 2) {
          this._onDoubleClick(event);
      } else if (this._clickCount === 3) {
          this._onTripleClick(event);
      }
    }

    // Listen on the document so that dragging outside of viewport works
    this._rowContainer.ownerDocument.addEventListener('mousemove', this._mouseMoveListener);
    this._rowContainer.ownerDocument.addEventListener('mouseup', this._mouseUpListener);
    this._dragScrollTimeout = setInterval(() => this._dragScroll(), DRAG_SCROLL_INTERVAL);
    this.refresh();
  }

  private _onShiftClick(event: MouseEvent): void {
    if (this._model.selectionStart) {
      this._model.selectionEnd = this._getMouseBufferCoords(event);
    }
  }

  private _onSingleClick(event: MouseEvent): void {
    this._model.selectionStartLength = 0;
    this._model.isSelectAllActive = false;
    this._isLineSelectModeActive = false;
    this._model.selectionStart = this._getMouseBufferCoords(event);
    if (this._model.selectionStart) {
      this._model.selectionEnd = null;
      // If the mouse is over the second half of a wide character, adjust the
      // selection to cover the whole character
      const char = this._buffer.get(this._model.selectionStart[1])[this._model.selectionStart[0]];
      if (char[LINE_DATA_WIDTH_INDEX] === 0) {
        this._model.selectionStart[0]++;
      }
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
      this._isLineSelectModeActive = true;
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
    if (this._isLineSelectModeActive) {
      this._model.selectionEnd = this._getMouseBufferCoords(event);
      if (this._model.selectionEnd[1] < this._model.selectionStart[1]) {
        this._model.selectionEnd[0] = 0;
      } else {
        this._model.selectionEnd[0] = this._terminal.cols;
      }
    } else {
      this._model.selectionEnd = this._getMouseBufferCoords(event);
    }

    // TODO: Perhaps the actual selection setting could be merged into _dragScroll?
    this._dragScrollAmount = this._getMouseEventScrollAmount(event);
    // If the cursor was above or below the viewport, make sure it's at the
    // start or end of the viewport respectively
    if (this._dragScrollAmount > 0) {
      this._model.selectionEnd[0] = this._terminal.cols - 1;
    } else if (this._dragScrollAmount < 0) {
      this._model.selectionEnd[0] = 0;
    }

    console.log(this._model.selectionEnd);

    // If the character is a wide character include the cell to the right in the
    // selection. Note that selections at the very end of the line will never
    // have a character.
    const char = this._buffer.get(this._model.selectionEnd[1])[this._model.selectionEnd[0]];
    if (char && char[2] === 0) {
      this._model.selectionEnd[0]++;
    }

    // TODO: Only draw here if the selection changes
    this.refresh();
  }

  private _dragScroll() {
    if (this._dragScrollAmount) {
      this._terminal.scrollDisp(this._dragScrollAmount, false);
      // Re-evaluate selection
      if (this._dragScrollAmount > 0) {
        this._model.selectionEnd = [this._terminal.cols - 1, this._terminal.ydisp + this._terminal.rows];
      } else {
        this._model.selectionEnd = [0, this._terminal.ydisp];
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
    if (!this._model.selectionStart) {
      return;
    }
    this._rowContainer.ownerDocument.removeEventListener('mousemove', this._mouseMoveListener);
    this._rowContainer.ownerDocument.removeEventListener('mouseup', this._mouseUpListener);
  }

  /**
   * Converts a viewport column to the character index on the buffer line, the
   * latter takes into account wide characters.
   * @param coords The coordinates to find the 2 index for.
   */
  private _convertViewportColToCharacterIndex(bufferLine: any, coords: [number, number]): number {
    let charIndex = coords[0];
    for (let i = 0; coords[0] >= i; i++) {
      const char = bufferLine[i];
      if (char[LINE_DATA_WIDTH_INDEX] === 0) {
        charIndex--;
      }
    }
    return charIndex;
  }

  /**
   * Selects the word at the coordinates specified. Words are defined as all
   * non-whitespace characters.
   * @param coords The coordinates to get the word at.
   */
  protected _selectWordAt(coords: [number, number]): void {
    // TODO: Only fetch buffer line once for translate and convert functions
    const bufferLine = this._buffer.get(coords[1]);
    const line = this._translateBufferLineToString(bufferLine, false);

    // Get actual index, taking into consideration wide characters
    let endIndex = this._convertViewportColToCharacterIndex(bufferLine, coords);
    let startIndex = endIndex;

    // Record offset to be used later
    const charOffset = coords[0] - startIndex;
    let leftWideCharCount = 0;
    let rightWideCharCount = 0;

    if (line.charAt(startIndex) === ' ') {
      // Expand until non-whitespace is hit
      while (startIndex > 0 && line.charAt(startIndex - 1) === ' ') {
        startIndex--;
      }
      while (endIndex < line.length && line.charAt(endIndex + 1) === ' ') {
        endIndex++;
      }
    } else {
      // Expand until whitespace is hit. This algorithm works by scanning left
      // and right from the starting position, keeping both the index format
      // (line) and the column format (bufferLine) in sync. When a wide
      // character is hit, it is recorded and the column index is adjusted.
      let startCol = coords[0];
      let endCol = coords[0];
      // Consider the initial position, skip it and increment the wide char
      // variable
      if (bufferLine[startCol][LINE_DATA_WIDTH_INDEX] === 0) {
        leftWideCharCount++;
        startCol--;
      }
      if (bufferLine[endCol][LINE_DATA_WIDTH_INDEX] === 2) {
        rightWideCharCount++;
        endCol++;
      }
      // Expand the string in both directions until a space is hit
      while (startIndex > 0 && line.charAt(startIndex - 1) !== ' ') {
        if (bufferLine[startCol - 1][LINE_DATA_WIDTH_INDEX] === 0) {
          // If the next character is a wide char, record it and skip the column
          leftWideCharCount++;
          startCol--;
        }
        startIndex--;
        startCol--;
      }
      while (endIndex + 1 < line.length && line.charAt(endIndex + 1) !== ' ') {
        if (bufferLine[endCol + 1][LINE_DATA_WIDTH_INDEX] === 2) {
          // If the next character is a wide char, record it and skip the column
          rightWideCharCount++;
          endCol++;
        }
        endIndex++;
        endCol++;
      }
    }

    // Record the resulting selection
    this._model.selectionStart = [startIndex + charOffset - leftWideCharCount, coords[1]];
    this._model.selectionStartLength = Math.min(endIndex - startIndex + leftWideCharCount + rightWideCharCount + 1/*include endIndex char*/, this._terminal.cols);
  }

  private _selectLineAt(line: number): void {
    this._model.selectionStart = [0, line];
    this._model.selectionStartLength = this._terminal.cols;
  }
}
