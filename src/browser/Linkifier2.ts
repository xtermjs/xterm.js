/**
 * Copyright (c) 2019 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import { ILinkifier2, ILinkProvider, IBufferCellPosition, ILink, ILinkifierEvent } from './Types';
import { IDisposable } from 'common/Types';
import { IMouseService, IRenderService } from './services/Services';
import { IBufferService, ICoreService } from 'common/services/Services';
import { EventEmitter, IEvent } from 'common/EventEmitter';

export class Linkifier2 implements ILinkifier2 {
  private _element: HTMLElement | undefined;
  private _mouseService: IMouseService | undefined;
  private _renderService: IRenderService | undefined;
  private _linkProviders: ILinkProvider[] = [];
  private _currentLink: ILink | undefined;
  private _lastMouseEvent: MouseEvent | undefined;
  private _linkCacheDisposables: IDisposable[] = [];
  private _lastBufferCell: IBufferCellPosition | undefined;

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
        const providerIndex = this._linkProviders.indexOf(linkProvider);

        if (providerIndex !== -1) {
          this._linkProviders.splice(providerIndex, 1);
        }
      }
    };
  }

  public attachToDom(element: HTMLElement, mouseService: IMouseService, renderService: IRenderService): void {
    this._element = element;
    this._mouseService = mouseService;
    this._renderService = renderService;

    this._element.addEventListener('mousemove', this._onMouseMove.bind(this));
    this._element.addEventListener('click', this._onMouseDown.bind(this));
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

    if (!this._lastBufferCell || (position.x !== this._lastBufferCell.x || position.y !== this._lastBufferCell.y)) {
      this._onHover(position);
      this._lastBufferCell = position;
    }
  }

  private _onHover(position: IBufferCellPosition): void {
    if (this._currentLink) {
      // Check the if the link is in the mouse position
      const isInPosition = this._linkAtPosition(this._currentLink, position);

      // Check if we need to clear the link
      if (!isInPosition) {
        this._clearCurrentLink();
      }
    } else {
      const providerReplies: Map<Number, ILink | undefined> = new Map();
      let linkProvided = false;

      // There is no link cached, so ask for one
      this._linkProviders.forEach((linkProvider, i) => {
        linkProvider.provideLink(position, (link: ILink | undefined) => {
          providerReplies.set(i, link);

          // Check if every provider before this one has come back undefined
          let hasLinkBefore = false;
          for (let j = 0; j < i; j++) {
            if (!providerReplies.has(j) || providerReplies.get(j)) {
              hasLinkBefore = true;
            }
          }

          // If all providers with higher priority came back undefined, then this link should be used
          if (!hasLinkBefore && link) {
            linkProvided = true;
            this._handleNewLink(link);
          }

          // Check if all the providers have responded
          if (providerReplies.size === this._linkProviders.length && !linkProvided) {
            // Respect the order of the link providers
            for (let j = 0; j < providerReplies.size; j++) {
              const currentLink = providerReplies.get(j);
              if (currentLink) {
                this._handleNewLink(currentLink);
              }
            }
          }
        });
      });
    }
  }

  private _onMouseDown(event: MouseEvent): void {
    if (!this._element || !this._mouseService || !this._currentLink) {
      return;
    }

    const position = this._positionFromMouseEvent(event, this._element, this._mouseService);

    if (!position) {
      return;
    }

    if (this._linkAtPosition(this._currentLink, position)) {
      this._currentLink.handle(event, this._currentLink.url);
    }
  }

  private _clearCurrentLink(): void {
    if (!this._element || !this._currentLink || !this._lastMouseEvent) {
      return;
    }

    this._hideTooltip(this._element, this._currentLink, this._lastMouseEvent);
    this._currentLink = undefined;
    this._linkCacheDisposables.forEach(l => l.dispose());
    this._linkCacheDisposables = [];
  }

  private _handleNewLink(link: ILink): void {
    if (!this._element || !this._lastMouseEvent || !this._mouseService) {
      return;
    }

    const position = this._positionFromMouseEvent(this._lastMouseEvent, this._element, this._mouseService);

    if (!position) {
      return;
    }

    // Show the tooltip if the we have a link at the position
    if (this._linkAtPosition(link, position)) {
      this._currentLink = link;
      this._showTooltip(this._element, link, this._lastMouseEvent);

      // Add listener for rerendering
      if (this._renderService) {
        this._linkCacheDisposables.push(this._renderService.onRender(() => this._clearCurrentLink()));
      }
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

  /**
   * Check if the buffer position is within the link
   * @param link
   * @param position
   */
  private _linkAtPosition(link: ILink, position: IBufferCellPosition): boolean {
    const sameLine = link.range.start.y === link.range.end.y;
    const wrappedFromLeft = link.range.start.y < position.y;
    const wrappedToRight = link.range.end.y > position.y;

    // If the start and end have the same y, then the position must be between start and end x
    // If not, then handle each case seperately, depending on which way it wraps
    return ((sameLine && link.range.start.x <= position.x && link.range.end.x > position.x) ||
      (wrappedFromLeft && link.range.end.x > position.x) ||
      (wrappedToRight && link.range.start.x <= position.x) ||
      (wrappedFromLeft && wrappedToRight)) &&
      link.range.start.y <= position.y &&
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
