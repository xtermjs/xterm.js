/**
 * Copyright (c) 2024 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import { ICoreBrowserService, IRenderService, IThemeService } from 'browser/services/Services';
import { EventEmitter, runAndSubscribe } from 'common/EventEmitter';
import { Disposable, toDisposable } from 'common/Lifecycle';
import { IBufferService, IOptionsService } from 'common/services/Services';
import { DomScrollableElement } from 'vs/base/browser/ui/scrollbar/scrollableElement';
import type { ScrollableElementChangeOptions } from 'vs/base/browser/ui/scrollbar/scrollableElementOptions';
import { ScrollbarVisibility, type ScrollEvent } from 'vs/base/common/scrollable';

const enum Constants {
  DEFAULT_SCROLL_BAR_WIDTH = 14
}

export class Viewport extends Disposable {

  protected _onRequestScrollLines = this.register(new EventEmitter<number>());
  public readonly onRequestScrollLines = this._onRequestScrollLines.event;

  private _scrollableElement: DomScrollableElement;
  private _styleElement: HTMLStyleElement;

  private _queuedAnimationFrame?: number;
  private _latestYDisp?: number;
  private _isSyncing: boolean = false;
  private _isHandlingScroll: boolean = false;
  private _suppressOnScrollHandler: boolean = false;

  constructor(
    element: HTMLElement,
    screenElement: HTMLElement,
    @IBufferService private readonly _bufferService: IBufferService,
    @ICoreBrowserService coreBrowserService: ICoreBrowserService,
    @IThemeService themeService: IThemeService,
    @IOptionsService private readonly _optionsService: IOptionsService,
    @IRenderService private readonly _renderService: IRenderService
  ) {
    super();

    // TODO: Support smooth scroll

    this._scrollableElement = this.register(new DomScrollableElement(screenElement, {
      vertical: ScrollbarVisibility.Auto,
      horizontal: ScrollbarVisibility.Hidden,
      useShadows: false,
      mouseWheelSmoothScroll: true,
      ...this._getMutableOptions()
    }));
    this.register(this._optionsService.onMultipleOptionChange([
      'scrollSensitivity',
      'fastScrollSensitivity',
      'overviewRulerWidth'
    ], () => this._scrollableElement.updateOptions(this._getMutableOptions())));

    this._scrollableElement.setScrollDimensions({ height: 0, scrollHeight: 0 });
    this.register(runAndSubscribe(themeService.onChangeColors, () => {
      this._scrollableElement.getDomNode().style.backgroundColor = themeService.colors.background.css;
    }));
    element.appendChild(this._scrollableElement.getDomNode());
    this.register(toDisposable(() => this._scrollableElement.getDomNode().remove()));

    this._styleElement = coreBrowserService.window.document.createElement('style');
    screenElement.appendChild(this._styleElement);
    this.register(toDisposable(() => this._styleElement.remove()));
    this.register(runAndSubscribe(themeService.onChangeColors, () => {
      this._styleElement.textContent = [
        `.xterm .monaco-scrollable-element > .scrollbar > .slider {`,
        `  background: ${themeService.colors.scrollbarSliderBackground.css};`,
        `}`,
        `.xterm .monaco-scrollable-element > .scrollbar > .slider:hover {`,
        `  background: ${themeService.colors.scrollbarSliderHoverBackground.css};`,
        `}`,
        `.xterm .monaco-scrollable-element > .scrollbar > .slider.active {`,
        `  background: ${themeService.colors.scrollbarSliderActiveBackground.css};`,
        `}`
      ].join('\n');
    }));

    this.register(this._bufferService.onResize(() => this._queueSync()));
    this.register(this._bufferService.onScroll(ydisp => this._queueSync(ydisp)));

    this.register(this._scrollableElement.onScroll(e => this._handleScroll(e)));
  }

  private _getMutableOptions(): ScrollableElementChangeOptions {
    return {
      mouseWheelScrollSensitivity: this._optionsService.rawOptions.scrollSensitivity,
      fastScrollSensitivity: this._optionsService.rawOptions.fastScrollSensitivity,
      verticalScrollbarSize: this._optionsService.rawOptions.overviewRulerWidth || Constants.DEFAULT_SCROLL_BAR_WIDTH
    };
  }

  private _queueSync(ydisp?: number): void {
    // Update state
    if (ydisp !== undefined) {
      this._latestYDisp = ydisp;
    }

    // Don't queue more than one callback
    if (this._queuedAnimationFrame !== undefined) {
      return;
    }
    this._queuedAnimationFrame = this._renderService.addRefreshCallback(() => this._sync(this._latestYDisp));
    this._latestYDisp = undefined;
    this._queuedAnimationFrame = undefined;
  }

  private _sync(ydisp: number = this._bufferService.buffer.ydisp): void {
    if (!this._renderService || this._isSyncing) {
      return;
    }
    this._isSyncing = true;

    // Ignore any onScroll event that happens as a result of dimensions changing as this should
    // never cause a scrollLines call, only setScrollPosition can do that.
    this._suppressOnScrollHandler = true;
    this._scrollableElement.setScrollDimensions({
      height: this._renderService.dimensions.css.canvas.height,
      scrollHeight: this._renderService.dimensions.css.cell.height * this._bufferService.buffer.lines.length
    });
    this._suppressOnScrollHandler = false;

    this._scrollableElement.setScrollPosition({
      scrollTop: ydisp * this._renderService.dimensions.css.cell.height
    });

    this._isSyncing = false;
  }

  private _handleScroll(e: ScrollEvent): void {
    if (!this._renderService) {
      return;
    }
    if (this._isHandlingScroll || this._suppressOnScrollHandler) {
      return;
    }
    this._isHandlingScroll = true;
    const newRow = Math.round(e.scrollTop / this._renderService.dimensions.css.cell.height);
    const diff = newRow - this._bufferService.buffer.ydisp;
    if (diff !== 0) {
      this._onRequestScrollLines.fire(diff);
    }
    this._isHandlingScroll = false;
  }
}
