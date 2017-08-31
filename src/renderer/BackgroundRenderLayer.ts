import { IRenderLayer } from './Interfaces';
import { IBuffer, ICharMeasure, ITerminal } from '../Interfaces';
import { CHAR_DATA_ATTR_INDEX } from '../Buffer';
import { TANGO_COLORS } from './Color';
import { GridCache } from './GridCache';

export class BackgroundRenderLayer implements IRenderLayer {
  private _canvas: HTMLCanvasElement;
  private _ctx: CanvasRenderingContext2D;
  private _state: GridCache<number>;

  constructor(container: HTMLElement) {
    this._canvas = document.createElement('canvas');
    this._canvas.classList.add('xterm-bg-layer');
    this._ctx = this._canvas.getContext('2d');
    this._ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
    container.appendChild(this._canvas);
    this._state = new GridCache<number>();
  }

  public resize(terminal: ITerminal, canvasWidth: number, canvasHeight: number, charSizeChanged: boolean): void {
    this._canvas.width = canvasWidth * window.devicePixelRatio;
    this._canvas.height = canvasHeight * window.devicePixelRatio;
    this._canvas.style.width = `${canvasWidth}px`;
    this._canvas.style.height = `${canvasHeight}px`;
    this._state.resize(terminal.cols, terminal.rows);
  }

  public render(terminal: ITerminal, startRow: number, endRow: number): void {
    const scaledCharWidth = Math.ceil(terminal.charMeasure.width) * window.devicePixelRatio;
    const scaledCharHeight = Math.ceil(terminal.charMeasure.height) * window.devicePixelRatio;

    for (let y = startRow; y <= endRow; y++) {
      let row = y + terminal.buffer.ydisp;
      let line = terminal.buffer.lines.get(row);
      for (let x = 0; x < terminal.cols; x++) {
        const data: number = line[x][CHAR_DATA_ATTR_INDEX];
        const bg = data & 0x1ff;
        const flags = data >> 18;

        const cellState = this._state.cache[x][y];
        const needsRefresh = (bg < 16 && cellState !== bg) || cellState !== null;
        if (needsRefresh) {
          if (bg < 16) {
            this._ctx.save();
            this._ctx.fillStyle = TANGO_COLORS[bg];
            this._ctx.fillRect(x * scaledCharWidth, y * scaledCharHeight, scaledCharWidth, scaledCharHeight);
            this._ctx.restore();
            this._state.cache[x][y] = bg;
          } else {
            this._ctx.clearRect(x * scaledCharWidth, y * scaledCharHeight, scaledCharWidth, scaledCharHeight);
            this._state.cache[x][y] = null;
          }
        }
      }
    }
  }
}
