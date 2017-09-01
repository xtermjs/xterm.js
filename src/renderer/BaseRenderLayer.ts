import { IRenderLayer } from './Interfaces';
import { ITerminal } from '../Interfaces';
import { COLORS } from './Color';

export abstract class BaseRenderLayer implements IRenderLayer {
  protected _canvas: HTMLCanvasElement;
  protected _ctx: CanvasRenderingContext2D;

  protected static _charAtlas: ImageBitmap;
  private static _charAtlasCharWidth: number;
  private static _charAtlasCharHeight: number;
  private static _charAtlasGenerator: CharAtlasGenerator;

  constructor(container: HTMLElement, id: string, zIndex: number) {
    this._canvas = document.createElement('canvas');
    this._canvas.id = `xterm-${id}-layer`;
    this._canvas.style.zIndex = zIndex.toString();
    this._ctx = this._canvas.getContext('2d');
    this._ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
    container.appendChild(this._canvas);

    if (!BaseRenderLayer._charAtlasGenerator) {
      BaseRenderLayer._charAtlasGenerator = new CharAtlasGenerator();
    }
  }

  public resize(terminal: ITerminal, canvasWidth: number, canvasHeight: number, charSizeChanged: boolean): void {
    this._canvas.width = canvasWidth * window.devicePixelRatio;
    this._canvas.height = canvasHeight * window.devicePixelRatio;
    this._canvas.style.width = `${canvasWidth}px`;
    this._canvas.style.height = `${canvasHeight}px`;
    // Only update the char atlas if the char size changed
    if (charSizeChanged) {
      // Only update the char atlas if an update for the right dimensions is not
      // already in progress
      if (BaseRenderLayer._charAtlasCharWidth !== terminal.charMeasure.width ||
          BaseRenderLayer._charAtlasCharHeight !== terminal.charMeasure.height) {
        BaseRenderLayer._charAtlas = null;
        BaseRenderLayer._charAtlasCharWidth = terminal.charMeasure.width;
        BaseRenderLayer._charAtlasCharHeight = terminal.charMeasure.height;
        BaseRenderLayer._charAtlasGenerator.generate(terminal.charMeasure.width, terminal.charMeasure.height).then(bitmap => {
          BaseRenderLayer._charAtlas = bitmap;
        });
      }
    }
  }

  protected drawChar(char: string, code: number, fg: number, x: number, y: number, scaledCharWidth: number, scaledCharHeight: number): void {
    let colorIndex = 0;
    if (fg < 256) {
      colorIndex = fg + 1;
    }
    if (code < 256 && (colorIndex > 0 || fg > 255)) {
      // ImageBitmap's draw about twice as fast as from a canvas
      this._ctx.drawImage(BaseRenderLayer._charAtlas,
          code * scaledCharWidth, colorIndex * scaledCharHeight, scaledCharWidth, scaledCharHeight,
          x * scaledCharWidth, y * scaledCharHeight, scaledCharWidth, scaledCharHeight);
    } else {
      this._drawUncachedChar(char, fg, x, y, scaledCharWidth, scaledCharHeight);
    }
    // This draws the atlas (for debugging purposes)
    // this._ctx.drawImage(BaseRenderLayer._charAtlas, 0, 0);
  }

  private _drawUncachedChar(char: string, fg: number, x: number, y: number, scaledCharWidth: number, scaledCharHeight: number): void {
    this._ctx.save();
    this._ctx.font = `${16 * window.devicePixelRatio}px courier`;
    this._ctx.textBaseline = 'top';

    // 256 color support
    if (fg < 256) {
      this._ctx.fillStyle = COLORS[fg];
    } else {
      this._ctx.fillStyle = '#ffffff';
    }

    // TODO: Do we care about width for rendering wide chars?
    this._ctx.fillText(char, x * scaledCharWidth, y * scaledCharHeight);
    this._ctx.restore();
  }
}

class CharAtlasGenerator {
  private _canvas: HTMLCanvasElement;
  private _ctx: CanvasRenderingContext2D;

  constructor() {
    this._canvas = document.createElement('canvas');
    this._ctx = this._canvas.getContext('2d');
    this._ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
  }

  public generate(charWidth: number, charHeight: number): Promise<ImageBitmap> {
    const scaledCharWidth = Math.ceil(charWidth) * window.devicePixelRatio;
    const scaledCharHeight = Math.ceil(charHeight) * window.devicePixelRatio;

    this._canvas.width = 255 * scaledCharWidth;
    this._canvas.height = (/*default*/1 + /*0-15*/16) * scaledCharHeight;

    this._ctx.save();
    this._ctx.fillStyle = '#ffffff';
    this._ctx.font = `${16 * window.devicePixelRatio}px courier`;
    this._ctx.textBaseline = 'top';

    // Default color
    for (let i = 0; i < 256; i++) {
      this._ctx.fillText(String.fromCharCode(i), i * scaledCharWidth, 0);
    }

    // Colors 0-15
    for (let colorIndex = 0; colorIndex < 16; colorIndex++) {
      // colors 8-15 are bold
      if (colorIndex === 8) {
        this._ctx.font = `bold ${this._ctx.font}`;
      }
      const y = (colorIndex + 1) * scaledCharHeight;
      // Clear rectangle as some fonts seem to draw over the bottom boundary
      this._ctx.clearRect(0, y, this._canvas.width, scaledCharHeight);
      // Draw ascii characters
      for (let i = 0; i < 256; i++) {
        this._ctx.fillStyle = COLORS[colorIndex];
        this._ctx.fillText(String.fromCharCode(i), i * scaledCharWidth, y);
      }
    }
    this._ctx.restore();

    const charAtlasImageData = this._ctx.getImageData(0, 0, this._canvas.width, this._canvas.height);
    const promise = window.createImageBitmap(charAtlasImageData);
    // Clear the rect while the promise is in progress
    this._ctx.clearRect(0, 0, this._canvas.width, this._canvas.height);
    return promise;
  }
}
