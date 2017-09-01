import { IDataRenderLayer } from './Interfaces';
import { IBuffer, ICharMeasure, ITerminal } from '../Interfaces';
import { CHAR_DATA_ATTR_INDEX } from '../Buffer';
import { COLORS } from './Color';
import { GridCache } from './GridCache';
import { FLAGS } from './Types';
import { BaseRenderLayer } from './BaseRenderLayer';

export class BackgroundRenderLayer extends BaseRenderLayer implements IDataRenderLayer {
  private _state: GridCache<number>;

  constructor(container: HTMLElement, zIndex: number) {
    super(container, 'bg', zIndex);
    this._state = new GridCache<number>();
  }

  public resize(terminal: ITerminal, canvasWidth: number, canvasHeight: number, charSizeChanged: boolean): void {
    super.resize(terminal, canvasWidth, canvasHeight, charSizeChanged);
    this._state.resize(terminal.cols, terminal.rows);
  }

  public render(terminal: ITerminal, startRow: number, endRow: number): void {
    const scaledCharWidth = Math.ceil(terminal.charMeasure.width) * window.devicePixelRatio;
    const scaledCharHeight = Math.ceil(terminal.charMeasure.height) * window.devicePixelRatio;

    for (let y = startRow; y <= endRow; y++) {
      let row = y + terminal.buffer.ydisp;
      let line = terminal.buffer.lines.get(row);
      for (let x = 0; x < terminal.cols; x++) {
        const attr: number = line[x][CHAR_DATA_ATTR_INDEX];
        let bg = attr & 0x1ff;
        const flags = attr >> 18;

        // If inverse flag is on, the background should become the foreground.
        if (flags & FLAGS.INVERSE) {
          bg = (attr >> 9) & 0x1ff;
          // TODO: Is this case still needed
          if (bg === 257) {
            bg = 15;
          }
        }

        const cellState = this._state.cache[x][y];
        const needsRefresh = (bg < 256 && cellState !== bg) || cellState !== null;
        if (needsRefresh) {
          if (bg < 256) {
            this._ctx.save();
            this._ctx.fillStyle = COLORS[bg];
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
