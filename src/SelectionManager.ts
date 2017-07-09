/**
 * @license MIT
 */

import * as Mouse from './utils/Mouse';
import * as Browser from './utils/Browser';
import { CharMeasure } from './utils/CharMeasure';
import { CircularList } from './utils/CircularList';
import { EventEmitter } from './EventEmitter';
import { ITerminal } from './Interfaces';
import { SelectionModel } from './SelectionModel';

/**
 * The number of pixels the mouse needs to be above or below the viewport in
 * order to scroll at the maximum speed.
 */
const DRAG_SCROLL_MAX_THRESHOLD = 50;

/**
 * The maximum scrolling speed
 */
const DRAG_SCROLL_MAX_SPEED = 15;

/**
 * The number of milliseconds between drag scroll updates.
 */
const DRAG_SCROLL_INTERVAL = 50;

/**
 * The amount of time before mousedown events are no longer stacked to create
 * double/triple click events.
 */
const CLEAR_MOUSE_DOWN_TIME = 400;

/**
 * The number of pixels in each direction that the mouse must move before
 * mousedown events are no longer stacked to create double/triple click events.
 */
const CLEAR_MOUSE_DISTANCE = 10;

/**
 * A string containing all characters that are considered word separated by the
 * double click to select work logic.
 */
const WORD_SEPARATORS = ' ()[]{}\'"';

// TODO: Move these constants elsewhere, they belong in a buffer or buffer
//       data/line class.
const LINE_DATA_CHAR_INDEX = 1;
const LINE_DATA_WIDTH_INDEX = 2;

const NON_BREAKING_SPACE_CHAR = String.fromCharCode(160);
const ALL_NON_BREAKING_SPACE_REGEX = new RegExp(NON_BREAKING_SPACE_CHAR, 'g');

/**
 * Represents a position of a word on a line.
 */
interface IWordPosition {
  start: number;
  length: number;
}

/**
 * A selection mode, this drives how the selection behaves on mouse move.
 */
enum SelectionMode {
  NORMAL,
  WORD,
  LINE
}

/**
 * A class that manages the selection of the terminal. With help from
 * SelectionModel, SelectionManager handles with all logic associated with
 * dealing with the selection, including handling mouse interaction, wide
 * characters and fetching the actual text within the selection. Rendering is
 * not handled by the SelectionManager but a 'refresh' event is fired when the
 * selection is ready to be redrawn.
 */
export class SelectionManager extends EventEmitter {
  protected _model: SelectionModel;

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

  /**
   * The last position the mouse was clicked [x, y].
   */
  private _lastMousePosition: [number, number];

  /**
   * The number of clicks of the mousedown event. This is used to keep track of
   * double and triple clicks.
   */
  private _clickCount: number;

  /**
   * The current selection mode.
   */
  private _activeSelectionMode: SelectionMode;

  /**
   * A setInterval timer that is active while the mouse is down whose callback
   * scrolls the viewport when necessary.
   */
  private _dragScrollIntervalTimer: NodeJS.Timer;

  /**
   * The animation frame ID used for refreshing the selection.
   */
  private _refreshAnimationFrame: number;

