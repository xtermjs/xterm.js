/**
 * Copyright (c) 2016 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import { EventEmitter } from '../EventEmitter';
import { ICharMeasure, ITerminal, ITerminalOptions } from '../Interfaces';

/**
 * Utility class that measures the size of a character. Measurements are done in
 * the DOM rather than with a canvas context because support for extracting the
 * height of characters is patchy across browsers.
 */
export class CharMeasure extends EventEmitter implements ICharMeasure {
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

  public measure(options: ITerminalOptions): void {
    if (!this._measureElement) {
      this._measureElement = this._document.createElement('span');
      this._measureElement.style.position = 'absolute';
      this._measureElement.style.top = '0';
      this._measureElement.style.left = '-9999em';
      this._measureElement.style.lineHeight = 'normal';
      this._measureElement.textContent = 'W';
      this._measureElement.setAttribute('aria-hidden', 'true');
      this._parentElement.appendChild(this._measureElement);
      // Perform _doMeasure async if the element was just attached as sometimes
      // getBoundingClientRect does not return accurate values without this.
      setTimeout(() => this._doMeasure(options), 0);
    } else {
      this._doMeasure(options);
    }
  }

  private _doMeasure(options: ITerminalOptions): void {
    this._measureElement.style.fontFamily = options.fontFamily;
    this._measureElement.style.fontSize = `${options.fontSize}px`;
    const geometry = this._measureElement.getBoundingClientRect();
    // The element is likely currently display:none, we should retain the
    // previous value.
    if (geometry.width === 0 || geometry.height === 0) {
      return;
    }
    if (this._width !== geometry.width || this._height !== geometry.height) {
      this._width = geometry.width;
      this._height = Math.ceil(geometry.height);
      this.emit('charsizechanged');
    }
  }
}
