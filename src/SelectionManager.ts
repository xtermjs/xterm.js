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
    console.log('trimmed: ' + amount);
  }

  private _onMouseDown(event: MouseEvent) {
    this._selectionStart = Mouse.getCoords(event, this._rowContainer, this._charMeasure);
    if (this._selectionStart) {
      this._rowContainer.addEventListener('mousemove', this._mouseMoveListener);
    }
  }

  private _onMouseMove(event: MouseEvent) {
    this._selectionEnd = Mouse.getCoords(event, this._rowContainer, this._charMeasure);
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
