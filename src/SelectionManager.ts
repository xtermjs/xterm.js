/**
 * @license MIT
 */

import { CharMeasure } from './utils/CharMeasure';
import { CircularList } from './utils/CircularList';
import * as Mouse from './utils/Mouse';

export class SelectionManager {
  private _selectionStart: [number, number];
  private _selectionEnd: [number, number];

  private _buffer: CircularList<any>;
  private _rowContainer: HTMLElement;
  private _charMeasure: CharMeasure;

  private _mouseMoveListener: EventListener;

  constructor(buffer: CircularList<any>, rowContainer: HTMLElement, charMeasure: CharMeasure) {
    this._rowContainer = rowContainer;
    this._buffer = buffer;
    this._charMeasure = charMeasure;
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

  private _onTrim(amount: number) {
    // TODO: Somehow map the selection coordinates with the list that is constantly being trimmed
    //       Maybe we need an ID in the CircularList that starts from 0 for the first entry and increments
    console.log('trimmed: ' + amount);
  }

  private _getMouseBufferCoords(event: MouseEvent) {
    // TODO: Take into account the current terminal viewport when fetching coordinates
    return Mouse.getCoords(event, this._rowContainer, this._charMeasure);
  }

  private _onMouseDown(event: MouseEvent) {
    this._selectionStart = this._getMouseBufferCoords(event);
    if (this._selectionStart) {
      this._rowContainer.addEventListener('mousemove', this._mouseMoveListener);
    }
  }

  private _onMouseMove(event: MouseEvent) {
    this._selectionEnd = this._getMouseBufferCoords(event);
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
