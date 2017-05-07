/**
 * @module xterm/utils/CharMeasure
 * @license MIT
 */

import { EventEmitter } from '../EventEmitter.js';

/**
 * Utility class that measures the size of a character.
 */
export class CharMeasure extends EventEmitter {
  private _document: Document;
  private _parentElement: HTMLElement;
  private _measureElement: HTMLElement;
  private _width: number;
  private _height: number;

  constructor(document: Document, parentElement: HTMLElement) {
    super();
    this._document = document;
    this._parentElement = parentElement;
  }

  public get width(): number {
    return this._width;
  }

  public get height(): number {
    return this._height;
  }

  public measure(): void {
    if (!this._measureElement) {
      this._measureElement = this._document.createElement('span');
      this._measureElement.style.position = 'absolute';
      this._measureElement.style.top = '0';
      this._measureElement.style.left = '-9999em';
      this._measureElement.textContent = 'W';
      this._measureElement.setAttribute('aria-hidden', 'true');
      this._parentElement.appendChild(this._measureElement);
      // Perform _doMeasure async if the element was just attached as sometimes
      // getBoundingClientRect does not return accurate values without this.
      setTimeout(() => this._doMeasure(), 0);
    } else {
      this._doMeasure();
    }
  }

  private _doMeasure(): void {
    const geometry = this._measureElement.getBoundingClientRect();
    // The element is likely currently display:none, we should retain the
    // previous value.
    if (geometry.width === 0 || geometry.height === 0) {
      return;
    }
    if (this._width !== geometry.width || this._height !== geometry.height) {
      this._width = geometry.width;
      this._height = geometry.height;
      this.emit('charsizechanged');
    }
  }
}
