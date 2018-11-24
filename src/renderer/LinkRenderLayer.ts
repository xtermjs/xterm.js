/**
 * Copyright (c) 2017 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import { ILinkHoverEvent, ITerminal, ILinkifierAccessor, LinkHoverEventTypes } from '../Types';
import { IColorSet, IRenderDimensions } from './Types';
import { BaseRenderLayer } from './BaseRenderLayer';
import { INVERTED_DEFAULT_COLOR } from './atlas/Types';
import { is256Color } from './atlas/CharAtlasUtils';

export class LinkRenderLayer extends BaseRenderLayer {
  private _state: ILinkHoverEvent = null;

  constructor(container: HTMLElement, zIndex: number, colors: IColorSet, terminal: ILinkifierAccessor) {
    super(container, 'link', zIndex, true, colors);
    terminal.linkifier.on(LinkHoverEventTypes.HOVER, (e: ILinkHoverEvent) => this._onLinkHover(e));
    terminal.linkifier.on(LinkHoverEventTypes.LEAVE, (e: ILinkHoverEvent) => this._onLinkLeave(e));
  }

  public resize(terminal: ITerminal, dim: IRenderDimensions): void {
    super.resize(terminal, dim);
    // Resizing the canvas discards the contents of the canvas so clear state
    this._state = null;
  }

  public reset(terminal: ITerminal): void {
    this._clearCurrentLink();
  }

  private _clearCurrentLink(): void {
    if (this._state) {
      this.clearCells(this._state.x1, this._state.y1, this._state.cols - this._state.x1, 1);
      const middleRowCount = this._state.y2 - this._state.y1 - 1;
      if (middleRowCount > 0) {
        this.clearCells(0, this._state.y1 + 1, this._state.cols, middleRowCount);
      }
      this.clearCells(0, this._state.y2, this._state.x2, 1);
      this._state = null;
    }
  }

  private _onLinkHover(e: ILinkHoverEvent): void {
    if (e.fg === INVERTED_DEFAULT_COLOR) {
      this._ctx.fillStyle = this._colors.background.css;
    } else if (is256Color(e.fg)) {
      // 256 color support
      this._ctx.fillStyle = this._colors.ansi[e.fg].css;
    } else {
      this._ctx.fillStyle = this._colors.foreground.css;
    }

    if (e.y1 === e.y2) {
      // Single line link
      this.fillBottomLineAtCells(e.x1, e.y1, e.x2 - e.x1);
    } else {
      // Multi-line link
      this.fillBottomLineAtCells(e.x1, e.y1, e.cols - e.x1);
      for (let y = e.y1 + 1; y < e.y2; y++) {
        this.fillBottomLineAtCells(0, y, e.cols);
      }
      this.fillBottomLineAtCells(0, e.y2, e.x2);
    }
    this._state = e;
  }

  private _onLinkLeave(e: ILinkHoverEvent): void {
    this._clearCurrentLink();
  }
}
