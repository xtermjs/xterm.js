/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { AbstractScrollbar, ISimplifiedPointerEvent, ScrollbarHost } from './abstractScrollbar';
import { ScrollableElementResolvedOptions } from './scrollableElementOptions';
import { ScrollbarState } from './scrollbarState';
import { INewScrollPosition, Scrollable, ScrollbarVisibility, ScrollEvent } from './scrollable';

export class VerticalScrollbar extends AbstractScrollbar {

  constructor(scrollable: Scrollable, options: ScrollableElementResolvedOptions, host: ScrollbarHost) {
    const scrollDimensions = scrollable.getScrollDimensions();
    const scrollPosition = scrollable.getCurrentScrollPosition();
    super({
      lazyRender: options.lazyRender,
      host: host,
      scrollbarState: new ScrollbarState(
        (options.verticalHasArrows ? options.arrowSize : 0),
        (options.vertical === ScrollbarVisibility.Hidden ? 0 : options.verticalScrollbarSize),
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
      throw new Error('horizontalHasArrows is not supported in xterm.js');
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

  public onDidScroll(e: ScrollEvent): boolean {
    this._shouldRender = this._onElementScrollSize(e.scrollHeight) || this._shouldRender;
    this._shouldRender = this._onElementScrollPosition(e.scrollTop) || this._shouldRender;
    this._shouldRender = this._onElementSize(e.height) || this._shouldRender;
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

  public updateOptions(options: ScrollableElementResolvedOptions): void {
    this.updateScrollbarSize(options.vertical === ScrollbarVisibility.Hidden ? 0 : options.verticalScrollbarSize);
    this._scrollbarState.setOppositeScrollbarSize(0);
    this._visibilityController.setVisibility(options.vertical);
    this._scrollByPage = options.scrollByPage;
  }

}
