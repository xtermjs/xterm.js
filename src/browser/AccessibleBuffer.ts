/**
 * Copyright (c) 2017 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import * as Strings from 'browser/LocalizableStrings';
import { IBufferElementProvider, ITerminal, ReadonlyColorSet } from 'browser/Types';
import { addDisposableDomListener } from 'browser/Lifecycle';
import { Disposable, toDisposable } from 'common/Lifecycle';
import { IRenderService, IThemeService } from 'browser/services/Services';
import { IOptionsService } from 'common/services/Services';
import { ITerminalOptions } from 'xterm';
import { IDisposable } from 'common/Types';

export class AccessibleBuffer extends Disposable {
  private _element: HTMLElement;
  private _isAccessibleBufferActive: boolean = false;
  public get isAccessibleBufferActive(): boolean { return this._isAccessibleBufferActive; }
  private _provider: IBufferElementProvider | undefined;
  constructor(
    private readonly _terminal: ITerminal,
    @IOptionsService optionsService: IOptionsService,
    @IRenderService private readonly _renderService: IRenderService,
    @IThemeService themeService: IThemeService
  ) {
    super();
    if (!this._terminal.element) {
      throw new Error('Cannot enable accessible buffer before Terminal.open');
    }

    this._element = document.createElement('div');
    this._element.setAttribute('role', 'document');
    this._element.ariaRoleDescription = Strings.accessibleBuffer;
    this._element.tabIndex = 0;
    this._element.classList.add('xterm-accessible-buffer');
    this._terminal.element.insertAdjacentElement('afterbegin', this._element);

    this.register(addDisposableDomListener(this._element, 'keydown', (ev: KeyboardEvent) => {
      if (ev.key === 'Tab') {
        this._isAccessibleBufferActive = false;
      }
    }
    ));
    this.register(addDisposableDomListener(this._element, 'focus', () => this._refreshAccessibleBuffer()));
    this.register(addDisposableDomListener(this._element, 'focusout', (e) => {
      if (!this._element.contains(e.element)) {
        this._isAccessibleBufferActive = false;
      }
    }));

    this._handleColorChange(themeService.colors);
    this.register(themeService.onChangeColors(e => this._handleColorChange(e)));
    this._handleFontOptionChange(optionsService.options);
    this.register(optionsService.onMultipleOptionChange(['fontSize', 'fontFamily', 'letterSpacing', 'lineHeight'], () => this._handleFontOptionChange(optionsService.options)));
    this.register(toDisposable(() => this._element.remove()));
  }

  public registerBufferElementProvider(bufferProvider: IBufferElementProvider): IDisposable {
    if (this._provider) {
      throw new Error('Buffer element provider already registered');
    }
    this._provider = bufferProvider;
    return {
      dispose: () => {
        this._provider = undefined;
      }
    };
  }

  private _refreshAccessibleBuffer(): void {
    if (!this._terminal.viewport) {
      return;
    }
    this._isAccessibleBufferActive = true;
    this._element.scrollTop = this._element.scrollHeight;
    const bufferElements = this._provider?.provideBufferElements();
    if (!bufferElements) {
      const { bufferElements } = this._terminal.viewport.getBufferElements(0);
      for (const element of bufferElements) {
        if (element.textContent) {
          element.textContent = element.textContent.replace(new RegExp(' ', 'g'), '\xA0');
        }
      }
      this._element.replaceChildren(...bufferElements);
    } else {
      this._element.replaceChildren(bufferElements);
    }
  }

  private _handleColorChange(colorSet: ReadonlyColorSet): void {
    this._element.style.backgroundColor = colorSet.background.css;
    this._element.style.color = colorSet.foreground.css;
  }

  private _handleFontOptionChange(options: Required<ITerminalOptions>): void {
    this._element.style.fontFamily = options.fontFamily;
    this._element.style.fontSize = `${options.fontSize}px`;
    this._element.style.lineHeight = `${options.lineHeight * (this._renderService.dimensions.css.cell.height)}px`;
    this._element.style.letterSpacing = `${options.letterSpacing}px`;
  }
}
