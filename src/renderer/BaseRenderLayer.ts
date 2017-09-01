import { IRenderLayer, IColorSet } from './Interfaces';
import { ITerminal, ITerminalOptions } from '../Interfaces';
import { acquireCharAtlas } from '../utils/CharAtlas';

export abstract class BaseRenderLayer implements IRenderLayer {
  private _canvas: HTMLCanvasElement;
  protected _ctx: CanvasRenderingContext2D;
  private scaledCharWidth: number;
  private scaledCharHeight: number;

  // TODO: This should be shared between terminals, but not for static as some
  // terminals may have different styles
  private _charAtlas: ImageBitmap;

  constructor(
    container: HTMLElement,
    id: string,
    zIndex: number,
    protected colors: IColorSet
  ) {
    this._canvas = document.createElement('canvas');
    this._canvas.id = `xterm-${id}-layer`;
    this._canvas.style.zIndex = zIndex.toString();
    this._ctx = this._canvas.getContext('2d');
    this._ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
    container.appendChild(this._canvas);
  }

  // TODO: Should this do anything?
  public onOptionsChanged(terminal: ITerminal): void {}
  public onCursorMove(terminal: ITerminal): void {}
  public onGridChanged(terminal: ITerminal, startRow: number, endRow: number): void {}
  public onSelectionChanged(terminal: ITerminal, start: [number, number], end: [number, number]): void {}

  public onThemeChanged(terminal: ITerminal, colorSet: IColorSet): void {
    this._charAtlas = null;
    acquireCharAtlas(terminal, this.colors).then(bitmap => this._charAtlas = bitmap);
  }

  public resize(terminal: ITerminal, canvasWidth: number, canvasHeight: number, charSizeChanged: boolean): void {
    this.scaledCharWidth = terminal.charMeasure.width * window.devicePixelRatio;
    this.scaledCharHeight = terminal.charMeasure.height * window.devicePixelRatio;
    this._canvas.width = canvasWidth * window.devicePixelRatio;
    this._canvas.height = canvasHeight * window.devicePixelRatio;
    this._canvas.style.width = `${canvasWidth}px`;
    this._canvas.style.height = `${canvasHeight}px`;

    if (charSizeChanged) {
      acquireCharAtlas(terminal, this.colors).then(bitmap => this._charAtlas = bitmap);
    }
  }

  public abstract reset(terminal: ITerminal): void;

  protected fillCells(startCol: number, startRow: number, colWidth: number, colHeight: number): void {
    this._ctx.fillRect(startCol * this.scaledCharWidth, startRow * this.scaledCharHeight, colWidth * this.scaledCharWidth, colHeight * this.scaledCharHeight);
  }

  protected fillBottomLineAtCell(x: number, y: number): void {
    this._ctx.fillRect(
        x * this.scaledCharWidth,
        (y + 1) * this.scaledCharHeight - window.devicePixelRatio - 1 /* Ensure it's drawn within the cell */,
        this.scaledCharWidth,
        window.devicePixelRatio);
  }

  protected fillLeftLineAtCell(x: number, y: number): void {
    this._ctx.fillRect(
        x * this.scaledCharWidth,
        y * this.scaledCharHeight,
        window.devicePixelRatio,
        this.scaledCharHeight);
  }

  protected clearAll(): void {
    this._ctx.clearRect(0, 0, this._canvas.width, this._canvas.height);
  }

  protected clearCells(startCol: number, startRow: number, colWidth: number, colHeight: number): void {
    this._ctx.clearRect(startCol * this.scaledCharWidth, startRow * this.scaledCharHeight, colWidth * this.scaledCharWidth, colHeight * this.scaledCharHeight);
  }

  protected drawChar(terminal: ITerminal, char: string, code: number, fg: number, x: number, y: number): void {
    let colorIndex = 0;
    if (fg < 256) {
      colorIndex = fg + 1;
    }
    if (code < 256 && (colorIndex > 0 || fg > 255)) {
      // ImageBitmap's draw about twice as fast as from a canvas
      this._ctx.drawImage(this._charAtlas,
          code * this.scaledCharWidth, colorIndex * this.scaledCharHeight, this.scaledCharWidth, this.scaledCharHeight,
          x * this.scaledCharWidth, y * this.scaledCharHeight, this.scaledCharWidth, this.scaledCharHeight);
    } else {
      this._drawUncachedChar(terminal, char, fg, x, y, this.scaledCharWidth, this.scaledCharHeight);
    }
    // This draws the atlas (for debugging purposes)
    // this._ctx.drawImage(BaseRenderLayer._charAtlas, 0, 0);
  }

  private _drawUncachedChar(terminal: ITerminal, char: string, fg: number, x: number, y: number, scaledCharWidth: number, scaledCharHeight: number): void {
    this._ctx.save();
    this._ctx.font = `${terminal.options.fontSize * window.devicePixelRatio}px ${terminal.options.fontFamily}`;
    this._ctx.textBaseline = 'top';

    // 256 color support
    if (fg < 256) {
      this._ctx.fillStyle = this.colors.ansi[fg];
    } else {
      this._ctx.fillStyle = '#ffffff';
    }

    // TODO: Do we care about width for rendering wide chars?
    this._ctx.fillText(char, x * scaledCharWidth, y * scaledCharHeight);
    this._ctx.restore();
  }
}

