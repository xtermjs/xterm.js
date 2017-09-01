import { IDataRenderLayer } from './Interfaces';
import { IBuffer, ICharMeasure, ITerminal } from '../Interfaces';
import { CHAR_DATA_ATTR_INDEX } from '../Buffer';
import { COLORS } from './Color';
import { GridCache } from './GridCache';
import { FLAGS } from './Types';

export class CursorRenderLayer implements IDataRenderLayer {
  private _canvas: HTMLCanvasElement;
  private _ctx: CanvasRenderingContext2D;
  private _state: [number, number];

  constructor(container: HTMLElement) {
    this._canvas = document.createElement('canvas');
    this._canvas.classList.add('xterm-cursor-layer');
    this._ctx = this._canvas.getContext('2d');
    this._ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
    container.appendChild(this._canvas);
    this._state = null;
  }

  public resize(terminal: ITerminal, canvasWidth: number, canvasHeight: number, charSizeChanged: boolean): void {
    this._canvas.width = canvasWidth * window.devicePixelRatio;
    this._canvas.height = canvasHeight * window.devicePixelRatio;
    this._canvas.style.width = `${canvasWidth}px`;
    this._canvas.style.height = `${canvasHeight}px`;
  }

  public render(terminal: ITerminal, startRow: number, endRow: number): void {
    // TODO: Track blur/focus somehow, support unfocused cursor

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

    // TODO: Draw text in COLORS[0], using the char atlas if possible
    // const charData = terminal.buffer.lines.get(viewportRelativeCursorY)[terminal.buffer.x];

    this._ctx.save();
    this._ctx.fillStyle = COLORS[7];
    this._ctx.fillRect(terminal.buffer.x * scaledCharWidth, viewportRelativeCursorY * scaledCharHeight, scaledCharWidth, scaledCharHeight);
    this._ctx.restore();

    this._state = [terminal.buffer.x, viewportRelativeCursorY];
  }

  private _clearCursor(scaledCharWidth: number, scaledCharHeight: number): void {
    if (this._state) {
      this._ctx.clearRect(this._state[0] * scaledCharWidth, this._state[1] * scaledCharHeight, scaledCharWidth, scaledCharHeight);
      this._state = null;
    }
  }
}
