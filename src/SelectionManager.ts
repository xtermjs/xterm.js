/**
 * Copyright (c) 2017 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import { MouseHelper } from './utils/MouseHelper';
import * as Browser from './utils/Browser';
import { CharMeasure } from './utils/CharMeasure';
import { CircularList } from './utils/CircularList';
import { EventEmitter } from './EventEmitter';
import { ITerminal, ICircularList, ISelectionManager, IBuffer } from './Interfaces';
import { SelectionModel } from './SelectionModel';
import { LineData, CharData } from './Types';
import { CHAR_DATA_WIDTH_INDEX, CHAR_DATA_CHAR_INDEX } from './Buffer';

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
 * A string containing all characters that are considered word separated by the
 * double click to select work logic.
 */
const WORD_SEPARATORS = ' ()[]{}\'"';

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
export class SelectionManager extends EventEmitter implements ISelectionManager {
  protected _model: SelectionModel;

  /**
   * The amount to scroll every drag scroll update (depends on how far the mouse
   * drag is above or below the terminal).
   */
  private _dragScrollAmount: number;

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

  /**
   * Whether selection is enabled.
   */
  private _enabled = true;

  private _mouseMoveListener: EventListener;
  private _mouseUpListener: EventListener;

  constructor(
    private _terminal: ITerminal,
    private _buffer: IBuffer,
    private _charMeasure: CharMeasure
  ) {
    super();
    this._initListeners();
    this.enable();

    this._model = new SelectionModel(_terminal);
    this._activeSelectionMode = SelectionMode.NORMAL;
  }

  /**
   * Initializes listener variables.
   */
  private _initListeners(): void {
    this._mouseMoveListener = event => this._onMouseMove(<MouseEvent>event);
    this._mouseUpListener = event => this._onMouseUp(<MouseEvent>event);

    // Only adjust the selection on trim, shiftElements is rarely used (only in
    // reverseIndex) and delete in a splice is only ever used when the same
    // number of elements was just added. Given this is could actually be
    // beneficial to leave the selection as is for these cases.
    this._buffer.lines.on('trim', (amount: number) => this._onTrim(amount));
  }

  /**
   * Disables the selection manager. This is useful for when terminal mouse
   * are enabled.
   */
  public disable(): void {
    this.clearSelection();
    this._enabled = false;
  }

  /**
   * Enable the selection manager.
   */
  public enable(): void {
    this._enabled = true;
  }

  /**
   * Sets the active buffer, this should be called when the alt buffer is
   * switched in or out.
   * @param buffer The active buffer.
   */
  public setBuffer(buffer: IBuffer): void {
    this._buffer = buffer;
    this.clearSelection();
  }

  public get selectionStart(): [number, number] { return this._model.finalSelectionStart; }
  public get selectionEnd(): [number, number] { return this._model.finalSelectionEnd; }

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
    result.push(this._buffer.translateBufferLineToString(start[1], true, start[0], startRowEndCol));

    // Get middle rows
    for (let i = start[1] + 1; i <= end[1] - 1; i++) {
      const bufferLine = this._buffer.lines.get(i);
      const lineText = this._buffer.translateBufferLineToString(i, true);
      if ((<any>bufferLine).isWrapped) {
        result[result.length - 1] += lineText;
      } else {
        result.push(lineText);
      }
    }

