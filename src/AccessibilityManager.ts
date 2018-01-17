/**
 * Copyright (c) 2017 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import { ITerminal, IBuffer, IDisposable } from './Interfaces';
import { isMac } from './utils/Browser';
import { RenderDebouncer } from './utils/RenderDebouncer';
import { addDisposableListener } from './utils/Dom';

const MAX_ROWS_TO_READ = 20;
const ACTIVE_ITEM_ID_PREFIX = 'xterm-active-item-';

export class AccessibilityManager implements IDisposable {
  private _accessibilityTreeRoot: HTMLElement;
  private _rowContainer: HTMLElement;
  private _rowElements: HTMLElement[] = [];
  private _liveRegion: HTMLElement;
  private _liveRegionLineCount: number = 0;

  private _renderRowsDebouncer: RenderDebouncer;
  private _navigationMode: NavigationMode;

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
    this._accessibilityTreeRoot.classList.add('xterm-accessibility');
    this._rowContainer = document.createElement('div');
    this._rowContainer.classList.add('xterm-accessibility-tree');
    for (let i = 0; i < this._terminal.rows; i++) {
      this._rowElements[i] = this._createAccessibilityTreeNode();
      this._rowContainer.appendChild(this._rowElements[i]);
    }
    this._refreshRowsDimensions();
    this._accessibilityTreeRoot.appendChild(this._rowContainer);

    this._renderRowsDebouncer = new RenderDebouncer(this._terminal, this._renderRows.bind(this));
    this._refreshRows();

    this._navigationMode = new NavigationMode(this._terminal, this._rowContainer, this._rowElements, this);

    this._liveRegion = document.createElement('div');
    this._liveRegion.classList.add('live-region');
    this._liveRegion.setAttribute('aria-live', 'assertive');
    this._accessibilityTreeRoot.appendChild(this._liveRegion);

    this._terminal.element.appendChild(this._accessibilityTreeRoot);

    this._disposables.push(this._renderRowsDebouncer);
    this._disposables.push(this._navigationMode);
    this._disposables.push(this._terminal.addDisposableListener('resize', data => this._onResize(data.cols, data.rows)));
    this._disposables.push(this._terminal.addDisposableListener('refresh', data => this._refreshRows(data.start, data.end)));
    this._disposables.push(this._terminal.addDisposableListener('scroll', data => this._refreshRows()));
    // Line feed is an issue as the prompt won't be read out after a command is run
    this._disposables.push(this._terminal.addDisposableListener('a11y.char', (char) => this._onChar(char)));
    this._disposables.push(this._terminal.addDisposableListener('linefeed', () => this._onChar('\n')));
    this._disposables.push(this._terminal.addDisposableListener('a11y.tab', spaceCount => this._onTab(spaceCount)));
    this._disposables.push(this._terminal.addDisposableListener('charsizechanged', () => this._refreshRowsDimensions()));
    this._disposables.push(this._terminal.addDisposableListener('key', keyChar => this._onKey(keyChar)));
    this._disposables.push(this._terminal.addDisposableListener('blur', () => this._clearLiveRegion()));
    // TODO: Maybe renderer should fire an event on terminal when the characters change and that
    //       should be listened to instead? That would mean that the order of events are always
    //       guarenteed
    this._disposables.push(this._terminal.addDisposableListener('dprchange', () => this._refreshRowsDimensions()));
    // This shouldn't be needed on modern browsers but is present in case the
    // media query that drives the dprchange event isn't supported
    this._disposables.push(addDisposableListener(window, 'resize', () => this._refreshRowsDimensions()));
  }

  public dispose(): void {
    this._terminal.element.removeChild(this._accessibilityTreeRoot);
    this._disposables.forEach(d => d.dispose());
    this._disposables = null;
    this._accessibilityTreeRoot = null;
    this._rowContainer = null;
    this._liveRegion = null;
    this._rowContainer = null;
    this._rowElements = null;
  }

  public get isNavigationModeActive(): boolean {
    return this._navigationMode.isActive;
  }

  public enterNavigationMode(): void {
    this._navigationMode.enter();
  }

  private _onResize(cols: number, rows: number): void {
    // Grow rows as required
    for (let i = this._rowContainer.children.length; i < this._terminal.rows; i++) {
      this._rowElements[i] = this._createAccessibilityTreeNode();
      this._rowContainer.appendChild(this._rowElements[i]);
    }
    // Shrink rows as required
    while (this._rowElements.length > rows) {
      this._rowContainer.removeChild(this._rowElements.pop());
    }

    this._refreshRowsDimensions();
  }

  private _createAccessibilityTreeNode(): HTMLElement {
    const element = document.createElement('div');
    element.setAttribute('role', 'menuitem');
    return element;
  }

  private _onTab(spaceCount: number): void {
    for (let i = 0; i < spaceCount; i++) {
      this._onChar(' ');
    }
  }

  private _onChar(char: string): void {
    if (this._liveRegionLineCount < MAX_ROWS_TO_READ + 1) {
      if (this._charsToConsume.length > 0) {
        // Have the screen reader ignore the char if it was just input
        const shiftedChar = this._charsToConsume.shift();
        if (shiftedChar !== char) {
          if (char === ' ') {
            // Always use nbsp for spaces in order to preserve the space between characters in
            // voiceover's caption window
            this._liveRegion.innerHTML += '&nbsp;';
          } else {
            this._liveRegion.textContent += char;
          }
        }
      } else {
        if (char === ' ') {
          this._liveRegion.innerHTML += '&nbsp;';
        } else
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
          setTimeout(() => {
            this._accessibilityTreeRoot.appendChild(this._liveRegion);
          }, 0);
        }
      }
    }
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

  private _refreshRows(start?: number, end?: number): void {
    this._renderRowsDebouncer.refresh(start, end);
  }

  private _renderRows(start: number, end: number): void {
    const buffer: IBuffer = (<any>this._terminal.buffer);
    const setSize = (buffer.lines.length).toString();
    for (let i = start; i <= end; i++) {
      const lineData = buffer.translateBufferLineToString(buffer.ydisp + i, true);
      this._rowElements[i].textContent = lineData;
      const posInSet = (buffer.ydisp + i + 1).toString();
      this._rowElements[i].setAttribute('aria-posinset', posInSet);
      this._rowElements[i].setAttribute('aria-setsize', setSize);
    }
  }

  public rotateRows(): void {
    this._rowContainer.removeChild(this._rowElements.shift());
    const newRowIndex = this._rowElements.length;
    this._rowElements[newRowIndex] = this._createAccessibilityTreeNode();
    this._rowContainer.appendChild(this._rowElements[newRowIndex]);
    this._refreshRowsDimensions();
  }

  private _refreshRowsDimensions(): void {
    const buffer: IBuffer = (<any>this._terminal.buffer);
    const dimensions = this._terminal.renderer.dimensions;
    for (let i = 0; i < this._terminal.rows; i++) {
      this._rowElements[i].style.height = `${dimensions.actualCellHeight}px`;
    }
  }

  public announce(text: string): void {
    this._clearLiveRegion();
    this._liveRegion.textContent = text;
  }
}

class NavigationMode implements IDisposable {
  private _activeItemId: string;
  private _isNavigationModeActive: boolean = false;
  private _absoluteFocusedRow: number;
  private _focusedElement: HTMLElement;

  private _disposables: IDisposable[] = [];

  constructor(
    private _terminal: ITerminal,
    private _rowContainer: HTMLElement,
    private _rowElements: HTMLElement[],
    private _accessibilityManager: AccessibilityManager
  ) {
    this._activeItemId = ACTIVE_ITEM_ID_PREFIX + Math.floor((Math.random() * 100000));

    this._disposables.push(addDisposableListener(this._rowContainer, 'keyup', e => {
      if (this.isActive) {
        return this.onKeyUp(e);
      }
      return false;
    }));
    this._disposables.push(addDisposableListener(this._rowContainer, 'keydown', e => {
      if (this.isActive) {
        return this.onKeyDown(e);
      }
      return false;
    }));
  }

  public dispose(): void {
    this._disposables.forEach(d => d.dispose());
    this._disposables = null;
  }

  public enter(): void {
    // TODO: Should entering navigation mode send ydisp to ybase?
    this._isNavigationModeActive = true;
    this._accessibilityManager.announce('Entered line navigation mode');
    this._rowContainer.tabIndex = 0;
    this._rowContainer.setAttribute('role', 'menu');
    this._rowContainer.setAttribute('aria-activedescendant', this._activeItemId);
    this._rowContainer.focus();
    this._navigateToElement(this._terminal.buffer.ydisp + this._terminal.buffer.y);
  }

  public leave(): void {
    this._isNavigationModeActive = false;
    this._accessibilityManager.announce('Left line navigation mode');
    this._rowContainer.removeAttribute('tabindex');
    this._rowContainer.removeAttribute('aria-activedescendant');
    this._rowContainer.removeAttribute('role');
    if (this._focusedElement) {
      this._focusedElement.removeAttribute('id');
    }
    this._terminal.textarea.focus();
  }

  public get isActive(): boolean {
    return this._isNavigationModeActive;
  }

  public onKeyDown(e: KeyboardEvent): boolean {
    return this._onKey(e, e => {
      if (this._isNavigationModeActive) {
        return true;
      }
      return false;
    });
  }

  public onKeyUp(e: KeyboardEvent): boolean {
    return this._onKey(e, e => {
      if (this._isNavigationModeActive) {
        switch (e.keyCode) {
          case 27: return this._onEscape(e);
          case 33: return this._onPageUp(e);
          case 34: return this._onPageDown(e);
          case 35: return this._onEnd(e);
          case 36: return this._onHome(e);
          case 38: return this._onArrowUp(e);
          case 40: return this._onArrowDown(e);
        }
      }
      return false;
    });
  }

  private _onKey(e: KeyboardEvent, handler: (e: KeyboardEvent) => boolean): boolean {
    if (handler && handler(e)) {
      e.preventDefault();
      e.stopPropagation();
      return true;
    }
    return false;
  }

  private _onEscape(e: KeyboardEvent): boolean {
    this.leave();
    return true;
  }

  private _onArrowUp(e: KeyboardEvent): boolean {
    return this._focusRow(this._absoluteFocusedRow - 1);
  }

  private _onArrowDown(e: KeyboardEvent): boolean {
    return this._focusRow(this._absoluteFocusedRow + 1);
  }

  private _onPageUp(e: KeyboardEvent): boolean {
    return this._focusRow(this._absoluteFocusedRow - this._terminal.rows);
  }

  private _onPageDown(e: KeyboardEvent): boolean {
    return this._focusRow(this._absoluteFocusedRow + this._terminal.rows);
  }

  private _onHome(e: KeyboardEvent): boolean {
    return this._focusRow(0);
  }

  private _onEnd(e: KeyboardEvent): boolean {
    return this._focusRow(this._terminal.buffer.lines.length - 1);
  }

  private _focusRow(row: number): boolean {
    this._navigateToElement(row);
    this._rowContainer.focus();
    return true;
  }

  private _navigateToElement(absoluteRow: number): void {
    if (absoluteRow < this._terminal.buffer.ydisp || absoluteRow >= this._terminal.buffer.ydisp + this._terminal.rows) {
      // Rotate rows to ensure the next focused item is read out correctly
      this._accessibilityManager.rotateRows();
    }

    absoluteRow = this._terminal.scrollToRow(absoluteRow);

    if (this._focusedElement) {
      this._focusedElement.removeAttribute('id');
    }
    this._absoluteFocusedRow = absoluteRow;
    this._focusedElement = this._rowElements[absoluteRow - this._terminal.buffer.ydisp];
    this._focusedElement.id = this._activeItemId;
  }
}
