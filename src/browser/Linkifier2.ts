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

  private _onLinkHover = new EventEmitter<ILinkifierEvent>();
  public get onLinkHover(): IEvent<ILinkifierEvent> { return this._onLinkHover.event; }
  private _onLinkLeave = new EventEmitter<ILinkifierEvent>();
  public get onLinkLeave(): IEvent<ILinkifierEvent> { return this._onLinkLeave.event; }

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
        this._askForLink(position);
      }
    } else {
      this._askForLink(position);
    }
  }

  private _askForLink(position: IBufferCellPosition): void {
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
              break;
            }
          }
        }
      });
    });
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
      this._currentLink.activate(event, this._currentLink.text);
    }
  }

  private _clearCurrentLink(startRow?: number, endRow?: number): void {
    if (!this._element || !this._currentLink || !this._lastMouseEvent) {
      return;
    }

    // If we have a start and end row, check that the link is within it
    if (!startRow || !endRow || (this._currentLink.range.start.y >= startRow && this._currentLink.range.end.y <= endRow)) {
      this._linkLeave(this._element, this._currentLink, this._lastMouseEvent);
      this._currentLink = undefined;
      this._linkCacheDisposables.forEach(l => l.dispose());
      this._linkCacheDisposables = [];
    }
  }

  private _handleNewLink(link: ILink): void {
    if (!this._element || !this._lastMouseEvent || !this._mouseService) {
      return;
    }

    const position = this._positionFromMouseEvent(this._lastMouseEvent, this._element, this._mouseService);

    if (!position) {
      return;
    }

    // Trigger hover if the we have a link at the position
    if (this._linkAtPosition(link, position)) {
      this._currentLink = link;
      this._linkHover(this._element, link, this._lastMouseEvent);

      // Add listener for rerendering
      if (this._renderService) {
        this._linkCacheDisposables.push(this._renderService.onRender(e => {
          this._clearCurrentLink(e.start + 1 + this._bufferService.buffer.ydisp, e.end + 1 + this._bufferService.buffer.ydisp);
        }));
      }
    }
  }

  private _linkHover(element: HTMLElement, link: ILink, event: MouseEvent): void {
    const range = link.range;
    const scrollOffset = this._bufferService.buffer.ydisp;

    this._onLinkHover.fire(this._createLinkHoverEvent(range.start.x - 1, range.start.y - scrollOffset - 1, range.end.x - 1, range.end.y - scrollOffset - 1, undefined));
    element.classList.add('xterm-cursor-pointer');

    if (link.hover) {
      link.hover(event, link.text);
    }
  }

  private _linkLeave(element: HTMLElement, link: ILink, event: MouseEvent): void {
    const range = link.range;
    const scrollOffset = this._bufferService.buffer.ydisp;

    this._onLinkLeave.fire(this._createLinkHoverEvent(range.start.x - 1, range.start.y - scrollOffset - 1, range.end.x - 1, range.end.y - scrollOffset - 1, undefined));
    element.classList.remove('xterm-cursor-pointer');

    if (link.leave) {
      link.leave(event, link.text);
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
    return ((sameLine && link.range.start.x <= position.x && link.range.end.x >= position.x) ||
      (wrappedFromLeft && link.range.end.x >= position.x) ||
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
