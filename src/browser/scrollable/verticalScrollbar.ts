/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { AbstractScrollbar, ISimplifiedPointerEvent, IScrollbarHost } from './abstractScrollbar';
import { IScrollableElementResolvedOptions } from './scrollableElementOptions';
import { ScrollbarState } from './scrollbarState';
import { INewScrollPosition, Scrollable, ScrollbarVisibility, IScrollEvent } from './scrollable';

export class VerticalScrollbar extends AbstractScrollbar {

  constructor(scrollable: Scrollable, options: IScrollableElementResolvedOptions, host: IScrollbarHost) {
    const scrollDimensions = scrollable.getScrollDimensions();
    const scrollPosition = scrollable.getCurrentScrollPosition();
    super({
      lazyRender: options.lazyRender,
      host: host,
      scrollbarState: new ScrollbarState(
        (options.verticalHasArrows ? options.verticalScrollbarSize : 0),
        (options.vertical === ScrollbarVisibility.HIDDEN ? 0 : options.verticalScrollbarSize),
        0,
        scrollDimensions.height,
        scrollDimensions.scrollHeight,
        scrollPosition.scrollTop
      ),
      visibility: options.vertical,
      extraScrollbarClassName: 'vertical',
      scrollable: scrollable,
      scrollByPage: options.scrollByPage
    });

    if (options.verticalHasArrows) {
      const arrowSize = options.verticalScrollbarSize;
      const arrowDelta = 0;
      this._createArrow({
        className: 'scra xterm-arrow-up',
        top: arrowDelta,
        left: arrowDelta,
        bgWidth: options.verticalScrollbarSize,
        bgHeight: arrowSize,
        handleActivate: () => this._arrowScroll(-arrowSize)
      });
      this._createArrow({
        className: 'scra xterm-arrow-down',
        bottom: arrowDelta,
        left: arrowDelta,
        bgWidth: options.verticalScrollbarSize,
        bgHeight: arrowSize,
        handleActivate: () => this._arrowScroll(arrowSize)
      });
    }

    this._createSlider(0, Math.floor((options.verticalScrollbarSize - options.verticalSliderSize) / 2), options.verticalSliderSize, undefined);
  }

  protected _updateSlider(sliderSize: number, sliderPosition: number): void {
    this.slider.setHeight(sliderSize);
    this.slider.setTop(sliderPosition);
  }

  protected _renderDomNode(largeSize: number, smallSize: number): void {
    this.domNode.setWidth(smallSize);
    this.domNode.setHeight(largeSize);
    this.domNode.setRight(0);
    this.domNode.setTop(0);
  }

  public handleScroll(e: IScrollEvent): boolean {
    this._shouldRender = this._handleElementScrollSize(e.scrollHeight) || this._shouldRender;
    this._shouldRender = this._handleElementScrollPosition(e.scrollTop) || this._shouldRender;
    this._shouldRender = this._handleElementSize(e.height) || this._shouldRender;
    return this._shouldRender;
  }

  protected _pointerDownRelativePosition(offsetX: number, offsetY: number): number {
    return offsetY;
  }

  protected _sliderPointerPosition(e: ISimplifiedPointerEvent): number {
    return e.pageY;
  }

  protected _sliderOrthogonalPointerPosition(e: ISimplifiedPointerEvent): number {
    return e.pageX;
  }

  protected _updateScrollbarSize(size: number): void {
    this.slider.setWidth(size);
  }

  public writeScrollPosition(target: INewScrollPosition, scrollPosition: number): void {
    target.scrollTop = scrollPosition;
  }

  private _arrowScroll(delta: number): void {
    const currentPosition = this._scrollable.getCurrentScrollPosition();
    this._scrollable.setScrollPositionNow({ scrollTop: currentPosition.scrollTop + delta });
  }

  public updateOptions(options: IScrollableElementResolvedOptions): void {
    this.updateScrollbarSize(options.vertical === ScrollbarVisibility.HIDDEN ? 0 : options.verticalScrollbarSize);
    this._scrollbarState.setOppositeScrollbarSize(0);
    this._visibilityController.setVisibility(options.vertical);
    this._scrollByPage = options.scrollByPage;
  }

}
