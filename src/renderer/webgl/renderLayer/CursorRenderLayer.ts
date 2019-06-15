/**
 * Copyright (c) 2017 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import { Terminal } from 'xterm';
import { BaseRenderLayer } from './BaseRenderLayer';
import { ICellData } from '../../../common/Types';
import { CellData } from '../../../common/buffer/CellData';
import { IColorSet } from 'browser/Types';
import { IRenderDimensions } from 'browser/renderer/Types';

interface ICursorState {
  x: number;
  y: number;
  isFocused: boolean;
  style: string;
  width: number;
}

/**
 * The time between cursor blinks.
 */
const BLINK_INTERVAL = 600;

export class CursorRenderLayer extends BaseRenderLayer {
  private _state: ICursorState;
  private _cursorRenderers: {[key: string]: (terminal: Terminal, x: number, y: number, cell: ICellData) => void};
  private _cursorBlinkStateManager: CursorBlinkStateManager;
  private _cell: ICellData = new CellData();

  constructor(container: HTMLElement, zIndex: number, colors: IColorSet) {
    super(container, 'cursor', zIndex, true, colors);
    this._state = {
      x: null,
      y: null,
      isFocused: null,
      style: null,
      width: null
    };
    this._cursorRenderers = {
      'bar': this._renderBarCursor.bind(this),
      'block': this._renderBlockCursor.bind(this),
      'underline': this._renderUnderlineCursor.bind(this)
    };
    // TODO: Consider initial options? Maybe onOptionsChanged should be called at the end of open?
  }

  public resize(terminal: Terminal, dim: IRenderDimensions): void {
    super.resize(terminal, dim);
    // Resizing the canvas discards the contents of the canvas so clear state
    this._state = {
      x: null,
      y: null,
      isFocused: null,
      style: null,
      width: null
    };
  }

  public reset(terminal: Terminal): void {
    this._clearCursor();
    if (this._cursorBlinkStateManager) {
      this._cursorBlinkStateManager.dispose();
      this._cursorBlinkStateManager = null;
      this.onOptionsChanged(terminal);
    }
  }

  public onBlur(terminal: Terminal): void {
    if (this._cursorBlinkStateManager) {
      this._cursorBlinkStateManager.pause();
    }
    terminal.refresh(terminal.buffer.cursorY, terminal.buffer.cursorY);
  }

  public onFocus(terminal: Terminal): void {
    if (this._cursorBlinkStateManager) {
      this._cursorBlinkStateManager.resume(terminal);
    } else {
      terminal.refresh(terminal.buffer.cursorY, terminal.buffer.cursorY);
    }
  }

  public onOptionsChanged(terminal: Terminal): void {
    if (terminal.getOption('cursorBlink')) {
      if (!this._cursorBlinkStateManager) {
        this._cursorBlinkStateManager = new CursorBlinkStateManager(terminal, () => {
          this._render(terminal, true);
        });
      }
    } else {
      if (this._cursorBlinkStateManager) {
        this._cursorBlinkStateManager.dispose();
        this._cursorBlinkStateManager = null;
      }
      // Request a refresh from the terminal as management of rendering is being
      // moved back to the terminal
      terminal.refresh(terminal.buffer.cursorY, terminal.buffer.cursorY);
    }
  }

  public onCursorMove(terminal: Terminal): void {
    if (this._cursorBlinkStateManager) {
      this._cursorBlinkStateManager.restartBlinkAnimation(terminal);
    }
  }

  public onGridChanged(terminal: Terminal, startRow: number, endRow: number): void {
    if (!this._cursorBlinkStateManager || this._cursorBlinkStateManager.isPaused) {
      this._render(terminal, false);
    } else {
      this._cursorBlinkStateManager.restartBlinkAnimation(terminal);
    }
  }

