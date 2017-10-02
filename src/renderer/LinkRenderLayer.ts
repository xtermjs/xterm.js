/**
 * Copyright (c) 2017 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import { IColorSet, IRenderDimensions } from './Interfaces';
import { IBuffer, ICharMeasure, ITerminal, ILinkifierAccessor } from '../Interfaces';
import { CHAR_DATA_ATTR_INDEX } from '../Buffer';
import { GridCache } from './GridCache';
import { FLAGS } from './Types';
import { BaseRenderLayer, INVERTED_DEFAULT_COLOR } from './BaseRenderLayer';
import { LinkHoverEvent, LinkHoverEventTypes } from '../Types';

export class LinkRenderLayer extends BaseRenderLayer {
  private _state: LinkHoverEvent = null;

  constructor(container: HTMLElement, zIndex: number, colors: IColorSet, terminal: ILinkifierAccessor) {
    super(container, 'link', zIndex, true, colors);
    terminal.linkifier.on(LinkHoverEventTypes.HOVER, (e: LinkHoverEvent) => this._onLinkHover(e));
    terminal.linkifier.on(LinkHoverEventTypes.LEAVE, (e: LinkHoverEvent) => this._onLinkLeave(e));
  }

  public resize(terminal: ITerminal, dim: IRenderDimensions, charSizeChanged: boolean): void {
    super.resize(terminal, dim, charSizeChanged);
    // Resizing the canvas discards the contents of the canvas so clear state
    this._state = null;
  }

  public reset(terminal: ITerminal): void {
    this._clearCurrentLink();
  }

  private _clearCurrentLink(): void {
    if (this._state) {
      this.clearCells(this._state.x, this._state.y, this._state.length, 1);
      this._state = null;
    }
  }

  private _onLinkHover(e: LinkHoverEvent): void {
    this._ctx.fillStyle = this._colors.foreground;
    this.fillBottomLineAtCells(e.x, e.y, e.length);
    this._state = e;
  }

  private _onLinkLeave(e: LinkHoverEvent): void {
    this._clearCurrentLink();
  }
}
