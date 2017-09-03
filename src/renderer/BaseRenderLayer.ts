import { IRenderLayer, IColorSet } from './Interfaces';
import { ITerminal, ITerminalOptions } from '../Interfaces';
import { acquireCharAtlas, CHAR_ATLAS_CELL_SPACING } from './CharAtlas';
import { CharData } from '../Types';
import { CHAR_DATA_WIDTH_INDEX, CHAR_DATA_CHAR_INDEX } from '../Buffer';

export const INVERTED_DEFAULT_COLOR = -1;

export abstract class BaseRenderLayer implements IRenderLayer {
  private _canvas: HTMLCanvasElement;
  protected _ctx: CanvasRenderingContext2D;
  private scaledCharWidth: number;
  private scaledCharHeight: number;
  private scaledLineHeight: number;
  private scaledLineDrawY: number;

  // TODO: This should be shared between terminals, but not for static as some
  // terminals may have different styles
  private _charAtlas: HTMLCanvasElement | ImageBitmap;

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
  public onBlur(terminal: ITerminal): void {}
  public onFocus(terminal: ITerminal): void {}
  public onCursorMove(terminal: ITerminal): void {}
  public onGridChanged(terminal: ITerminal, startRow: number, endRow: number): void {}
  public onSelectionChanged(terminal: ITerminal, start: [number, number], end: [number, number]): void {}

  public onThemeChanged(terminal: ITerminal, colorSet: IColorSet): void {
    this._refreshCharAtlas(terminal, colorSet);
  }

  private _refreshCharAtlas(terminal: ITerminal, colorSet: IColorSet): void {
    this._charAtlas = null;
    const result = acquireCharAtlas(terminal, this.colors);
    if (result instanceof HTMLCanvasElement) {
      this._charAtlas = result;
    } else {
      result.then(bitmap => this._charAtlas = bitmap);
    }
  }

  public resize(terminal: ITerminal, canvasWidth: number, canvasHeight: number, charSizeChanged: boolean): void {
    this.scaledCharWidth = terminal.charMeasure.width * window.devicePixelRatio;
    this.scaledCharHeight = terminal.charMeasure.height * window.devicePixelRatio;
    this.scaledLineHeight = Math.ceil(this.scaledCharHeight * terminal.options.lineHeight);
    this.scaledLineDrawY = terminal.options.lineHeight === 1 ? 0 : Math.round((this.scaledLineHeight - this.scaledCharHeight) / 2);
    this._canvas.width = canvasWidth * window.devicePixelRatio;
    this._canvas.height = canvasHeight * window.devicePixelRatio;
    this._canvas.style.width = `${canvasWidth}px`;
    this._canvas.style.height = `${canvasHeight}px`;

    if (charSizeChanged) {
      this._refreshCharAtlas(terminal, this.colors);
    }
  }

  public abstract reset(terminal: ITerminal): void;

  protected fillCells(startCol: number, startRow: number, colWidth: number, colHeight: number): void {
    this._ctx.fillRect(startCol * this.scaledCharWidth, startRow * this.scaledLineHeight, colWidth * this.scaledCharWidth, colHeight * this.scaledLineHeight);
  }

  protected drawBottomLineAtCell(x: number, y: number): void {
    this._ctx.fillRect(
        x * this.scaledCharWidth,
        (y + 1) * this.scaledLineHeight - window.devicePixelRatio - 1 /* Ensure it's drawn within the cell */,
        this.scaledCharWidth,
        window.devicePixelRatio);
  }

  protected drawLeftLineAtCell(x: number, y: number): void {
    this._ctx.fillRect(
        x * this.scaledCharWidth,
        y * this.scaledLineHeight,
        window.devicePixelRatio,
        this.scaledLineHeight);
  }

  protected drawRectAtCell(x: number, y: number, width: number, height: number, color: string): void {
    this._ctx.strokeStyle = color;
    this._ctx.lineWidth = window.devicePixelRatio;
    this._ctx.strokeRect(
        x * this.scaledCharWidth + window.devicePixelRatio / 2,
        y * this.scaledLineHeight + (window.devicePixelRatio / 2),
        (width * this.scaledCharWidth) - window.devicePixelRatio,
        (height * this.scaledLineHeight) - window.devicePixelRatio);
  }