  private _render(terminal: Terminal, triggeredByAnimationFrame: boolean): void {
    // Don't draw the cursor if it's hidden
    // TODO: Need to expose API for this
    if (!(terminal as any)._core.cursorState || (terminal as any)._core.cursorHidden) {
      this._clearCursor();
      return;
    }

    const cursorY = terminal.buffer.baseY + terminal.buffer.cursorY;
    const viewportRelativeCursorY = cursorY - terminal.buffer.viewportY;

    // Don't draw the cursor if it's off-screen
    if (viewportRelativeCursorY < 0 || viewportRelativeCursorY >= terminal.rows) {
      this._clearCursor();
      return;
    }

    // TODO: Need fast buffer API for loading cell
    (terminal as any)._core.buffer.lines.get(cursorY).loadCell(terminal.buffer.cursorX, this._cell);
    if (this._cell.content === undefined) {
      return;
    }

    if (!isTerminalFocused(terminal)) {
      this._clearCursor();
      this._ctx.save();
      this._ctx.fillStyle = this._colors.cursor.css;
      this._renderBlurCursor(terminal, terminal.buffer.cursorX, viewportRelativeCursorY, this._cell);
      this._ctx.restore();
      this._state.x = terminal.buffer.cursorX;
      this._state.y = viewportRelativeCursorY;
      this._state.isFocused = false;
      this._state.style = terminal.getOption('cursorStyle');
      this._state.width = this._cell.getWidth();
      return;
    }

    // Don't draw the cursor if it's blinking
    if (this._cursorBlinkStateManager && !this._cursorBlinkStateManager.isCursorVisible) {
      this._clearCursor();
      return;
    }

    if (this._state) {
      // The cursor is already in the correct spot, don't redraw
      if (this._state.x === terminal.buffer.cursorX &&
          this._state.y === viewportRelativeCursorY &&
          this._state.isFocused === isTerminalFocused(terminal) &&
          this._state.style === terminal.getOption('cursorStyle') &&
          this._state.width === this._cell.getWidth()) {
        return;
      }
      this._clearCursor();
    }

    this._ctx.save();
    this._cursorRenderers[terminal.getOption('cursorStyle') || 'block'](terminal, terminal.buffer.cursorX, viewportRelativeCursorY, this._cell);
    this._ctx.restore();

    this._state.x = terminal.buffer.cursorX;
    this._state.y = viewportRelativeCursorY;
    this._state.isFocused = false;
    this._state.style = terminal.getOption('cursorStyle');
    this._state.width = this._cell.getWidth();
  }

  private _clearCursor(): void {
    if (this._state) {
      this.clearCells(this._state.x, this._state.y, this._state.width, 1);
      this._state = {
        x: null,
        y: null,
        isFocused: null,
        style: null,
        width: null
      };
    }
  }

  private _renderBarCursor(terminal: Terminal, x: number, y: number, cell: ICellData): void {
    this._ctx.save();
    this._ctx.fillStyle = this._colors.cursor.css;
    this.fillLeftLineAtCell(x, y);
    this._ctx.restore();
  }

  private _renderBlockCursor(terminal: Terminal, x: number, y: number, cell: ICellData): void {
    this._ctx.save();
    this._ctx.fillStyle = this._colors.cursor.css;
    this.fillCells(x, y, cell.getWidth(), 1);
    this._ctx.fillStyle = this._colors.cursorAccent.css;
    this.fillCharTrueColor(terminal, cell, x, y);
    this._ctx.restore();
  }

  private _renderUnderlineCursor(terminal: Terminal, x: number, y: number, cell: ICellData): void {
    this._ctx.save();
    this._ctx.fillStyle = this._colors.cursor.css;
    this.fillBottomLineAtCells(x, y);
    this._ctx.restore();
  }

  private _renderBlurCursor(terminal: Terminal, x: number, y: number, cell: ICellData): void {
    this._ctx.save();
    this._ctx.strokeStyle = this._colors.cursor.css;
    this.strokeRectAtCell(x, y, cell.getWidth(), 1);
    this._ctx.restore();
  }
}

class CursorBlinkStateManager {
  public isCursorVisible: boolean;

