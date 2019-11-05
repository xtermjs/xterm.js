import { ILinkifier2, ILinkProvider, IBufferCellPosition, ILink, ILinkifierEvent, IBufferRange } from './Types';
import { IDisposable } from 'common/Types';
import { IMouseService } from './services/Services';
import { IBufferService, ICoreService } from 'common/services/Services';
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
  private _linkCache: ICachedLink[] = [];
  private _lastMouseEvent: MouseEvent | undefined;
  private _mouseOverLink: boolean = false;

  private _onShowTooltip = new EventEmitter<ILinkifierEvent>();
  public get onShowTooltip(): IEvent<ILinkifierEvent> { return this._onShowTooltip.event; }
  private _onHideTooltip = new EventEmitter<ILinkifierEvent>();
  public get onHideTooltip(): IEvent<ILinkifierEvent> { return this._onHideTooltip.event; }

  constructor(
    private readonly _bufferService: IBufferService,
    private readonly _coreService: ICoreService
  ) {

  }

  public registerLinkProvider(linkProvider: ILinkProvider): IDisposable {
    this._linkProviders.push(linkProvider);
    return {
      dispose: () => {
        // Remove the link provider from the list
        this._linkProviders.splice(this._linkProviders.indexOf(linkProvider), 1);
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

    this._coreService.onData(this._onData.bind(this));
  }

  private _onMouseMove(event: MouseEvent): void {
    this._lastMouseEvent = event;

    if (!this._element || !this._mouseService) {
      return;
    }

    const position = this._positionFromMouseEvent(event, this._element, this._mouseService);

    if (!position) {
      return;
    }

    // Check the cache for a link and determine if we need to show or hide tooltip
    let foundLink = false;
    let mouseOver = false;
    for (let i = 0; i < this._linkCache.length; i++) {
      const cachedLink = this._linkCache[i].link;
      const isInPosition = this._linkAtPosition(cachedLink, position);

      // Check if the mouse position contains a link
      // Also check if it isn't the current line
      if (isInPosition && !this._linkCache[i].mouseOver && position.y < this._bufferService.buffer.y) {
        // Show the tooltip
        this._showTooltip(this._element, this._linkCache[i].link, event);
        this._linkCache[i].mouseOver = true;
        foundLink = true;
        this._mouseOverLink = true;
      } else if (!isInPosition && this._linkCache[i].mouseOver) {
        // Hide the tooltip
        this._hideTooltip(this._element, this._linkCache[i].link, event);
        this._linkCache[i].mouseOver = false;
      }

      if (isInPosition) {
        mouseOver = true;
      }
    }

    if (foundLink) {
      return;
    }

    if (!mouseOver) {
      this._mouseOverLink = false;
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
    if (this._lastMouseEvent && this._mouseOverLink) {
      this._hideAllTooltips();
    }
  }

  private _onData(e: string): void {
    if (this._lastMouseEvent && this._mouseOverLink) {
      const index = this._hideAllTooltips();
      this._linkCache.splice(index, 1);
    }
  }

  private _handleNewLink(link: ILink | undefined): void {
    if (!link || !this._element || !this._lastMouseEvent || !this._mouseService) {
      return;
    }

    // Check if the link at this position is already cached
    let linkIndex = this._linkCache.findIndex(cachedLink => {
      return cachedLink.link.url === link.url &&
        cachedLink.link.range.start.x === link.range.start.x &&
        cachedLink.link.range.start.y === link.range.start.y &&
        cachedLink.link.range.end.x === link.range.end.x &&
        cachedLink.link.range.end.y === link.range.end.y;
    });

    const position = this._positionFromMouseEvent(this._lastMouseEvent, this._element, this._mouseService);

    if (!position) {
      return;
    }

    const linkAtPosition = this._linkAtPosition(link, position);

    if (linkIndex === -1) {
      this._linkCache.push({ link, mouseOver: false });
      linkIndex = this._linkCache.length - 1;
    }

    // Show the tooltip if the last mouse event was over it
    if (linkAtPosition && !this._linkCache[linkIndex].mouseOver) {
      this._showTooltip(this._element, link, this._lastMouseEvent);
      this._linkCache[linkIndex].mouseOver = true;
      this._mouseOverLink = true;
    }
  }

  private _showTooltip(element: HTMLElement, link: ILink, event: MouseEvent): void {
    const range = link.range;
    const scrollOffset = this._bufferService.buffer.ydisp;

    this._onShowTooltip.fire(this._createLinkHoverEvent(range.start.x - 1, range.start.y - scrollOffset - 1, range.end.x - 1, range.end.y - scrollOffset - 1, undefined));
    element.classList.add('xterm-cursor-pointer');

    if (link.showTooltip) {
      link.showTooltip(event, link.url);
    }
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

  private _hideAllTooltips(): number {
    if (!this._element) {
      return -1;
    }

    // Hide all the tooltips
    for (let i = 0; i < this._linkCache.length; i++) {
      if (this._linkCache[i].mouseOver) {
        this._hideTooltip(this._element, this._linkCache[i].link, new MouseEvent('invalid event'));
        return i;
      }
    }

    return -1;
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

interface ICachedLink {
  link: ILink;
  mouseOver: boolean;
}
