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
    return { dispose: () => console.log('disposing link providers') };
  }

  public attachToDom(element: HTMLElement, mouseService: IMouseService): void {
    this._element = element;
    this._mouseService = mouseService;

    this._element.addEventListener('mousemove', this._onMouseMove.bind(this));
    this._element.addEventListener('click', this._onMouseDown.bind(this));
  }

  private _onMouseMove(event: MouseEvent): void {
    const position = this._positionFromMouseEvent(event);

    if (!position) {
      return;
    }

    const scrollOffset = this._bufferService.buffer.ydisp;

    // Check the cache for a link and determine if we need to show or hide tooltip
    let foundLink = false;
    this._linkCache.forEach((cachedLink, i) => {
      const isInPosition = this._linkAtPosition(cachedLink.link, position);
      const range = cachedLink.link.range;
      if (isInPosition && !cachedLink.mouseOver) {
        // Show the tooltip
        this._onShowTooltip.fire(this._createLinkHoverEvent(range.start.x - 1, range.start.y - scrollOffset - 1, range.end.x - 1, range.end.y - scrollOffset - 1, undefined));
        this._element!.classList.add('xterm-cursor-pointer');

        if (cachedLink.link.showTooltip) {
          cachedLink.link.showTooltip(event, cachedLink.link.url);
        }

        this._linkCache[i].mouseOver = true;
        foundLink = true;
      } else if (!isInPosition && cachedLink.mouseOver) {
        // Hide the tooltip
        this._onHideTooltip.fire(this._createLinkHoverEvent(range.start.x - 1, range.start.y - scrollOffset - 1, range.end.x - 1, range.end.y - scrollOffset - 1, undefined));
        this._element!.classList.remove('xterm-cursor-pointer');

        if (cachedLink.link.hideTooltip) {
          cachedLink.link.hideTooltip(event, cachedLink.link.url);
        }

        this._linkCache[i].mouseOver = false;
      }
    });

    if (foundLink) {
      return;
    }

    // The is no link in the cache, so ask for one
    this._linkProviders.forEach(linkProvider => {
      linkProvider.provideLink(position, this._handleNewLink.bind(this));
    });
  }

  private _onMouseDown(event: MouseEvent): void {
    const position = this._positionFromMouseEvent(event);

    if (!position) {
      return;
    }

    this._linkCache.forEach((cachedLink, i) => {
      if (this._linkAtPosition(cachedLink.link, position)) {
        cachedLink.link.handle(event, cachedLink.link.url);
      }
    });
  }

  private _handleNewLink(link: ILink | undefined): void {
    if (link && !this._linkCache.find(cachedLink => cachedLink.link = link)) {
      this._linkCache.push({ link: link, mouseOver: false });
    }
  }

  /**
   * Check if the buffer position is within the link
   * @param link
   * @param position
   */
  private _linkAtPosition(link: ILink, position: IBufferCellPosition): boolean {
    return link.range.start.x <= position.x
      && link.range.start.y <= position.y
      && link.range.end.x >= position.x
      && link.range.end.y >= position.y;
  }

  /**
   * Get the buffer position from a mouse event
   * @param event
   */
  private _positionFromMouseEvent(event: MouseEvent): IBufferCellPosition | undefined {
    if (!this._element) {
      return;
    }

    const coords = this._mouseService!.getCoords(event, this._element, this._bufferService.cols, this._bufferService.rows);
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