  protected clearAll(): void {
    this._ctx.clearRect(0, 0, this._canvas.width, this._canvas.height);
  }

  protected clearCells(startCol: number, startRow: number, colWidth: number, colHeight: number): void {
    this._ctx.clearRect(startCol * this.scaledCharWidth, startRow * this.scaledLineHeight, colWidth * this.scaledCharWidth, colHeight * this.scaledLineHeight);
  }

  protected drawCharTrueColor(terminal: ITerminal, charData: CharData, x: number, y: number, color: string): void {
    this._ctx.save();
    this._ctx.font = `${terminal.options.fontSize * window.devicePixelRatio}px ${terminal.options.fontFamily}`;
    this._ctx.textBaseline = 'top';
    this._ctx.fillStyle = color;

    // Since uncached characters are not coming off the char atlas with source
    // coordinates, it means that text drawn to the canvas (particularly '_')
    // can bleed into other cells. This code will clip the following fillText,
    // ensuring that its contents don't go beyond the cell bounds.
    this._ctx.beginPath();
    this._ctx.rect(x * this.scaledCharWidth, y * this.scaledLineHeight + this.scaledLineDrawY, charData[CHAR_DATA_WIDTH_INDEX] * this.scaledCharWidth, this.scaledCharHeight);
    this._ctx.clip();

    this._ctx.fillText(charData[CHAR_DATA_CHAR_INDEX], x * this.scaledCharWidth, y * this.scaledCharHeight);
    this._ctx.restore();
  }

  protected drawChar(terminal: ITerminal, char: string, code: number, width: number, x: number, y: number, fg: number, underline: boolean = false): void {
    // Clear the cell next to this character if it's wide
    if (width === 2) {
      this.clearCells(x + 1, y, 1, 1);
    }

    let colorIndex = 0;
    if (fg < 256) {
      colorIndex = fg + 1;
    }
    const isAscii = code < 256;
    const isBasicColor = (colorIndex > 0 && fg < 16);
    const isDefaultColor = fg >= 256;
    if (isAscii && (isBasicColor || isDefaultColor)) {
      // ImageBitmap's draw about twice as fast as from a canvas
      const charAtlasCellWidth = this.scaledCharWidth + CHAR_ATLAS_CELL_SPACING;
      const charAtlasCellHeight = this.scaledCharHeight + CHAR_ATLAS_CELL_SPACING;
      this._ctx.drawImage(this._charAtlas,
          code * charAtlasCellWidth, colorIndex * charAtlasCellHeight, this.scaledCharWidth, this.scaledCharHeight,
          x * this.scaledCharWidth, y * this.scaledLineHeight + this.scaledLineDrawY, this.scaledCharWidth, this.scaledCharHeight);
    } else {
      this._drawUncachedChar(terminal, char, width, fg, x, y);
    }
    // This draws the atlas (for debugging purposes)
    // this._ctx.drawImage(this._charAtlas, 0, 0);
  }

  private _drawUncachedChar(terminal: ITerminal, char: string, width: number, fg: number, x: number, y: number): void {
    this._ctx.save();
    this._ctx.font = `${terminal.options.fontSize * window.devicePixelRatio}px ${terminal.options.fontFamily}`;
    this._ctx.textBaseline = 'top';

    if (fg === INVERTED_DEFAULT_COLOR) {
      this._ctx.fillStyle = this.colors.background;
    } else if (fg < 256) {
      // 256 color support
      this._ctx.fillStyle = this.colors.ansi[fg];
    } else {
      this._ctx.fillStyle = this.colors.foreground;
    }

    // Since uncached characters are not coming off the char atlas with source
    // coordinates, it means that text drawn to the canvas (particularly '_')
    // can bleed into other cells. This code will clip the following fillText,
    // ensuring that its contents don't go beyond the cell bounds.
    this._ctx.beginPath();
    this._ctx.rect(x * this.scaledCharWidth, y * this.scaledLineHeight + this.scaledLineDrawY, width * this.scaledCharWidth, this.scaledCharHeight);
    this._ctx.clip();

    // Draw the character
    this._ctx.fillText(char, x * this.scaledCharWidth, y * this.scaledLineHeight + this.scaledLineDrawY);
    this._ctx.restore();
  }
}

