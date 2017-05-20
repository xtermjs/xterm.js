/**
 * @license MIT
 */

import { CharMeasure } from './utils/CharMeasure';
import { CircularList } from './utils/CircularList';
import { EventEmitter } from './EventEmitter';
import * as Mouse from './utils/Mouse';
import { ITerminal } from './Interfaces';

export class SelectionManager extends EventEmitter {
  // TODO: Create a SelectionModel
  private _selectionStart: [number, number];
  private _selectionEnd: [number, number];

  private _mouseMoveListener: EventListener;

  constructor(
    private _terminal: ITerminal,
    private _buffer: CircularList<any>,
    private _rowContainer: HTMLElement,
    private _selectionContainer: HTMLElement,
    private _charMeasure: CharMeasure
  ) {
    super();
    this._attachListeners();
  }

  private _attachListeners() {
    this._mouseMoveListener = event => this._onMouseMove(<MouseEvent>event);

    this._buffer.on('trim', amount => this._onTrim(amount));
    this._rowContainer.addEventListener('mousedown', event => this._onMouseDown(event));
    this._rowContainer.addEventListener('mouseup', event => this._onMouseUp(event));
    this._rowContainer.addEventListener('dblclick', event => this._onDblclick(event));
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
    endCol = endCol || line.length
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
    this._selectionStart[0] -= amount;
    this._selectionEnd[0] -= amount;

    // The selection has moved off the buffer, clear it.
    if (this._selectionEnd[0] < 0) {
      this._selectionStart = null;
      this._selectionEnd = null;
      this.refresh();
      return;
    }

    // If the selection start is trimmed, ensure the start column is 0.
    if (this._selectionStart[0] < 0) {
      this._selectionStart[1] = 0;
    }
  }

  // TODO: Handle splice/shiftElements in the buffer (just clear the selection?)

  private _getMouseBufferCoords(event: MouseEvent) {
    const coords = Mouse.getCoords(event, this._rowContainer, this._charMeasure);
    // Convert to 0-based
    coords[0]--;
    coords[1]--;
    // Convert viewport coords to buffer coords
    coords[1] += this._terminal.ydisp;
    return coords;
  }

  /**
   * Handles te mousedown event, setting up for a new selection.
   * @param event The mousedown event.
   */
  private _onMouseDown(event: MouseEvent) {
    this._selectionStart = this._getMouseBufferCoords(event);
    if (this._selectionStart) {
      this._selectionEnd = null;
      this._rowContainer.addEventListener('mousemove', this._mouseMoveListener);
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
    // TODO: Only draw here if the selection changes
    this.refresh();
  }

  /**
   * Handles the mouseup event, removing the mousemove listener when
   * appropriate.
   * @param event The mouseup event.
   */
  private _onMouseUp(event: MouseEvent) {
    if (!this._selectionStart) {
      return;
    }
    this._rowContainer.removeEventListener('mousemove', this._mouseMoveListener);
  }

  private _onDblclick(event: MouseEvent) {
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
