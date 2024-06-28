/**
 * Copyright (c) 2024 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import { ICoreBrowserService, IRenderService, IThemeService } from 'browser/services/Services';
import { EventEmitter } from 'common/EventEmitter';
import { Disposable } from 'common/Lifecycle';
import { IBufferService } from 'common/services/Services';
import { DomScrollableElement } from 'vs/base/browser/ui/scrollbar/scrollableElement';
import { ScrollbarVisibility } from 'vs/base/common/scrollable';

export class Viewport extends Disposable{

  protected _onRequestScrollLines = this.register(new EventEmitter<number>());
  public readonly onRequestScrollLines = this._onRequestScrollLines.event;

  constructor(
    element: HTMLElement,
    screenElement: HTMLElement,
    @IBufferService private readonly _bufferService: IBufferService,
    @ICoreBrowserService private readonly _coreBrowserService: ICoreBrowserService,
    @IThemeService themeService: IThemeService,
    @IRenderService private readonly _renderService: IRenderService
  ) {
    super();

    // TODO: Support smooth scroll
    // TODO: Support scrollSensitivity
    // TODO: Support fastScrollSensitivity
    // TODO: Support fastScrollModifier?
    // TODO: overviewRulerWidth should deprecated in favor of scrollBarWidth

    const scrollableElement = new DomScrollableElement(screenElement, {
      vertical: ScrollbarVisibility.Auto,
      horizontal: ScrollbarVisibility.Hidden,
      useShadows: false,
      // TODO: Over scrollBarWidth instead
      verticalScrollbarSize: 14
    });
    scrollableElement.setScrollDimensions({ height: 0, scrollHeight: 0 });
    scrollableElement.getDomNode().style.backgroundColor = themeService.colors.background.css;
    element.appendChild(scrollableElement.getDomNode());
    let inSync = false;
    let suppressOnScrollEvent = false;
    // TODO: Ensure sync only happens once per frame
    const sync = (ydisp: number = this._bufferService.buffer.ydisp): void => {
      if (!this._renderService) {
        return;
      }
      if (inSync) {
        return;
      }
      inSync = true;

      // console.log('sync', {
      //   height: this._renderService.dimensions.css.canvas.height,
      //   scrollHeight: this._renderService.dimensions.css.cell.height * this._bufferService.buffer.lines.length,
      //   scrollTop: ydisp * this._renderService.dimensions.css.cell.height,
      //   ydispParam: ydisp,
      //   ydispBuffer: this._bufferService.buffer.ydisp
      // });
      const newDims = {
        height: this._renderService.dimensions.css.canvas.height,
        scrollHeight: this._renderService.dimensions.css.cell.height * this._bufferService.buffer.lines.length
      };

      // Ignore any onScroll event that happens as a result of dimensions changing as this should
      // never cause a scrollLines call, only setScrollPosition can do that.
      suppressOnScrollEvent = true;
      scrollableElement.setScrollDimensions(newDims);
      suppressOnScrollEvent = false;

      scrollableElement.setScrollPosition({
        scrollTop: ydisp * this._renderService.dimensions.css.cell.height
      });

      inSync = false;
    };
    let inScroll = false;
    scrollableElement.onScroll(e => {
      if (!this._renderService) {
        return;
      }
      if (inScroll || suppressOnScrollEvent) {
        return;
      }
      inScroll = true;
      const newRow = Math.round(e.scrollTop / this._renderService.dimensions.css.cell.height);
      const diff = newRow - this._bufferService.buffer.ydisp;
      // console.log('onScroll', {
      //   ydisp: this._bufferService.buffer.ydisp,
      //   newRow,
      //   diff,
      //   'e.scrollTop': e.scrollTop,
      //   'cell.height': this._renderService.dimensions.css.cell.height
      // });
      if (diff !== 0) {
        this._onRequestScrollLines.fire(diff);
      }
      inScroll = false;
    });
    let microtaskQueued = false;
    let lastE: number | undefined;
    const queue = (e?: number): void => {
      if (e) {
        lastE = e;
      }
      if (!microtaskQueued) {
        this._coreBrowserService?.window.requestAnimationFrame(() => {
          sync(lastE);
          microtaskQueued = false;
          lastE = undefined;
        });
        microtaskQueued = true;
      }
    };
    this._bufferService.onResize(() => queue());
    this._bufferService.onScroll((e) => queue(e));
  }
}
