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
    this._clearCursor();
  }

  public render(terminal: ITerminal, startRow: number, endRow: number): void {
    // TODO: Track blur/focus somehow, support unfocused cursor

    // Don't draw the cursor if it's hidden
    if (!terminal.cursorState || terminal.cursorHidden) {
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

    this._ctx.save();
    this._ctx.fillStyle = COLORS[COLOR_CODES.WHITE];
    this._ctx.fillRect(terminal.buffer.x * this.scaledCharWidth, viewportRelativeCursorY * this.scaledCharHeight, this.scaledCharWidth, this.scaledCharHeight);
    this._ctx.restore();

    const charData = terminal.buffer.lines.get(cursorY)[terminal.buffer.x];
    this.drawChar(terminal, charData[CHAR_DATA_CHAR_INDEX], <number>charData[CHAR_DATA_CODE_INDEX], COLOR_CODES.BLACK, terminal.buffer.x, viewportRelativeCursorY, this.scaledCharWidth, this.scaledCharHeight);

    this._state = [terminal.buffer.x, viewportRelativeCursorY];
  }

  private _clearCursor(): void {
    if (this._state) {
      this._ctx.clearRect(this._state[0] * this.scaledCharWidth, this._state[1] * this.scaledCharHeight, this.scaledCharWidth, this.scaledCharHeight);
      this._state = null;
    }
  }
}
