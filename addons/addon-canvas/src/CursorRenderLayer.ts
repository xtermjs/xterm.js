/**
 * Copyright (c) 2017 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import { CursorBlinkStateManager } from 'browser/renderer/shared/CursorBlinkStateManager';
import { IRenderDimensions, IRequestRedrawEvent } from 'browser/renderer/shared/Types';
import { ICoreBrowserService, IThemeService } from 'browser/services/Services';
import { IEventEmitter } from 'common/EventEmitter';
import { MutableDisposable } from 'common/Lifecycle';
import { isFirefox } from 'common/Platform';
import { ICellData } from 'common/Types';
import { CellData } from 'common/buffer/CellData';
import { IBufferService, ICoreService, IDecorationService, IOptionsService } from 'common/services/Services';
import { Terminal } from '@xterm/xterm';
import { BaseRenderLayer } from './BaseRenderLayer';

interface ICursorState {
  x: number;
  y: number;
  isFocused: boolean;
  style: string;
  width: number;
}

export class CursorRenderLayer extends BaseRenderLayer {
  private _state: ICursorState;
  private _cursorRenderers: {[key: string]: (x: number, y: number, cell: ICellData) => void};
  private _cursorBlinkStateManager: MutableDisposable<CursorBlinkStateManager> = this.register(new MutableDisposable());
  private _cell: ICellData = new CellData();

  constructor(
    terminal: Terminal,
    container: HTMLElement,
    zIndex: number,
    private readonly _onRequestRedraw: IEventEmitter<IRequestRedrawEvent>,
    bufferService: IBufferService,
    optionsService: IOptionsService,
    private readonly _coreService: ICoreService,
    coreBrowserService: ICoreBrowserService,
    decorationService: IDecorationService,
    themeService: IThemeService
  ) {
    super(terminal, container, 'cursor', zIndex, true, themeService, bufferService, optionsService, decorationService, coreBrowserService);
    this._state = {
      x: 0,
      y: 0,
      isFocused: false,
      style: '',
      width: 0
    };
    this._cursorRenderers = {
      'bar': this._renderBarCursor.bind(this),
      'block': this._renderBlockCursor.bind(this),
      'underline': this._renderUnderlineCursor.bind(this),
      'outline': this._renderOutlineCursor.bind(this)
    };
    this.register(optionsService.onOptionChange(() => this._handleOptionsChanged()));
    this._handleOptionsChanged();
  }

  public resize(dim: IRenderDimensions): void {
    super.resize(dim);
    // Resizing the canvas discards the contents of the canvas so clear state
    this._state = {
      x: 0,
      y: 0,
      isFocused: false,
      style: '',
      width: 0
    };
  }

  public reset(): void {
    this._clearCursor();
    this._cursorBlinkStateManager.value?.restartBlinkAnimation();
    this._handleOptionsChanged();
  }

  public handleBlur(): void {
    this._cursorBlinkStateManager.value?.pause();
    this._onRequestRedraw.fire({ start: this._bufferService.buffer.y, end: this._bufferService.buffer.y });
  }

  public handleFocus(): void {
    this._cursorBlinkStateManager.value?.resume();
    this._onRequestRedraw.fire({ start: this._bufferService.buffer.y, end: this._bufferService.buffer.y });
  }

  private _handleOptionsChanged(): void {
    if (this._optionsService.rawOptions.cursorBlink) {
      if (!this._cursorBlinkStateManager.value) {
        this._cursorBlinkStateManager.value = new CursorBlinkStateManager(() => this._render(true), this._coreBrowserService);
      }
    } else {
      this._cursorBlinkStateManager.clear();
    }
    // Request a refresh from the terminal as management of rendering is being
    // moved back to the terminal
    this._onRequestRedraw.fire({ start: this._bufferService.buffer.y, end: this._bufferService.buffer.y });
  }

  public handleCursorMove(): void {
    this._cursorBlinkStateManager.value?.restartBlinkAnimation();
  }

  public handleGridChanged(startRow: number, endRow: number): void {
    if (!this._cursorBlinkStateManager.value || this._cursorBlinkStateManager.value.isPaused) {
      this._render(false);
    } else {
      this._cursorBlinkStateManager.value.restartBlinkAnimation();
    }
  }

  private _render(triggeredByAnimationFrame: boolean): void {
    // Don't draw the cursor if it's hidden
    if (!this._coreService.isCursorInitialized || this._coreService.isCursorHidden) {
      this._clearCursor();
      return;
    }

    const cursorY = this._bufferService.buffer.ybase + this._bufferService.buffer.y;
    const viewportRelativeCursorY = cursorY - this._bufferService.buffer.ydisp;

    // Don't draw the cursor if it's off-screen
    if (viewportRelativeCursorY < 0 || viewportRelativeCursorY >= this._bufferService.rows) {
      this._clearCursor();
      return;
    }

    // in case cursor.x == cols adjust visual cursor to cols - 1
    const cursorX = Math.min(this._bufferService.buffer.x, this._bufferService.cols - 1);
    this._bufferService.buffer.lines.get(cursorY)!.loadCell(cursorX, this._cell);
    if (this._cell.content === undefined) {
      return;
    }

    if (!this._coreBrowserService.isFocused) {
      this._clearCursor();
      this._ctx.save();
      this._ctx.fillStyle = this._themeService.colors.cursor.css;
      const cursorStyle = this._optionsService.rawOptions.cursorStyle;
      const cursorInactiveStyle = this._optionsService.rawOptions.cursorInactiveStyle;
      if (cursorInactiveStyle && cursorInactiveStyle !== 'none') {
        this._cursorRenderers[cursorInactiveStyle](cursorX, viewportRelativeCursorY, this._cell);
      }
      this._ctx.restore();
      this._state.x = cursorX;
      this._state.y = viewportRelativeCursorY;
      this._state.isFocused = false;
      this._state.style = cursorStyle;
      this._state.width = this._cell.getWidth();
      return;
    }

    // Don't draw the cursor if it's blinking
    if (this._cursorBlinkStateManager.value && !this._cursorBlinkStateManager.value.isCursorVisible) {
      this._clearCursor();
      return;
    }

    if (this._state) {
      // The cursor is already in the correct spot, don't redraw
      if (this._state.x === cursorX &&
          this._state.y === viewportRelativeCursorY &&
          this._state.isFocused === this._coreBrowserService.isFocused &&
          this._state.style === this._optionsService.rawOptions.cursorStyle &&
          this._state.width === this._cell.getWidth()) {
        return;
      }
      this._clearCursor();
    }

    this._ctx.save();
    this._cursorRenderers[this._optionsService.rawOptions.cursorStyle || 'block'](cursorX, viewportRelativeCursorY, this._cell);
    this._ctx.restore();

    this._state.x = cursorX;
    this._state.y = viewportRelativeCursorY;
    this._state.isFocused = false;
    this._state.style = this._optionsService.rawOptions.cursorStyle;
    this._state.width = this._cell.getWidth();
  }

  private _clearCursor(): void {
    if (this._state) {
      // Avoid potential rounding errors when browser is Firefox (#4487) or device pixel ratio is
      // less than 1
      if (isFirefox || this._coreBrowserService.dpr < 1) {
        this._clearAll();
      } else {
        this._clearCells(this._state.x, this._state.y, this._state.width, 1);
      }
      this._state = {
        x: 0,
        y: 0,
        isFocused: false,
        style: '',
        width: 0
      };
    }
  }

  private _renderBarCursor(x: number, y: number, cell: ICellData): void {
    this._ctx.save();
    this._ctx.fillStyle = this._themeService.colors.cursor.css;
    this._fillLeftLineAtCell(x, y, this._optionsService.rawOptions.cursorWidth);
    this._ctx.restore();
  }

  private _renderBlockCursor(x: number, y: number, cell: ICellData): void {
    this._ctx.save();
    this._ctx.fillStyle = this._themeService.colors.cursor.css;
    this._fillCells(x, y, cell.getWidth(), 1);
    this._ctx.fillStyle = this._themeService.colors.cursorAccent.css;
    this._fillCharTrueColor(cell, x, y);
    this._ctx.restore();
  }

  private _renderUnderlineCursor(x: number, y: number, cell: ICellData): void {
    this._ctx.save();
    this._ctx.fillStyle = this._themeService.colors.cursor.css;
    this._fillBottomLineAtCells(x, y);
    this._ctx.restore();
  }

  private _renderOutlineCursor(x: number, y: number, cell: ICellData): void {
    this._ctx.save();
    this._ctx.strokeStyle = this._themeService.colors.cursor.css;
    this._strokeRectAtCell(x, y, cell.getWidth(), 1);
    this._ctx.restore();
  }
}