  private _bufferTrimListener: any;
  private _mouseMoveListener: EventListener;
  private _mouseDownListener: EventListener;
  private _mouseUpListener: EventListener;

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
    this._activeSelectionMode = SelectionMode.NORMAL;
  }

  /**
   * Initializes listener variables.
   */
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
    this.clearSelection();
    this._buffer.off('trim', this._bufferTrimListener);
    this._rowContainer.removeEventListener('mousedown', this._mouseDownListener);
  }

  /**
   * Enable the selection manager.
   */
  public enable() {
    // Only adjust the selection on trim, shiftElements is rarely used (only in
    // reverseIndex) and delete in a splice is only ever used when the same
    // number of elements was just added. Given this is could actually be
    // beneficial to leave the selection as is for these cases.
    this._buffer.on('trim', this._bufferTrimListener);
    this._rowContainer.addEventListener('mousedown', this._mouseDownListener);
  }

  /**
   * Sets the active buffer, this should be called when the alt buffer is
   * switched in or out.
   * @param buffer The active buffer.
   */
  public setBuffer(buffer: CircularList<any>): void {
    this._buffer = buffer;
    this.clearSelection();
  }

  /**
   * Gets whether there is an active text selection.
   */
  public get hasSelection(): boolean {
    const start = this._model.finalSelectionStart;
    const end = this._model.finalSelectionEnd;
    if (!start || !end) {
      return false;
    }
    return start[0] !== end[0] || start[1] !== end[1];
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
      const bufferLine = this._buffer.get(i);
      const lineText = this._translateBufferLineToString(bufferLine, true);
      if (bufferLine.isWrapped) {
        result[result.length - 1] += lineText;
      } else {
        result.push(lineText);
      }
    }

    // Get final row
    if (start[1] !== end[1]) {
      const bufferLine = this._buffer.get(end[1]);
      const lineText = this._translateBufferLineToString(bufferLine, true, 0, end[0]);
      if (bufferLine.isWrapped) {
        result[result.length - 1] += lineText;
      } else {
        result.push(lineText);
      }
    }

    // Format string by replacing non-breaking space chars with regular spaces
    // and joining the array into a multi-line string.
    const formattedResult = result.map(line => {
      return line.replace(ALL_NON_BREAKING_SPACE_REGEX, ' ');
    }).join(Browser.isMSWindows ? '\r\n' : '\n');

    return formattedResult;
  }

  /**
   * Clears the current terminal selection.
   */
  public clearSelection(): void {
    this._model.clearSelection();
    this._removeMouseDownListeners();
    this.refresh();
  }

  /**
   * Translates a buffer line to a string, with optional start and end columns.
   * Wide characters will count as two columns in the resulting string. This
   * function is useful for getting the actual text underneath the raw selection
   * position.
   * @param line The line being translated.
   * @param trimRight Whether to trim whitespace to the right.
   * @param startCol The column to start at.
   * @param endCol The column to end at.
   */
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
   * Queues a refresh, redrawing the selection on the next opportunity.
   * @param isNewSelection Whether the selection should be registered as a new
   * selection on Linux.
   */
  public refresh(isNewSelection?: boolean): void {
    // Queue the refresh for the renderer
    if (!this._refreshAnimationFrame) {
      this._refreshAnimationFrame = window.requestAnimationFrame(() => this._refresh());
    }

    // If the platform is Linux and the refresh call comes from a mouse event,
    // we need to update the selection for middle click to paste selection.
    if (Browser.isLinux && isNewSelection) {
      const selectionText = this.selectionText;
      if (selectionText.length) {
        this.emit('newselection', this.selectionText);
      }
    }
  }

  /**
   * Fires the refresh event, causing consumers to pick it up and redraw the
   * selection state.
   */
  private _refresh(): void {
    this._refreshAnimationFrame = null;
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

  /**
   * Gets the 0-based [x, y] buffer coordinates of the current mouse event.
   * @param event The mouse event.
   */
  private _getMouseBufferCoords(event: MouseEvent): [number, number] {
    const coords = Mouse.getCoords(event, this._rowContainer, this._charMeasure, this._terminal.cols, this._terminal.rows, true);
    // Convert to 0-based
    coords[0]--;
    coords[1]--;
    // Convert viewport coords to buffer coords
    coords[1] += this._terminal.ydisp;
    return coords;
  }

  /**
   * Gets the amount the viewport should be scrolled based on how far out of the
   * terminal the mouse is.
   * @param event The mouse event.
   */
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

    // Tell the browser not to start a regular selection
    event.preventDefault();

    // Reset drag scroll state
    this._dragScrollAmount = 0;

    this._setMouseClickCount(event);

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

    this._addMouseDownListeners();
    this.refresh(true);
  }

  /**
   * Adds listeners when mousedown is triggered.
   */
  private _addMouseDownListeners(): void {
    // Listen on the document so that dragging outside of viewport works
    this._rowContainer.ownerDocument.addEventListener('mousemove', this._mouseMoveListener);
    this._rowContainer.ownerDocument.addEventListener('mouseup', this._mouseUpListener);
    this._dragScrollIntervalTimer = setInterval(() => this._dragScroll(), DRAG_SCROLL_INTERVAL);
  }

  /**
   * Removes the listeners that are registered when mousedown is triggered.
   */
  private _removeMouseDownListeners(): void {
    this._rowContainer.ownerDocument.removeEventListener('mousemove', this._mouseMoveListener);
    this._rowContainer.ownerDocument.removeEventListener('mouseup', this._mouseUpListener);
    clearInterval(this._dragScrollIntervalTimer);
    this._dragScrollIntervalTimer = null;
  }

  /**
   * Performs a shift click, setting the selection end position to the mouse
   * position.
   * @param event The mouse event.
   */
  private _onShiftClick(event: MouseEvent): void {
    if (this._model.selectionStart) {
      this._model.selectionEnd = this._getMouseBufferCoords(event);
    }
  }

  /**
   * Performs a single click, resetting relevant state and setting the selection
   * start position.
   * @param event The mouse event.
   */
  private _onSingleClick(event: MouseEvent): void {
    this._model.selectionStartLength = 0;
    this._model.isSelectAllActive = false;
    this._activeSelectionMode = SelectionMode.NORMAL;
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

  /**
   * Performs a double click, selecting the current work.
   * @param event The mouse event.
   */
  private _onDoubleClick(event: MouseEvent): void {
    const coords = this._getMouseBufferCoords(event);
    if (coords) {
      this._activeSelectionMode = SelectionMode.WORD;
      this._selectWordAt(coords);
    }
  }

  /**
   * Performs a triple click, selecting the current line and activating line
   * select mode.
   * @param event The mouse event.
   */
  private _onTripleClick(event: MouseEvent): void {
    const coords = this._getMouseBufferCoords(event);
    if (coords) {
      this._activeSelectionMode = SelectionMode.LINE;
      this._selectLineAt(coords[1]);
    }
  }

  /**
   * Sets the number of clicks for the current mousedown event based on the time
   * and position of the last mousedown event.
   * @param event The mouse event.
   */
  private _setMouseClickCount(event: MouseEvent): void {
    let currentTime = (new Date()).getTime();
    if (currentTime - this._lastMouseDownTime > CLEAR_MOUSE_DOWN_TIME || this._distanceFromLastMousePosition(event) > CLEAR_MOUSE_DISTANCE) {
      this._clickCount = 0;
    }
    this._lastMouseDownTime = currentTime;
    this._lastMousePosition = [event.pageX, event.pageY];
    this._clickCount++;
  }

  /**
   * Gets the maximum number of pixels in each direction the mouse has moved.
   * @param event The mouse event.
   */
  private _distanceFromLastMousePosition(event: MouseEvent): number {
    const result = Math.max(
        Math.abs(this._lastMousePosition[0] - event.pageX),
        Math.abs(this._lastMousePosition[1] - event.pageY));
    return result;
  }

  /**
   * Handles the mousemove event when the mouse button is down, recording the
   * end of the selection and refreshing the selection.
   * @param event The mousemove event.
   */
  private _onMouseMove(event: MouseEvent) {
    // Record the previous position so we know whether to redraw the selection
    // at the end.
    const previousSelectionEnd = this._model.selectionEnd ? [this._model.selectionEnd[0], this._model.selectionEnd[1]] : null;

    // Set the initial selection end based on the mouse coordinates
    this._model.selectionEnd = this._getMouseBufferCoords(event);

    // Select the entire line if line select mode is active.
    if (this._activeSelectionMode === SelectionMode.LINE) {
      if (this._model.selectionEnd[1] < this._model.selectionStart[1]) {
        this._model.selectionEnd[0] = 0;
      } else {
        this._model.selectionEnd[0] = this._terminal.cols;
      }
    } else if (this._activeSelectionMode === SelectionMode.WORD) {
      this._selectToWordAt(this._model.selectionEnd);
    }

    // Determine the amount of scrolling that will happen.
    this._dragScrollAmount = this._getMouseEventScrollAmount(event);

    // If the cursor was above or below the viewport, make sure it's at the
    // start or end of the viewport respectively.
    if (this._dragScrollAmount > 0) {
      this._model.selectionEnd[0] = this._terminal.cols - 1;
    } else if (this._dragScrollAmount < 0) {
      this._model.selectionEnd[0] = 0;
    }

    // If the character is a wide character include the cell to the right in the
    // selection. Note that selections at the very end of the line will never
    // have a character.
    if (this._model.selectionEnd[1] < this._buffer.length) {
      const char = this._buffer.get(this._model.selectionEnd[1])[this._model.selectionEnd[0]];
      if (char && char[2] === 0) {
        this._model.selectionEnd[0]++;
      }
    }

    // Only draw here if the selection changes.
    if (!previousSelectionEnd ||
        previousSelectionEnd[0] !== this._model.selectionEnd[0] ||
        previousSelectionEnd[1] !== this._model.selectionEnd[1]) {
      this.refresh(true);
    }
  }

  /**
   * The callback that occurs every DRAG_SCROLL_INTERVAL ms that does the
   * scrolling of the viewport.
   */
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
   * Handles the mouseup event, removing the mousedown listeners.
   * @param event The mouseup event.
   */
  private _onMouseUp(event: MouseEvent) {
    this._removeMouseDownListeners();
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
   * Gets positional information for the word at the coordinated specified.
   * @param coords The coordinates to get the word at.
   */
  private _getWordAt(coords: [number, number]): IWordPosition {
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
      while (startIndex > 0 && !this._isCharWordSeparator(line.charAt(startIndex - 1))) {
        if (bufferLine[startCol - 1][LINE_DATA_WIDTH_INDEX] === 0) {
          // If the next character is a wide char, record it and skip the column
          leftWideCharCount++;
          startCol--;
        }
        startIndex--;
        startCol--;
      }
      while (endIndex + 1 < line.length && !this._isCharWordSeparator(line.charAt(endIndex + 1))) {
        if (bufferLine[endCol + 1][LINE_DATA_WIDTH_INDEX] === 2) {
          // If the next character is a wide char, record it and skip the column
          rightWideCharCount++;
          endCol++;
        }
        endIndex++;
        endCol++;
      }
    }

    const start = startIndex + charOffset - leftWideCharCount;
    const length = Math.min(endIndex - startIndex + leftWideCharCount + rightWideCharCount + 1/*include endIndex char*/, this._terminal.cols);
    return {start, length};
  }

  /**
   * Selects the word at the coordinates specified.
   * @param coords The coordinates to get the word at.
   */
  protected _selectWordAt(coords: [number, number]): void {
    const wordPosition = this._getWordAt(coords);
    this._model.selectionStart = [wordPosition.start, coords[1]];
    this._model.selectionStartLength = wordPosition.length;
  }

  /**
   * Sets the selection end to the word at the coordinated specified.
   * @param coords The coordinates to get the word at.
   */
  private _selectToWordAt(coords: [number, number]): void {
    const wordPosition = this._getWordAt(coords);
    this._model.selectionEnd = [this._model.areSelectionValuesReversed() ? wordPosition.start : (wordPosition.start + wordPosition.length), coords[1]];
  }

  /**
   * Gets whether the character is considered a word separator by the select
   * word logic.
   * @param char The character to check.
   */
  private _isCharWordSeparator(char: string): boolean {
    return WORD_SEPARATORS.indexOf(char) >= 0;
  }

  /**
   * Selects the line specified.
   * @param line The line index.
   */
  protected _selectLineAt(line: number): void {
    this._model.selectionStart = [0, line];
    this._model.selectionStartLength = this._terminal.cols;
  }
}
