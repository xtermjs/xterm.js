import { IRenderLayer } from './Interfaces';
import { IBuffer, ICharMeasure, ITerminal } from '../Interfaces';
import { CHAR_DATA_ATTR_INDEX } from '../Buffer';

export class BackgroundRenderLayer implements IRenderLayer {
  private _canvas: HTMLCanvasElement;
  private _ctx: CanvasRenderingContext2D;

  // TODO: Pull colors into some other class
  private _colors = [
    // dark:
    '#2e3436',
    '#cc0000',
    '#4e9a06',
    '#c4a000',
    '#3465a4',
    '#75507b',
    '#06989a',
    '#d3d7cf',
    // bright:
    '#555753',
    '#ef2929',
    '#8ae234',
    '#fce94f',
    '#729fcf',
    '#ad7fa8',
    '#34e2e2',
    '#eeeeec'
  ];

  constructor(container: HTMLElement) {
    this._canvas = document.createElement('canvas');
    this._canvas.classList.add('xterm-bg-canvas');
    this._ctx = this._canvas.getContext('2d');
    this._ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
    container.appendChild(this._canvas);
  }

  public resize(canvasWidth: number, canvasHeight: number, charWidth: number, charHeight: number): void {
    this._canvas.width = canvasWidth * window.devicePixelRatio;
    this._canvas.height = canvasHeight * window.devicePixelRatio;
    this._canvas.style.width = `${canvasWidth}px`;
    this._canvas.style.height = `${canvasHeight}px`;
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

        // TODO: Draw background
        if (bg < 16) {
          this._ctx.save();
          this._ctx.fillStyle = this._colors[bg];
          this._ctx.fillRect(x * scaledCharWidth, y * scaledCharHeight, scaledCharWidth, scaledCharHeight);
          this._ctx.restore();
        } else {
          this._ctx.clearRect(x * scaledCharWidth, y * scaledCharHeight, scaledCharWidth, scaledCharHeight);
        }
      }
    }
  }
}
