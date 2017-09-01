import { ITerminal } from '../Interfaces';
import { IColorSet } from '../renderer/Interfaces';

export function acquireCharAtlas(terminal: ITerminal, colors: IColorSet): Promise<ImageBitmap> {
  const scaledCharWidth = terminal.charMeasure.width * window.devicePixelRatio;
  const scaledCharHeight = terminal.charMeasure.height * window.devicePixelRatio;

  // TODO: Check to see if the atlas already exists in a cache

  return generator.generate(scaledCharWidth, scaledCharHeight, terminal.options.fontSize, terminal.options.fontFamily, colors.foreground, colors.ansi);
}

export function releaseCharAtlas(terminal: ITerminal): void {
  // TODO: Release the char atlas if it's no longer needed
}

class CharAtlasGenerator {
  private _canvas: HTMLCanvasElement;
  private _ctx: CanvasRenderingContext2D;

  constructor() {
    this._canvas = document.createElement('canvas');
    this._ctx = this._canvas.getContext('2d');
    this._ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
  }

  public generate(scaledCharWidth: number, scaledCharHeight: number, fontSize: number, fontFamily: string, foreground: string, ansiColors: string[]): Promise<ImageBitmap> {
    this._canvas.width = 255 * scaledCharWidth;
    this._canvas.height = (/*default*/1 + /*0-15*/16) * scaledCharHeight;

    this._ctx.save();
    this._ctx.fillStyle = foreground;
    this._ctx.font = `${fontSize * window.devicePixelRatio}px ${fontFamily}`;
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
        this._ctx.fillStyle = ansiColors[colorIndex];
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

const generator = new CharAtlasGenerator();
