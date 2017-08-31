import { IDataRenderLayer } from './Interfaces';
import { IBuffer, ICharMeasure, ITerminal } from '../Interfaces';
import { CHAR_DATA_ATTR_INDEX, CHAR_DATA_CODE_INDEX, CHAR_DATA_CHAR_INDEX, CHAR_DATA_WIDTH_INDEX } from '../Buffer';
import { TANGO_COLORS } from './Color';
import { FLAGS } from './Types';
import { GridCache } from './GridCache';
import { CharData } from '../Types';

export class ForegroundRenderLayer implements IDataRenderLayer {
  private _canvas: HTMLCanvasElement;
  private _ctx: CanvasRenderingContext2D;
  private _charAtlas: ImageBitmap;
  private _state: GridCache<CharData>;

  private _charAtlasGenerator: CharAtlasGenerator;

  constructor(container: HTMLElement) {
    this._canvas = document.createElement('canvas');
    this._canvas.classList.add('xterm-fg-layer');
    this._ctx = this._canvas.getContext('2d');
    this._ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
    container.appendChild(this._canvas);
    this._charAtlasGenerator = new CharAtlasGenerator();
    this._state = new GridCache<CharData>();
  }

  public resize(terminal: ITerminal, canvasWidth: number, canvasHeight: number, charSizeChanged: boolean): void {
    this._canvas.width = canvasWidth * window.devicePixelRatio;
    this._canvas.height = canvasHeight * window.devicePixelRatio;
    this._canvas.style.width = `${canvasWidth}px`;
    this._canvas.style.height = `${canvasHeight}px`;
    this._state.resize(terminal.cols, terminal.rows);
    if (charSizeChanged) {
      this._charAtlas = null;
      this._charAtlasGenerator.generate(terminal.charMeasure.width, terminal.charMeasure.height).then(bitmap => {
        this._charAtlas = bitmap;
      });
    }
  }

  public render(terminal: ITerminal, startRow: number, endRow: number): void {
    const scaledCharWidth = Math.ceil(terminal.charMeasure.width) * window.devicePixelRatio;
    const scaledCharHeight = Math.ceil(terminal.charMeasure.height) * window.devicePixelRatio;

    // TODO: Ensure that the render is eventually performed
    // Don't bother render until the atlas bitmap is ready
    if (!this._charAtlas) {
      return;
    }

    this._ctx.fillStyle = '#ffffff';
    this._ctx.textBaseline = 'top';
    this._ctx.font = `${16 * window.devicePixelRatio}px courier`;

    for (let y = startRow; y <= endRow; y++) {
      let row = y + terminal.buffer.ydisp;
      let line = terminal.buffer.lines.get(row);

      for (let x = 0; x < terminal.cols; x++) {
        const charData = line[x];
        const code: number = <number>charData[CHAR_DATA_CODE_INDEX];
        const char: string = charData[CHAR_DATA_CHAR_INDEX];
        const attr: number = charData[CHAR_DATA_ATTR_INDEX];

        // Skip rendering if the character is identical
        const state = this._state.cache[x][y];
        if (state && state[CHAR_DATA_CHAR_INDEX] === char && state[CHAR_DATA_ATTR_INDEX] === attr) {
          // Skip render, contents are identical
          this._state.cache[x][y] = charData;
          continue;
        }
        this._state.cache[x][y] = charData;

        // Clear the old character
        this._ctx.clearRect(x * scaledCharWidth, y * scaledCharHeight, scaledCharWidth, scaledCharHeight);

        // Skip rendering if the character is invisible
        if (!code || code === 32 /*' '*/) {
          continue;
        }

        let fg = (attr >> 9) & 0x1ff;
        const flags = attr >> 18;

        // If inverse flag is on, the foreground should become the background.
        if (flags & FLAGS.INVERSE) {
          fg = attr & 0x1ff;
          // TODO: Is this case still needed
          if (fg === 257) {
            fg = 0;
          }
        }

        if (flags & FLAGS.BOLD) {
          this._ctx.font = `bold ${this._ctx.font}`;
          // Convert the FG color to the bold variant
          if (fg < 8) {
            fg += 8;
          }
        }

        let colorIndex = 0;
        if (fg < 16) {
          colorIndex = fg + 1;
        }

        if (code < 256) {
          // ImageBitmap's draw about twice as fast as from a canvas
          this._ctx.drawImage(this._charAtlas, code * scaledCharWidth, colorIndex * scaledCharHeight, scaledCharWidth, scaledCharHeight, x * scaledCharWidth, y * scaledCharHeight, scaledCharWidth, scaledCharHeight);
        } else {
          // TODO: Evaluate how long it takes to convert from a number
          const width: number = charData[CHAR_DATA_WIDTH_INDEX];
          this._drawUnicodeChar(char, width, fg, x, y, scaledCharWidth, scaledCharHeight);
        }
      }
    }

    // This draws the atlas (for debugging purposes)
    // this._ctx.drawImage(this._charAtlas, 0, 0);
  }

  private _drawUnicodeChar(char: string, width: number, fg: number, x: number, y: number, scaledCharWidth: number, scaledCharHeight: number): void {
    this._ctx.save();
    this._ctx.font = `${16 * window.devicePixelRatio}px courier`;
    this._ctx.textBaseline = 'top';

    if (fg < 16) {
      this._ctx.fillStyle = TANGO_COLORS[fg];
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
        this._ctx.fillStyle = TANGO_COLORS[colorIndex];
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