  private _animationFrame: number;
  private _blinkStartTimeout: number;
  private _blinkInterval: number;

  /**
   * The time at which the animation frame was restarted, this is used on the
   * next render to restart the timers so they don't need to restart the timers
   * multiple times over a short period.
   */
  private _animationTimeRestarted: number;

  constructor(
    terminal: Terminal,
    private _renderCallback: () => void
  ) {
    this.isCursorVisible = true;
    if (isTerminalFocused(terminal)) {
      this._restartInterval();
    }
  }

  public get isPaused(): boolean { return !(this._blinkStartTimeout || this._blinkInterval); }

  public dispose(): void {
    if (this._blinkInterval) {
      window.clearInterval(this._blinkInterval);
      this._blinkInterval = null;
    }
    if (this._blinkStartTimeout) {
      window.clearTimeout(this._blinkStartTimeout);
      this._blinkStartTimeout = null;
    }
    if (this._animationFrame) {
      window.cancelAnimationFrame(this._animationFrame);
      this._animationFrame = null;
    }
  }

  public restartBlinkAnimation(terminal: Terminal): void {
    if (this.isPaused) {
      return;
    }
    // Save a timestamp so that the restart can be done on the next interval
    this._animationTimeRestarted = Date.now();
    // Force a cursor render to ensure it's visible and in the correct position
    this.isCursorVisible = true;
    if (!this._animationFrame) {
      this._animationFrame = window.requestAnimationFrame(() => {
        this._renderCallback();
        this._animationFrame = null;
      });
    }
  }

  private _restartInterval(timeToStart: number = BLINK_INTERVAL): void {
    // Clear any existing interval
    if (this._blinkInterval) {
      window.clearInterval(this._blinkInterval);
    }

    // Setup the initial timeout which will hide the cursor, this is done before
    // the regular interval is setup in order to support restarting the blink
    // animation in a lightweight way (without thrashing clearInterval and
    // setInterval).
    this._blinkStartTimeout = <number><any>setTimeout(() => {
      // Check if another animation restart was requested while this was being
      // started
      if (this._animationTimeRestarted) {
        const time = BLINK_INTERVAL - (Date.now() - this._animationTimeRestarted);
        this._animationTimeRestarted = null;
        if (time > 0) {
          this._restartInterval(time);
          return;
        }
      }

      // Hide the cursor
      this.isCursorVisible = false;
      this._animationFrame = window.requestAnimationFrame(() => {
        this._renderCallback();
        this._animationFrame = null;
      });

      // Setup the blink interval
      this._blinkInterval = <number><any>setInterval(() => {
        // Adjust the animation time if it was restarted
        if (this._animationTimeRestarted) {
          // calc time diff
          // Make restart interval do a setTimeout initially?
          const time = BLINK_INTERVAL - (Date.now() - this._animationTimeRestarted);
          this._animationTimeRestarted = null;
          this._restartInterval(time);
          return;
        }

        // Invert visibility and render
        this.isCursorVisible = !this.isCursorVisible;
        this._animationFrame = window.requestAnimationFrame(() => {
          this._renderCallback();
          this._animationFrame = null;
        });
      }, BLINK_INTERVAL);
    }, timeToStart);
  }

  public pause(): void {
    this.isCursorVisible = true;
    if (this._blinkInterval) {
      window.clearInterval(this._blinkInterval);
      this._blinkInterval = null;
    }
    if (this._blinkStartTimeout) {
      window.clearTimeout(this._blinkStartTimeout);
      this._blinkStartTimeout = null;
    }
    if (this._animationFrame) {
      window.cancelAnimationFrame(this._animationFrame);
      this._animationFrame = null;
    }
  }

  public resume(terminal: Terminal): void {
    this._animationTimeRestarted = null;
    this._restartInterval();
    this.restartBlinkAnimation(terminal);
  }
}

function isTerminalFocused(terminal: Terminal): boolean {
  return document.activeElement === terminal.textarea && document.hasFocus();
}