    // Get final row
    if (start[1] !== end[1]) {
      const bufferLine = this._buffer.lines.get(end[1]);
      const lineText = this._buffer.translateBufferLineToString(end[1], true, 0, end[0]);
      if ((<any>bufferLine).isWrapped) {
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
  private _onTrim(amount: number): void {
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
    const coords = this._terminal.mouseHelper.getCoords(event, this._terminal.element, this._charMeasure, this._terminal.options.lineHeight, this._terminal.cols, this._terminal.rows, true);
    if (!coords) {
      return null;
    }

    // Convert to 0-based
    coords[0]--;
    coords[1]--;

    // Convert viewport coords to buffer coords
    coords[1] += this._terminal.buffer.ydisp;
    return coords;
  }

  /**
   * Gets the amount the viewport should be scrolled based on how far out of the
   * terminal the mouse is.
   * @param event The mouse event.
   */
  private _getMouseEventScrollAmount(event: MouseEvent): number {
    let offset = MouseHelper.getCoordsRelativeToElement(event, this._terminal.element)[1];
    const terminalHeight = this._terminal.rows * Math.ceil(this._charMeasure.height * this._terminal.options.lineHeight);
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
   * Returns whether the selection manager should force selection, regardless of
   * whether the terminal is in mouse events mode.
   * @param event The mouse event.
   */
  public shouldForceSelection(event: MouseEvent): boolean {
    return Browser.isMac ? event.altKey : event.shiftKey;
  }

  /**
   * Handles te mousedown event, setting up for a new selection.
   * @param event The mousedown event.
   */
  public onMouseDown(event: MouseEvent): void {
    // If we have selection, we want the context menu on right click even if the
    // terminal is in mouse mode.
    if (event.button === 2 && this.hasSelection) {
      return;
    }

    // Only action the primary button
    if (event.button !== 0) {
      return;
    }

    // Allow selection when using a specific modifier key, even when disabled
    if (!this._enabled) {
      if (!this.shouldForceSelection(event)) {
        return;
      }

      // Don't send the mouse down event to the current process, we want to select
      event.stopPropagation();
    }

    // Tell the browser not to start a regular selection
    event.preventDefault();

    // Reset drag scroll state
    this._dragScrollAmount = 0;

    if (this._enabled && event.shiftKey) {
      this._onIncrementalClick(event);
    } else {
      if (event.detail === 1) {
        this._onSingleClick(event);
      } else if (event.detail === 2) {
        this._onDoubleClick(event);
      } else if (event.detail === 3) {
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
    this._terminal.element.ownerDocument.addEventListener('mousemove', this._mouseMoveListener);
    this._terminal.element.ownerDocument.addEventListener('mouseup', this._mouseUpListener);
    this._dragScrollIntervalTimer = setInterval(() => this._dragScroll(), DRAG_SCROLL_INTERVAL);
  }

  /**
   * Removes the listeners that are registered when mousedown is triggered.
   */
  private _removeMouseDownListeners(): void {
    this._terminal.element.ownerDocument.removeEventListener('mousemove', this._mouseMoveListener);
    this._terminal.element.ownerDocument.removeEventListener('mouseup', this._mouseUpListener);
    clearInterval(this._dragScrollIntervalTimer);
    this._dragScrollIntervalTimer = null;
  }

  /**
   * Performs an incremental click, setting the selection end position to the mouse
   * position.
   * @param event The mouse event.
   */
  private _onIncrementalClick(event: MouseEvent): void {
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

    // Initialize the new selection
    this._model.selectionStart = this._getMouseBufferCoords(event);
    if (!this._model.selectionStart) {
      return;
    }
    this._model.selectionEnd = null;

    // Ensure the line exists
    const line = this._buffer.lines.get(this._model.selectionStart[1]);
    if (!line) {
      return;
    }

    // Return early if the click event is not in the buffer (eg. in scroll bar)
    if (line.length >= this._model.selectionStart[0]) {
      return;
    }

    // If the mouse is over the second half of a wide character, adjust the
    // selection to cover the whole character
    const char = line[this._model.selectionStart[0]];
    if (char[CHAR_DATA_WIDTH_INDEX] === 0) {
      this._model.selectionStart[0]++;
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
   * Handles the mousemove event when the mouse button is down, recording the
   * end of the selection and refreshing the selection.
   * @param event The mousemove event.
   */
  private _onMouseMove(event: MouseEvent): void {
    // If the mousemove listener is active it means that a selection is
    // currently being made, we should stop propogation to prevent mouse events
    // to be sent to the pty.
    event.stopImmediatePropagation();

    // Record the previous position so we know whether to redraw the selection
    // at the end.
    const previousSelectionEnd = this._model.selectionEnd ? [this._model.selectionEnd[0], this._model.selectionEnd[1]] : null;

    // Set the initial selection end based on the mouse coordinates
    this._model.selectionEnd = this._getMouseBufferCoords(event);
    if (!this._model.selectionEnd) {
      this.refresh(true);
      return;
    }

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
    if (this._model.selectionEnd[1] < this._buffer.lines.length) {
      const char = this._buffer.lines.get(this._model.selectionEnd[1])[this._model.selectionEnd[0]];
      if (char && char[CHAR_DATA_WIDTH_INDEX] === 0) {
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
  private _dragScroll(): void {
    if (this._dragScrollAmount) {
      this._terminal.scrollDisp(this._dragScrollAmount, false);
      // Re-evaluate selection
      if (this._dragScrollAmount > 0) {
        this._model.selectionEnd = [this._terminal.cols - 1, this._terminal.buffer.ydisp + this._terminal.rows];
      } else {
        this._model.selectionEnd = [0, this._terminal.buffer.ydisp];
      }
      this.refresh();
    }
  }

  /**
   * Handles the mouseup event, removing the mousedown listeners.
   * @param event The mouseup event.
   */
  private _onMouseUp(event: MouseEvent): void {
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
      if (char[CHAR_DATA_WIDTH_INDEX] === 0) {
        // Wide characters aren't included in the line string so decrement the
        // index so the index is back on the wide character.
        charIndex--;
      } else if (char[CHAR_DATA_CHAR_INDEX].length > 1 && coords[0] !== i) {
        // Emojis take up multiple characters, so adjust accordingly. For these
        // we don't want ot include the character at the column as we're
        // returning the start index in the string, not the end index.
        charIndex += char[CHAR_DATA_CHAR_INDEX].length - 1;
      }
    }
    return charIndex;
  }

  public setSelection(col: number, row: number, length: number): void {
    this._model.clearSelection();
    this._removeMouseDownListeners();
    this._model.selectionStart = [col, row];
    this._model.selectionStartLength = length;
    this.refresh();
  }

  /**
   * Gets positional information for the word at the coordinated specified.
   * @param coords The coordinates to get the word at.
   */
  private _getWordAt(coords: [number, number]): IWordPosition {
    const bufferLine = this._buffer.lines.get(coords[1]);
    if (!bufferLine) {
      return null;
    }

    const line = this._buffer.translateBufferLineToString(coords[1], false);

    // Get actual index, taking into consideration wide characters
    let startIndex = this._convertViewportColToCharacterIndex(bufferLine, coords);
    let endIndex = startIndex;

    // Record offset to be used later
    const charOffset = coords[0] - startIndex;
    let leftWideCharCount = 0;
    let rightWideCharCount = 0;
    let leftLongCharOffset = 0;
    let rightLongCharOffset = 0;

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
      if (bufferLine[startCol][CHAR_DATA_WIDTH_INDEX] === 0) {
        leftWideCharCount++;
        startCol--;
      }
      if (bufferLine[endCol][CHAR_DATA_WIDTH_INDEX] === 2) {
        rightWideCharCount++;
        endCol++;
      }

      // Adjust the end index for characters whose length are > 1 (emojis)
      if (bufferLine[endCol][CHAR_DATA_CHAR_INDEX].length > 1) {
        rightLongCharOffset += bufferLine[endCol][CHAR_DATA_CHAR_INDEX].length - 1;
        endIndex += bufferLine[endCol][CHAR_DATA_CHAR_INDEX].length - 1;
      }

      // Expand the string in both directions until a space is hit
      while (startCol > 0 && startIndex > 0 && !this._isCharWordSeparator(bufferLine[startCol - 1])) {
        const char = bufferLine[startCol - 1];
        if (char[CHAR_DATA_WIDTH_INDEX] === 0) {
          // If the next character is a wide char, record it and skip the column
          leftWideCharCount++;
          startCol--;
        } else if (char[CHAR_DATA_CHAR_INDEX].length > 1) {
          // If the next character's string is longer than 1 char (eg. emoji),
          // adjust the index
          leftLongCharOffset += char[CHAR_DATA_CHAR_INDEX].length - 1;
          startIndex -= char[CHAR_DATA_CHAR_INDEX].length - 1;
        }
        startIndex--;
        startCol--;
      }
      while (endCol < bufferLine.length && endIndex + 1 < line.length && !this._isCharWordSeparator(bufferLine[endCol + 1])) {
        const char = bufferLine[endCol + 1];
        if (char[CHAR_DATA_WIDTH_INDEX] === 2) {
          // If the next character is a wide char, record it and skip the column
          rightWideCharCount++;
          endCol++;
        } else if (char[CHAR_DATA_CHAR_INDEX].length > 1) {
          // If the next character's string is longer than 1 char (eg. emoji),
          // adjust the index
          rightLongCharOffset += char[CHAR_DATA_CHAR_INDEX].length - 1;
          endIndex += char[CHAR_DATA_CHAR_INDEX].length - 1;
        }
        endIndex++;
        endCol++;
      }
    }

    // Incremenet the end index so it is at the start of the next character
    endIndex++;

    // Calculate the start _column_, converting the the string indexes back to
    // column coordinates.
    const start =
        startIndex // The index of the selection's start char in the line string
        + charOffset // The difference between the initial char's column and index
        - leftWideCharCount // The number of wide chars left of the initial char
        + leftLongCharOffset; // The number of additional chars left of the initial char added by columns with strings longer than 1 (emojis)

    // Calculate the length in _columns_, converting the the string indexes back
    // to column coordinates.
    const length = Math.min(this._terminal.cols, // Disallow lengths larger than the terminal cols
        endIndex // The index of the selection's end char in the line string
        - startIndex // The index of the selection's start char in the line string
        + leftWideCharCount // The number of wide chars left of the initial char
        + rightWideCharCount // The number of wide chars right of the initial char (inclusive)
        - leftLongCharOffset // The number of additional chars left of the initial char added by columns with strings longer than 1 (emojis)
        - rightLongCharOffset); // The number of additional chars right of the initial char (inclusive) added by columns with strings longer than 1 (emojis)

    return { start, length };
  }

  /**
   * Selects the word at the coordinates specified.
   * @param coords The coordinates to get the word at.
   */
  protected _selectWordAt(coords: [number, number]): void {
    const wordPosition = this._getWordAt(coords);
    if (wordPosition) {
      this._model.selectionStart = [wordPosition.start, coords[1]];
      this._model.selectionStartLength = wordPosition.length;
    }
  }

  /**
   * Sets the selection end to the word at the coordinated specified.
   * @param coords The coordinates to get the word at.
   */
  private _selectToWordAt(coords: [number, number]): void {
    const wordPosition = this._getWordAt(coords);
    if (wordPosition) {
      this._model.selectionEnd = [this._model.areSelectionValuesReversed() ? wordPosition.start : (wordPosition.start + wordPosition.length), coords[1]];
    }
  }

  /**
   * Gets whether the character is considered a word separator by the select
   * word logic.
   * @param char The character to check.
   */
  private _isCharWordSeparator(charData: CharData): boolean {
    // Zero width characters are never separators as they are always to the
    // right of wide characters
    if (charData[CHAR_DATA_WIDTH_INDEX] === 0) {
      return false;
    }
    return WORD_SEPARATORS.indexOf(charData[CHAR_DATA_CHAR_INDEX]) >= 0;
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
