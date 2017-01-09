/**
 * @module xterm/utils/CharMeasure
 * @license MIT
 */

import { EventEmitter } from '../EventEmitter.js';

/**
 * Utility class that measures the size of a character.
 */
export class CharMeasure extends EventEmitter {
  private _parentElement: HTMLElement;
  private _measureElement: HTMLElement;
  private _width: number;
  private _height: number;

  constructor(parentElement: HTMLElement) {
    super();
    this._parentElement = parentElement;
  }

  public get width(): number {
    return this._width;
  }

  public get height(): number {
    return this._height;
  }

  public measure(): void {
    const oldWidth = this._width;
    const oldHeight = this._height;

    if (!this._measureElement) {
      this._measureElement = document.createElement('span');
      this._measureElement.style.position = 'absolute';
      this._measureElement.style.top = '0';
      this._measureElement.style.left = '-9999em';
      this._measureElement.textContent = 'W';
    }

    this._parentElement.appendChild(this._measureElement);
    const geometry = this._measureElement.getBoundingClientRect();
    this._width = geometry.width;
    this._height = geometry.height;
    this._parentElement.removeChild(this._measureElement);

    if (this._width !== oldWidth || this._height !== oldHeight) {
      this.emit('charsizechanged');
    }
  }
}
