import { ILinkifier2, ILinkProvider, IBufferCellPosition, ILink, ILinkifierEvent } from './Types';
import { IDisposable } from 'common/Types';
import { IMouseService } from './services/Services';
import { IBufferService } from 'common/services/Services';
import { EventEmitter, IEvent } from 'common/EventEmitter';

/**
 * Copyright (c) 2017 The xterm.js authors. All rights reserved.
 * @license MIT
 */


/**
 */
export class Linkifier2 implements ILinkifier2 {
  private _element: HTMLElement | undefined;
  private _viewportElement: HTMLElement | undefined;
  private _linkProviders: ILinkProvider[] = [];
  private _mouseService: IMouseService | undefined;
  private _linkCache: ILinkCache[] = [];

  private _onShowTooltip = new EventEmitter<ILinkifierEvent>();
  public get onShowTooltip(): IEvent<ILinkifierEvent> { return this._onShowTooltip.event; }
  private _onHideTooltip = new EventEmitter<ILinkifierEvent>();
  public get onHideTooltip(): IEvent<ILinkifierEvent> { return this._onHideTooltip.event; }

  constructor(
    private readonly _bufferService: IBufferService
  ) {

  }

  public registerLinkProvider(linkProvider: ILinkProvider): IDisposable {
    this._linkProviders.push(linkProvider);
    return {
      dispose: () => {
        // Remove the link provider from the list
        this._linkProviders = this._linkProviders.splice(this._linkProviders.indexOf(linkProvider), 1);
      }
    };
  }

  public attachToDom(element: HTMLElement, viewportElement: HTMLElement, mouseService: IMouseService): void {
    this._element = element;
    this._viewportElement = viewportElement;
    this._mouseService = mouseService;

    this._element.addEventListener('mousemove', this._onMouseMove.bind(this));
    this._element.addEventListener('click', this._onMouseDown.bind(this));
    this._viewportElement.addEventListener('scroll', this._onScroll.bind(this));
  }

  private _onMouseMove(event: MouseEvent): void {
    if (!this._element || !this._mouseService) {
      return;
    }

    const position = this._positionFromMouseEvent(event, this._element, this._mouseService);

    if (!position) {
      return;
    }

    const scrollOffset = this._bufferService.buffer.ydisp;

    // Check the cache for a link and determine if we need to show or hide tooltip
    let foundLink = false;
    for (let i = 0; i < this._linkCache.length; i++) {
      const cachedLink = this._linkCache[i].link;
      const isInPosition = this._linkAtPosition(cachedLink, position);
      const range = cachedLink.range;

      // Check if the mouse position contains a link
      if (isInPosition && !this._linkCache[i].mouseOver) {
        // Show the tooltip
        this._onShowTooltip.fire(this._createLinkHoverEvent(range.start.x - 1, range.start.y - scrollOffset - 1, range.end.x - 1, range.end.y - scrollOffset - 1, undefined));
        this._element.classList.add('xterm-cursor-pointer');

        if (cachedLink.showTooltip) {
          cachedLink.showTooltip(event, cachedLink.url);
        }

        this._linkCache[i].mouseOver = true;
        foundLink = true;
      } else if (!isInPosition && this._linkCache[i].mouseOver) {
        // Hide the tooltip
        this._hideTooltip(this._element, this._linkCache[i].link, event);
        this._linkCache[i].mouseOver = false;
      }
    }

    if (foundLink) {
      return;
    }

    // The is no link in the cache, so ask for one
    this._linkProviders.forEach(linkProvider => {
      linkProvider.provideLink(position, this._handleNewLink.bind(this));
    });
  }

  private _onMouseDown(event: MouseEvent): void {
    if (!this._element || !this._mouseService) {
      return;
    }

    const position = this._positionFromMouseEvent(event, this._element, this._mouseService);

    if (!position) {
      return;
    }

    this._linkCache.forEach((cachedLink, i) => {
      if (this._linkAtPosition(cachedLink.link, position)) {
        cachedLink.link.handle(event, cachedLink.link.url);
      }
    });
  }

  private _onScroll(event: Event): void {
    this._invalidateCache();
  }

  private _handleNewLink(link: ILink | undefined): void {
    if (link && !this._linkCache.find(cachedLink => cachedLink.link = link)) {
      this._linkCache.push({ link, mouseOver: false });
      this._bufferService.buffer.addMarker(link.range.start.y);
    }
  }

  private _invalidateCache(): void {
    if (!this._element) {
      return;
    }

    // We want to invalidate the cache
    // but we need to check if we need to hide any tooltip
    for (let i = 0; i < this._linkCache.length; i++) {
      if (this._linkCache[i].mouseOver) {
        this._hideTooltip(this._element, this._linkCache[i].link, new MouseEvent('invalid event'));
      }
    }

    this._linkCache = [];
  }

  private _hideTooltip(element: HTMLElement, link: ILink, event: MouseEvent): void {
    const range = link.range;
    const scrollOffset = this._bufferService.buffer.ydisp;

    this._onHideTooltip.fire(this._createLinkHoverEvent(range.start.x - 1, range.start.y - scrollOffset - 1, range.end.x - 1, range.end.y - scrollOffset - 1, undefined));
    element.classList.remove('xterm-cursor-pointer');

    if (link.hideTooltip) {
      link.hideTooltip(event, link.url);
    }
  }

  /**
   * Check if the buffer position is within the link
   * @param link
   * @param position
   */
  private _linkAtPosition(link: ILink, position: IBufferCellPosition): boolean {
    return link.range.start.x <= position.x &&
      link.range.start.y <= position.y &&
      link.range.end.x >= position.x &&
      link.range.end.y >= position.y;
  }

  /**
   * Get the buffer position from a mouse event
   * @param event
   */
  private _positionFromMouseEvent(event: MouseEvent, element: HTMLElement, mouseService: IMouseService): IBufferCellPosition | undefined {
    const coords = mouseService.getCoords(event, element, this._bufferService.cols, this._bufferService.rows);
    if (!coords) {
      return;
    }

    return { x: coords[0], y: coords[1] + this._bufferService.buffer.ydisp };
  }

  private _createLinkHoverEvent(x1: number, y1: number, x2: number, y2: number, fg: number | undefined): ILinkifierEvent {
    return { x1, y1, x2, y2, cols: this._bufferService.cols, fg };
  }
}

interface ILinkCache {
  link: ILink;
  mouseOver: boolean;
}
