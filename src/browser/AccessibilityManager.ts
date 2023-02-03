/**
 * Copyright (c) 2017 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import * as Strings from 'browser/LocalizableStrings';
import { ITerminal, IRenderDebouncer } from 'browser/Types';
import { isMac } from 'common/Platform';
import { TimeBasedDebouncer } from 'browser/TimeBasedDebouncer';
import { Disposable, toDisposable } from 'common/Lifecycle';

const MAX_ROWS_TO_READ = 20;

export class AccessibilityManager extends Disposable {
  private _accessibilityContainer: HTMLElement;

  private _liveRegion: HTMLElement;
  private _liveRegionLineCount: number = 0;
  private _liveRegionDebouncer: IRenderDebouncer;

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

  private _charsToAnnounce: string = '';

  constructor(
    private readonly _terminal: ITerminal
  ) {
    super();
    this._accessibilityContainer = document.createElement('div');
    this._accessibilityContainer.classList.add('xterm-accessibility');

    this._liveRegion = document.createElement('div');
    this._liveRegion.classList.add('live-region');
    this._liveRegion.setAttribute('aria-live', 'assertive');
    this._accessibilityContainer.appendChild(this._liveRegion);
    this._liveRegionDebouncer = this.register(new TimeBasedDebouncer(this._announceCharacters.bind(this)));

    if (!this._terminal.element) {
      throw new Error('Cannot enable accessibility before Terminal.open');
    }
    this._terminal.element.insertAdjacentElement('afterbegin', this._accessibilityContainer);

    this.register(this._liveRegionDebouncer);
    this.register(this._terminal.onRender(e => this._refreshRows(e.start, e.end)));
    this.register(this._terminal.onScroll(() => this._refreshRows()));
    // Line feed is an issue as the prompt won't be read out after a command is run
    this.register(this._terminal.onA11yChar(char => this._handleChar(char)));
    this.register(this._terminal.onLineFeed(() => this._handleChar('\n')));
    this.register(this._terminal.onA11yTab(spaceCount => this._handleTab(spaceCount)));
    this.register(this._terminal.onKey(e => this._handleKey(e.key)));
    this.register(this._terminal.onBlur(() => this._clearLiveRegion()));
    this.register(toDisposable(() => this._accessibilityContainer.remove()));
  }

  private _handleTab(spaceCount: number): void {
    for (let i = 0; i < spaceCount; i++) {
      this._handleChar(' ');
    }
  }

  private _handleChar(char: string): void {
    if (this._liveRegionLineCount < MAX_ROWS_TO_READ + 1) {
      if (this._charsToConsume.length > 0) {
        // Have the screen reader ignore the char if it was just input
        const shiftedChar = this._charsToConsume.shift();
        if (shiftedChar !== char) {
          this._charsToAnnounce += char;
        }
      } else {
        this._charsToAnnounce += char;
      }

      if (char === '\n') {
        this._liveRegionLineCount++;
        if (this._liveRegionLineCount === MAX_ROWS_TO_READ + 1) {
          this._liveRegion.textContent += Strings.tooMuchOutput;
        }
      }

      // Only detach/attach on mac as otherwise messages can go unaccounced
      if (isMac) {
        if (this._liveRegion.textContent && this._liveRegion.textContent.length > 0 && !this._liveRegion.parentNode) {
          setTimeout(() => {
            this._accessibilityContainer.appendChild(this._liveRegion);
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
      this._liveRegion.remove();
    }
  }

  private _handleKey(keyChar: string): void {
    this._clearLiveRegion();
    // Only add the char if there is no control character.
    if (!/\p{Control}/u.test(keyChar)) {
      this._charsToConsume.push(keyChar);
    }
  }

  private _refreshRows(start?: number, end?: number): void {
    this._liveRegionDebouncer.refresh(start, end, this._terminal.rows);
  }

  private _announceCharacters(): void {
    if (this._charsToAnnounce.length === 0) {
      return;
    }
    this._liveRegion.textContent += this._charsToAnnounce;
    this._charsToAnnounce = '';
  }
}
