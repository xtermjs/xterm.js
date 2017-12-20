/**
 * Copyright (c) 2017 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import { ITerminal, IBuffer, IDisposable } from './Interfaces';
import { isMac } from './utils/Browser';

const MAX_ROWS_TO_READ = 20;

export class AccessibilityManager implements IDisposable {
  private _accessibilityTreeRoot: HTMLElement;
  private _rowContainer: HTMLElement;
  private _rowElements: HTMLElement[] = [];
  private _liveRegion: HTMLElement;
  private _liveRegionLineCount: number = 0;

  private _disposables: IDisposable[] = [];

  /**
   * This queue has a character pushed to it for keys that are pressed, if the
   * next character added to the terminal is equal to the key char then it is
   * not announced (added to live region) because it has already been announced
   * by the textarea event (which cannot be canceled). There are some race
   * condition cases if there is typing while data is streaming, but this covers
   * the main case of typing into the prompt and inputting the answer to a
   * question (Y/N, etc.).
   */
  private _charsToConsume: string[] = [];

  constructor(private _terminal: ITerminal) {
    this._accessibilityTreeRoot = document.createElement('div');
    this._accessibilityTreeRoot.classList.add('accessibility');
    this._rowContainer = document.createElement('div');
    this._rowContainer.classList.add('accessibility-tree');
    for (let i = 0; i < this._terminal.rows; i++) {
      this._rowElements[i] = document.createElement('div');
      this._rowContainer.appendChild(this._rowElements[i]);
    }
    this._accessibilityTreeRoot.appendChild(this._rowContainer);

    this._liveRegion = document.createElement('div');
    this._liveRegion.classList.add('live-region');
    this._liveRegion.setAttribute('aria-live', 'polite');
    this._accessibilityTreeRoot.appendChild(this._liveRegion);

    this._terminal.element.appendChild(this._accessibilityTreeRoot);

    this._addTerminalEventListener('resize', data => this._onResize(data.cols, data.rows));
    this._addTerminalEventListener('refresh', data => this._refreshRows(data.start, data.end));
    // Line feed is an issue as the prompt won't be read out after a command is run
    this._addTerminalEventListener('a11y.char', (char) => this._onChar(char));
    this._addTerminalEventListener('lineFeed', () => this._onChar('\n'));
    // Ensure \t is covered, if not a line of output from `ls` is read as one word
    this._addTerminalEventListener('a11y.tab', () => this._onChar(' '));
    this._addTerminalEventListener('charsizechanged', () => this._refreshRowsDimensions());
    this._addTerminalEventListener('key', keyChar => this._onKey(keyChar));
    this._addTerminalEventListener('blur', () => this._clearLiveRegion());
    // TODO: Dispose of this listener when disposed
    // TODO: Only refresh when devicePixelRatio changed
    window.addEventListener('resize', () => this._refreshRowsDimensions());
  }

  private _addTerminalEventListener(type: string, listener: (...args: any[]) => any): void {
    this._terminal.on(type, listener);
    this._disposables.push({
      dispose: () => {
        this._terminal.off(type, listener);
      }
    });
  }

  public dispose(): void {
    this._terminal.element.removeChild(this._accessibilityTreeRoot);
    this._accessibilityTreeRoot = null;
    this._rowContainer = null;
    this._liveRegion = null;
    this._rowContainer = null;
    this._rowElements = null;
    this._disposables.forEach(d => d.dispose());
    this._disposables = null;
  }

  private _onResize(cols: number, rows: number): void {
    // Grow rows as required
    for (let i = this._rowContainer.children.length; i < this._terminal.rows; i++) {
      this._rowElements[i] = document.createElement('div');
      this._rowContainer.appendChild(this._rowElements[i]);
    }
    // Shrink rows as required
    while (this._rowElements.length > rows) {
      this._rowContainer.removeChild(this._rowElements.pop());
    }

    this._refreshRowsDimensions();
  }

  private _onChar(char: string): void {
    if (this._liveRegionLineCount < MAX_ROWS_TO_READ + 1) {
      if (this._charsToConsume.length > 0) {
        // Have the screen reader ignore the char if it was just input
        if (this._charsToConsume.shift() !== char) {
          this._liveRegion.textContent += char;
        }
      } else {
        this._liveRegion.textContent += char;
      }

      if (char === '\n') {
        this._liveRegionLineCount++;
        if (this._liveRegionLineCount === MAX_ROWS_TO_READ + 1) {
          // TODO: Enable localization
          this._liveRegion.textContent += 'Too much output to announce, navigate to rows manually to read';
        }
      }

      // Only detach/attach on mac as otherwise messages can go unaccounced
      if (isMac) {
        if (this._liveRegion.textContent.length > 0 && !this._liveRegion.parentNode) {
          this._accessibilityTreeRoot.appendChild(this._liveRegion);
        }
      }
    }

    // This is temporary, should refresh at a much slower rate
    this._refreshRows();
  }

  private _clearLiveRegion(): void {
    this._liveRegion.textContent = '';
    this._liveRegionLineCount = 0;

    // Only detach/attach on mac as otherwise messages can go unaccounced
    if (isMac) {
      if (this._liveRegion.parentNode) {
        this._accessibilityTreeRoot.removeChild(this._liveRegion);
      }
    }
  }

  private _onKey(keyChar: string): void {
    this._clearLiveRegion();
    this._charsToConsume.push(keyChar);
  }

  // TODO: Hook up to refresh when the renderer refreshes the range? Slower to prevent layout thrashing?
  private _refreshRows(start?: number, end?: number): void {
    const buffer: IBuffer = (<any>this._terminal.buffer);
    start = start || 0;
    end = end || this._terminal.rows - 1;
    for (let i = start; i <= end; i++) {
      const lineData = buffer.translateBufferLineToString(buffer.ybase + i, true);
      this._rowElements[i].textContent = lineData;
    }
  }

  private _refreshRowsDimensions(): void {
    const buffer: IBuffer = (<any>this._terminal.buffer);
    const dimensions = this._terminal.renderer.dimensions;
    for (let i = 0; i < this._terminal.rows; i++) {
      this._rowElements[i].style.height = `${dimensions.actualCellHeight}px`;
    }
    // TODO: Verify it works on macOS and varying zoom levels
    // TODO: Fire when window resizes
  }
}
