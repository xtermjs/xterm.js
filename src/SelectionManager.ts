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
  }

  public get selectionText(): string {
    if (!this._selectionStart || !this._selectionEnd) {
      return null;
    }
    return '';
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
    // TODO: Somehow map the selection coordinates with the list that is constantly being trimmed
    //       Maybe we need an ID in the CircularList that starts from 0 for the first entry and increments
    console.log('trimmed: ' + amount);

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

    // Maybe SelectionManager could maintain it's own ID concept from 0 (top of
    // buffer) to n (size of buffer). On trim just increment the selection if
    // necessary. This would reduce complexity and potentially not need the
  }

  private _getMouseBufferCoords(event: MouseEvent) {
    const coords = Mouse.getCoords(event, this._rowContainer, this._charMeasure);
    // Convert to 0-based
    coords[0]--;
    coords[1]--;
    // Convert viewport coords to buffer coords
    coords[1] += this._terminal.ydisp;
    return coords;
  }

  private _onMouseDown(event: MouseEvent) {
    this._selectionStart = this._getMouseBufferCoords(event);
    if (this._selectionStart) {
      this._selectionEnd = null;
      this._rowContainer.addEventListener('mousemove', this._mouseMoveListener);
      this.refresh();
    }
  }

  private _onMouseMove(event: MouseEvent) {
    this._selectionEnd = this._getMouseBufferCoords(event);
    // TODO: Only draw here if the selection changes
    this.refresh();
  }

  private _onMouseUp(event: MouseEvent) {
    console.log('mouseup');
    console.log('start', this._selectionStart);
    console.log('end', this._selectionEnd);
    if (!this._selectionStart) {
      return;
    }
    this._rowContainer.removeEventListener('mousemove', this._mouseMoveListener);
  }
}
