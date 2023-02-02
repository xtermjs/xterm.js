/**
 * Copyright (c) 2017 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import * as Strings from 'browser/LocalizableStrings';
import { ITerminal, IRenderDebouncer, ReadonlyColorSet } from 'browser/Types';
import { isMac } from 'common/Platform';
import { TimeBasedDebouncer } from 'browser/TimeBasedDebouncer';
import { addDisposableDomListener } from 'browser/Lifecycle';
import { Disposable, toDisposable } from 'common/Lifecycle';
import { IRenderService, IThemeService } from 'browser/services/Services';
import { IOptionsService } from 'common/services/Services';
import { ITerminalOptions } from 'xterm';

const MAX_ROWS_TO_READ = 20;

export class AccessibilityManager extends Disposable {
  private _accessibilityContainer: HTMLElement;
  private _liveRegion: HTMLElement;
  private _liveRegionLineCount: number = 0;
  private _accessiblityBuffer: HTMLElement;

  private _renderRowsDebouncer: IRenderDebouncer;

  private _isAccessibilityBufferActive: boolean = false;
  public get isAccessibilityBufferActive(): boolean { return this._isAccessibilityBufferActive; }

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
    private readonly _terminal: ITerminal,
    @IOptionsService optionsService: IOptionsService,
    @IRenderService private readonly _renderService: IRenderService,
    @IThemeService themeService: IThemeService
  ) {
    super();
    this._accessibilityContainer = document.createElement('div');
    this._accessibilityContainer.classList.add('xterm-accessibility');

    this._liveRegion = document.createElement('div');
    this._liveRegion.classList.add('live-region');
    this._liveRegion.setAttribute('aria-live', 'assertive');
    this._accessibilityContainer.appendChild(this._liveRegion);
    this._renderRowsDebouncer = this.register(new TimeBasedDebouncer(this._announceCharacters.bind(this)));

    if (!this._terminal.element) {
      throw new Error('Cannot enable accessibility before Terminal.open');
    }
    this._terminal.element.insertAdjacentElement('afterbegin', this._accessibilityContainer);

    this._accessiblityBuffer = document.createElement('div');
    this._accessiblityBuffer.setAttribute('role', 'document');
    this._accessiblityBuffer.ariaRoleDescription = Strings.accessibilityBuffer;
    this._accessiblityBuffer.tabIndex = 0;
    this._accessibilityContainer.appendChild(this._accessiblityBuffer);
    this._accessiblityBuffer.classList.add('xterm-accessibility-buffer');
    this.register(addDisposableDomListener(this._accessiblityBuffer, 'keydown', (ev: KeyboardEvent) => {
      if (ev.key === 'Tab') {
        this._isAccessibilityBufferActive = false;
      }}
    ));
    this.register(addDisposableDomListener(this._accessiblityBuffer, 'focus',() => this._refreshAccessibilityBuffer()));
    this.register(addDisposableDomListener(this._accessiblityBuffer, 'focusout',() => {
      this._isAccessibilityBufferActive = false;
    }));


    this.register(this._renderRowsDebouncer);
    this.register(this._terminal.onRender(e => this._refreshRows(e.start, e.end)));
    this.register(this._terminal.onScroll(() => this._refreshRows()));
    // Line feed is an issue as the prompt won't be read out after a command is run
    this.register(this._terminal.onA11yChar(char => this._handleChar(char)));
    this.register(this._terminal.onLineFeed(() => this._handleChar('\n')));
    this.register(this._terminal.onA11yTab(spaceCount => this._handleTab(spaceCount)));
    this.register(this._terminal.onKey(e => this._handleKey(e.key)));
    this.register(this._terminal.onBlur(() => this._clearLiveRegion()));

    this._handleColorChange(themeService.colors);
    this.register(themeService.onChangeColors(e => this._handleColorChange(e)));
    this._handleFontOptionChange(optionsService.options);
    this.register(optionsService.onMultipleOptionChange(['fontSize', 'fontFamily', 'letterSpacing', 'lineHeight'], () => this._handleFontOptionChange(optionsService.options)));

    this.register(toDisposable(() => {
      this._accessiblityBuffer.remove();
      this._accessibilityContainer.remove();
    }));
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
    this._renderRowsDebouncer.refresh(start, end, this._terminal.rows);
  }

  private _refreshRowDimensions(element: HTMLElement): void {
    element.style.height = `${this._renderService.dimensions.css.cell.height}px`;
  }

  private _announceCharacters(): void {
    if (this._charsToAnnounce.length === 0) {
      return;
    }
    this._liveRegion.textContent += this._charsToAnnounce;
    this._charsToAnnounce = '';
  }


  private _refreshAccessibilityBuffer(): void {
    if (!this._terminal.viewport) {
      return;
    }
    this._isAccessibilityBufferActive = true;
    const { bufferElements } = this._terminal.viewport.getBufferElements(0);
    for (const element of bufferElements) {
      if (element.textContent) {
        element.textContent = element.textContent.replace(new RegExp(' ', 'g'), '\xA0');
      }
    }
    this._accessiblityBuffer.replaceChildren(...bufferElements);
    this._accessiblityBuffer.scrollTop = this._accessiblityBuffer.scrollHeight;
  }

  private _handleColorChange(colorSet: ReadonlyColorSet): void {
    this._accessiblityBuffer.style.backgroundColor = colorSet.background.css;
    this._accessiblityBuffer.style.color = colorSet.foreground.css;
  }

  private _handleFontOptionChange(options: Required<ITerminalOptions>): void {
    this._accessiblityBuffer.style.fontFamily = options.fontFamily;
    this._accessiblityBuffer.style.fontSize = `${options.fontSize}px`;
    this._accessiblityBuffer.style.lineHeight = `${options.lineHeight * this._renderService.dimensions.css.cell.height}px`;
    this._accessiblityBuffer.style.letterSpacing = `${options.letterSpacing}px`;
  }
}
