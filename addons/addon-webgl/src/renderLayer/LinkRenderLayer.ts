/**
 * Copyright (c) 2017 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import { is256Color } from '../CharAtlasUtils';
import { INVERTED_DEFAULT_COLOR } from 'browser/renderer/shared/Constants';
import { IRenderDimensions } from 'browser/renderer/shared/Types';
import { ICoreBrowserService, IThemeService } from 'browser/services/Services';
import { ILinkifier2, ILinkifierEvent } from 'browser/Types';
import { IOptionsService } from 'common/services/Services';
import { ISharedExports, Terminal } from '@xterm/xterm';
import { BaseRenderLayer } from './BaseRenderLayer';

export class LinkRenderLayer extends BaseRenderLayer {
  private _state: ILinkifierEvent | undefined;

  constructor(
    sharedExports: ISharedExports,
    container: HTMLElement,
    zIndex: number,
    terminal: Terminal,
    linkifier2: ILinkifier2,
    coreBrowserService: ICoreBrowserService,
    optionsService: IOptionsService,
    themeService: IThemeService
  ) {
    super(sharedExports, terminal, container, 'link', zIndex, true, coreBrowserService, optionsService, themeService);

    this._register(linkifier2.onShowLinkUnderline(e => this._handleShowLinkUnderline(e)));
    this._register(linkifier2.onHideLinkUnderline(e => this._handleHideLinkUnderline(e)));
  }

  public resize(terminal: Terminal, dim: IRenderDimensions): void {
    super.resize(terminal, dim);
    // Resizing the canvas discards the contents of the canvas so clear state
    this._state = undefined;
  }

  public reset(terminal: Terminal): void {
    this._clearCurrentLink();
  }

  private _clearCurrentLink(): void {
    if (this._state) {
      this._clearCells(this._state.x1, this._state.y1, this._state.cols - this._state.x1, 1);
      const middleRowCount = this._state.y2 - this._state.y1 - 1;
      if (middleRowCount > 0) {
        this._clearCells(0, this._state.y1 + 1, this._state.cols, middleRowCount);
      }
      this._clearCells(0, this._state.y2, this._state.x2, 1);
      this._state = undefined;
    }
  }

  private _handleShowLinkUnderline(e: ILinkifierEvent): void {
    if (e.fg === INVERTED_DEFAULT_COLOR) {
      this._ctx.fillStyle = this._themeService.colors.background.css;
    } else if (e.fg !== undefined && is256Color(e.fg)) {
      // 256 color support
      this._ctx.fillStyle = this._themeService.colors.ansi[e.fg!].css;
    } else {
      this._ctx.fillStyle = this._themeService.colors.foreground.css;
    }

    if (e.y1 === e.y2) {
      // Single line link
      this._fillBottomLineAtCells(e.x1, e.y1, e.x2 - e.x1);
    } else {
      // Multi-line link
      this._fillBottomLineAtCells(e.x1, e.y1, e.cols - e.x1);
      for (let y = e.y1 + 1; y < e.y2; y++) {
        this._fillBottomLineAtCells(0, y, e.cols);
      }
      this._fillBottomLineAtCells(0, e.y2, e.x2);
    }
    this._state = e;
  }

  private _handleHideLinkUnderline(e: ILinkifierEvent): void {
    this._clearCurrentLink();
  }
}
