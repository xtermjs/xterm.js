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

export class AccessibleBuffer extends Disposable {
  private _accessiblityBuffer: HTMLElement;
  private _isAccessibilityBufferActive: boolean = false;
  public get isAccessibilityBufferActive(): boolean { return this._isAccessibilityBufferActive; }

  constructor(
    private readonly _terminal: ITerminal,
    @IOptionsService optionsService: IOptionsService,
    @IRenderService private readonly _renderService: IRenderService,
    @IThemeService themeService: IThemeService
  ) {
    super();
    if (!this._terminal.element) {
      throw new Error('Cannot enable accessibility before Terminal.open');
    }

    this._accessiblityBuffer = document.createElement('div');
    this._accessiblityBuffer.setAttribute('role', 'document');
    this._accessiblityBuffer.ariaRoleDescription = Strings.accessibilityBuffer;
    this._accessiblityBuffer.tabIndex = 0;
    this._accessiblityBuffer.classList.add('xterm-accessibility-buffer');
    this._terminal.element.insertAdjacentElement('afterbegin', this._accessiblityBuffer);

    this.register(addDisposableDomListener(this._accessiblityBuffer, 'keydown', (ev: KeyboardEvent) => {
      if (ev.key === 'Tab') {
        this._isAccessibilityBufferActive = false;
      }
    }
    ));
    this.register(addDisposableDomListener(this._accessiblityBuffer, 'focus', () => this._refreshAccessibilityBuffer()));
    this.register(addDisposableDomListener(this._accessiblityBuffer, 'focusout', (e) => {
      if (!this._accessiblityBuffer.contains(e.element)) {
        this._isAccessibilityBufferActive = false;
      }
    }));

    this._handleColorChange(themeService.colors);
    this.register(themeService.onChangeColors(e => this._handleColorChange(e)));
    this._handleFontOptionChange(optionsService.options);
    this.register(optionsService.onMultipleOptionChange(['fontSize', 'fontFamily', 'letterSpacing', 'lineHeight'], () => this._handleFontOptionChange(optionsService.options)));
    this.register(toDisposable(() => this._accessiblityBuffer.remove()));
  }

  public setElements(elements: HTMLElement[]): DocumentFragment {
    const fragment = document.createDocumentFragment();
    for (const element of elements) {
      fragment.appendChild(element);
    }
    this._accessiblityBuffer.replaceChildren(fragment);
    return fragment;
  }

  private _refreshAccessibilityBuffer(): void {
    if (!this._terminal.viewport) {
      return;
    }
    this._isAccessibilityBufferActive = true;
    this._accessiblityBuffer.scrollTop = this._accessiblityBuffer.scrollHeight;
    if (this._terminal.options.screenReaderMode) {
      return;
    }
    const { bufferElements } = this._terminal.viewport.getBufferElements(0);
    for (const element of bufferElements) {
      if (element.textContent) {
        element.textContent = element.textContent.replace(new RegExp(' ', 'g'), '\xA0');
      }
    }
    this._accessiblityBuffer.replaceChildren(...bufferElements);
  }

  private _handleColorChange(colorSet: ReadonlyColorSet): void {
    this._accessiblityBuffer.style.backgroundColor = colorSet.background.css;
    this._accessiblityBuffer.style.color = colorSet.foreground.css;
  }

  private _handleFontOptionChange(options: Required<ITerminalOptions>): void {
    this._accessiblityBuffer.style.fontFamily = options.fontFamily;
    this._accessiblityBuffer.style.fontSize = `${options.fontSize}px`;
    this._accessiblityBuffer.style.lineHeight = `${options.lineHeight * (this._renderService.dimensions.css.cell.height)}px`;
    this._accessiblityBuffer.style.letterSpacing = `${options.letterSpacing}px`;
  }
}
