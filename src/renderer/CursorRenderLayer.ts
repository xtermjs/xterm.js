import { IDataRenderLayer } from './Interfaces';
import { IBuffer, ICharMeasure, ITerminal, ITerminalOptions } from '../Interfaces';
import { CHAR_DATA_CODE_INDEX, CHAR_DATA_CHAR_INDEX } from '../Buffer';
import { COLORS, COLOR_CODES } from './Color';
import { GridCache } from './GridCache';
import { FLAGS } from './Types';
import { BaseRenderLayer } from './BaseRenderLayer';
import { CharData } from '../Types';

/**
 * The time between cursor blinks.
 */
const BLINK_INTERVAL = 600;

export class CursorRenderLayer extends BaseRenderLayer implements IDataRenderLayer {
  private _state: [number, number];
  private _cursorRenderers: {[key: string]: (terminal: ITerminal, x: number, y: number, charData: CharData) => void};
  private _animationFrame: number;
  private _blinkInterval: number;
  private _isVisible: boolean;

  /**
   * The time at which the animation frame was restarted, this is used on the
   * next render to restart the timers so they don't need to restart the timers
   * multiple times over a short period.
   */
  private _animationTimeRestarted: number;

  private _cursorBlinkStateManager: CursorBlinkStateManager;

  constructor(container: HTMLElement, zIndex: number) {
    super(container, 'cursor', zIndex);
    this._state = null;
    this._isVisible = true;
    this._cursorRenderers = {
      'bar': this._renderBarCursor.bind(this),
      'block': this._renderBlockCursor.bind(this),
      'underline': this._renderUnderlineCursor.bind(this)
    };
    // TODO: Consider initial options? Maybe onOptionsChanged should be called at the end of open?
  }

  public reset(terminal: ITerminal): void {
    this._clearCursor();
    this._isVisible = true;
  }

  public onOptionsChanged(terminal: ITerminal): void {
    super.onOptionsChanged(terminal);
    if (terminal.options.cursorBlink) {
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
      terminal.refresh(terminal.buffer.y, terminal.buffer.y);
    }
  }

  public render(terminal: ITerminal, startRow: number, endRow: number): void {
    // Only render if the animation frame is not active
    if (!this._cursorBlinkStateManager) {
      this._render(terminal, false);
    }
  }

  private _render(terminal: ITerminal, triggeredByAnimationFrame: boolean): void {
    // TODO: Track blur/focus somehow, support unfocused cursor
    // Don't draw the cursor if it's hidden
    if (!terminal.cursorState ||
        terminal.cursorHidden ||
        (this._cursorBlinkStateManager && !this._cursorBlinkStateManager.isCursorVisible)) {
      this._clearCursor();
      return;
    }

    const cursorY = terminal.buffer.ybase + terminal.buffer.y;
    const viewportRelativeCursorY = cursorY - terminal.buffer.ydisp;

    // Don't draw the cursor if it's off-screen
    if (viewportRelativeCursorY < 0 || viewportRelativeCursorY >= terminal.rows) {
      this._clearCursor();
      return;
    }

    if (this._state) {
      // The cursor is already in the correct spot, don't redraw
      if (this._state[0] === terminal.buffer.x && this._state[1] === viewportRelativeCursorY) {
        return;
      }
      this._clearCursor();
    }

    const charData = terminal.buffer.lines.get(cursorY)[terminal.buffer.x];
    this._ctx.save();
    this._ctx.fillStyle = COLORS[COLOR_CODES.WHITE];
    this._cursorRenderers[terminal.options.cursorStyle || 'block'](terminal, terminal.buffer.x, viewportRelativeCursorY, charData);
    this._ctx.restore();
    this._state = [terminal.buffer.x, viewportRelativeCursorY];
  }

  private _clearCursor(): void {
    if (this._state) {
      this.clearCells(this._state[0], this._state[1], 1, 1);
      this._state = null;
    }
  }

  private _renderBarCursor(terminal: ITerminal, x: number, y: number, charData: CharData): void {
    this.fillLeftLineAtCell(x, y);
  }

  private _renderBlockCursor(terminal: ITerminal, x: number, y: number, charData: CharData): void {
    this.fillCells(x, y, 1, 1);
    this.drawChar(terminal, charData[CHAR_DATA_CHAR_INDEX], <number>charData[CHAR_DATA_CODE_INDEX], COLOR_CODES.BLACK, x, y);
  }

  private _renderUnderlineCursor(terminal: ITerminal, x: number, y: number, charData: CharData): void {
    this.fillBottomLineAtCell(x, y);
  }
}

class CursorBlinkStateManager {
  public isCursorVisible: boolean;

  private _animationFrame: number;
  private _blinkInterval: number;

  constructor(
    terminal: ITerminal,
    private renderCallback: () => void
  ) {
    this.isCursorVisible = true;
    this._blinkInterval = <number><any>setInterval(() => {
      this.isCursorVisible = !this.isCursorVisible;
      this._animationFrame = window.requestAnimationFrame(() => {
        this.renderCallback();
        this._animationFrame = null;
      });
    }, BLINK_INTERVAL);
  }

  public dispose(): void {
    window.clearInterval(this._blinkInterval);
    this._blinkInterval = null;
    if (this._animationFrame) {
      window.cancelAnimationFrame(this._animationFrame);
      this._animationFrame = null;
    }
  }

  private _restartBlinkAnimation(terminal: ITerminal): void {
    // TODO: Restart the blink animation when input is received
    // How can this be done efficiently, without thrashing with restarting the timers?
    // Could record the time it was restarted and diff that on next render?
  }

  private _pauseBlinkAnimation(): void {
    // TODO: Pause the blink animation on blur
  }

  private _resumeBlinkAnimation(): void {
    // TODO: Resume the blink animation on focus
  }
}
