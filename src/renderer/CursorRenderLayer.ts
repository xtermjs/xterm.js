import { IDataRenderLayer } from './Interfaces';
import { IBuffer, ICharMeasure, ITerminal } from '../Interfaces';
import { CHAR_DATA_CODE_INDEX, CHAR_DATA_CHAR_INDEX } from '../Buffer';
import { COLORS, COLOR_CODES } from './Color';
import { GridCache } from './GridCache';
import { FLAGS } from './Types';
import { BaseRenderLayer } from './BaseRenderLayer';

export class CursorRenderLayer extends BaseRenderLayer implements IDataRenderLayer {
  private _state: [number, number];

  constructor(container: HTMLElement, zIndex: number) {
    super(container, 'cursor', zIndex);
    this._state = null;
  }

  public clear(terminal: ITerminal): void {
    const scaledCharWidth = Math.ceil(terminal.charMeasure.width) * window.devicePixelRatio;
    const scaledCharHeight = Math.ceil(terminal.charMeasure.height) * window.devicePixelRatio;
    this._clearCursor(scaledCharWidth, scaledCharHeight);
  }

  public render(terminal: ITerminal, startRow: number, endRow: number): void {
    // TODO: Track blur/focus somehow, support unfocused cursor

    // TODO: scaledCharWidth should probably be on Base as a per-terminal thing
    const scaledCharWidth = Math.ceil(terminal.charMeasure.width) * window.devicePixelRatio;
    const scaledCharHeight = Math.ceil(terminal.charMeasure.height) * window.devicePixelRatio;

    // Don't draw the cursor if it's hidden
    if (!terminal.cursorState || terminal.cursorHidden) {
      this._clearCursor(scaledCharWidth, scaledCharHeight);
      return;
    }

    const cursorY = terminal.buffer.ybase + terminal.buffer.y;
    const viewportRelativeCursorY = cursorY - terminal.buffer.ydisp;

    // Don't draw the cursor if it's off-screen
    if (viewportRelativeCursorY < 0 || viewportRelativeCursorY >= terminal.rows) {
      this._clearCursor(scaledCharWidth, scaledCharHeight);
      return;
    }

    if (this._state) {
      // The cursor is already in the correct spot, don't redraw
      if (this._state[0] === terminal.buffer.x && this._state[1] === viewportRelativeCursorY) {
        return;
      }
      this._clearCursor(scaledCharWidth, scaledCharHeight);
    }

    this._ctx.save();
    this._ctx.fillStyle = COLORS[COLOR_CODES.WHITE];
    this._ctx.fillRect(terminal.buffer.x * scaledCharWidth, viewportRelativeCursorY * scaledCharHeight, scaledCharWidth, scaledCharHeight);
    this._ctx.restore();

    const charData = terminal.buffer.lines.get(cursorY)[terminal.buffer.x];
    this.drawChar(terminal, charData[CHAR_DATA_CHAR_INDEX], <number>charData[CHAR_DATA_CODE_INDEX], COLOR_CODES.BLACK, terminal.buffer.x, viewportRelativeCursorY, scaledCharWidth, scaledCharHeight);

    this._state = [terminal.buffer.x, viewportRelativeCursorY];
  }

  private _clearCursor(scaledCharWidth: number, scaledCharHeight: number): void {
    if (this._state) {
      this._ctx.clearRect(this._state[0] * scaledCharWidth, this._state[1] * scaledCharHeight, scaledCharWidth, scaledCharHeight);
      this._state = null;
    }
  }
}
