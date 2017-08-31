import { IRenderLayer } from './Interfaces';
import { IBuffer, ICharMeasure, ITerminal } from '../Interfaces';
import { CHAR_DATA_ATTR_INDEX } from '../Buffer';
import { TANGO_COLORS } from './Color';
import { FLAGS } from './Types';

export class ForegroundRenderLayer implements IRenderLayer {
  private _canvas: HTMLCanvasElement;
  private _ctx: CanvasRenderingContext2D;
  private _charAtlas: ImageBitmap;

  private _charAtlasGenerator: CharAtlasGenerator;

  constructor(container: HTMLElement) {
    this._canvas = document.createElement('canvas');
    this._canvas.classList.add('xterm-fg-layer');
    this._ctx = this._canvas.getContext('2d');
    this._ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
    container.appendChild(this._canvas);
    this._charAtlasGenerator = new CharAtlasGenerator();
  }

  public resize(terminal: ITerminal, canvasWidth: number, canvasHeight: number, charSizeChanged: boolean): void {
    this._canvas.width = canvasWidth * window.devicePixelRatio;
    this._canvas.height = canvasHeight * window.devicePixelRatio;
    this._canvas.style.width = `${canvasWidth}px`;
    this._canvas.style.height = `${canvasHeight}px`;
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

    // TODO: Needs to react to terminal resize
    // Initialize image data
    // if (!this._imageData) {
    //   this._imageData = textCtx.createImageData(scaledCharWidth * this._terminal.cols * window.devicePixelRatio, scaledCharHeight * this._terminal.rows * window.devicePixelRatio);
    //   this._imageData.data.set(createBackgroundFillData(this._imageData.width, this._imageData.height, 255, 0, 0, 255));
    // }

    // TODO: Ensure that the render is eventually performed
    // Don't bother render until the atlas bitmap is ready
    if (!this._charAtlas) {
      return;
    }

    this._ctx.fillStyle = '#ffffff';
    this._ctx.textBaseline = 'top';
    this._ctx.font = `${16 * window.devicePixelRatio}px courier`;

    // Clear out the old data
    // TODO: This should be optimised, we don't want to rewrite every character
    this._ctx.clearRect(0, startRow * scaledCharHeight, scaledCharWidth * terminal.cols, (endRow - startRow + 1) * scaledCharHeight);

    for (let y = startRow; y <= endRow; y++) {
      let row = y + terminal.buffer.ydisp;
      let line = terminal.buffer.lines.get(row);
      for (let x = 0; x < terminal.cols; x++) {
        this._ctx.save();

        let data: number = line[x][0];
        // const ch = line[x][CHAR_DATA_CHAR_INDEX];
        const code: number = <number>line[x][3];

        // if (ch === ' ') {
        //   continue;
        // }

        // let bg = data & 0x1ff;
        let fg = (data >> 9) & 0x1ff;
        let flags = data >> 18;

        if (flags & FLAGS.BOLD) {
          this._ctx.font = `bold ${this._ctx.font}`;
          // Convert the FG color to the bold variant
          if (fg < 8) {
            fg += 8;
          }
        }

        // if (fg < 16) {
        //   ctx.fillStyle = this._colors[fg];
        // } else if (fg < 256) {
        //   // TODO: Support colors 16-255
        // }

        let colorIndex = 0;
        if (fg < 16) {
          colorIndex = fg + 1;
        }

        // Simulate cache
        // let imageData;
        // let key = ch + data;
        // if (key in this._imageDataCache) {
        //   imageData = this._imageDataCache[key];
        // } else {
        //   ctx.fillText(ch, x * scaledCharWidth, y * scaledCharHeight);
        //   if (flags & FLAGS.UNDERLINE) {
        //     ctx.fillRect(x * scaledCharWidth, (y + 1) * scaledCharHeight - window.devicePixelRatio, scaledCharWidth, window.devicePixelRatio);
        //   }
        //   imageData = ctx.getImageData(x * scaledCharWidth, y * scaledCharHeight, scaledCharWidth, scaledCharHeight);
        //   this._imageDataCache[key] = imageData;
        // }
        // ctx.putImageData(imageData, x * scaledCharWidth, y * scaledCharHeight);

        // TODO: Try to get atlas working
        // This seems too slow :(
        // ctx.putImageData(this._charImageDataAtlas, x * scaledCharWidth - ch.charCodeAt(0) * scaledCharWidth, y * scaledCharHeight, ch.charCodeAt(0) * scaledCharWidth, 0, scaledCharWidth, scaledCharHeight);

        // ctx.drawImage(this._offscreenCanvas, code * scaledCharWidth, 0, scaledCharWidth, scaledCharHeight, x * scaledCharWidth, y * scaledCharHeight, scaledCharWidth, scaledCharHeight);

        // ImageBitmap's draw about twice as fast as from a canvas
        this._ctx.drawImage(this._charAtlas, code * scaledCharWidth, colorIndex * scaledCharHeight, scaledCharWidth, scaledCharHeight, x * scaledCharWidth, y * scaledCharHeight, scaledCharWidth, scaledCharHeight);
        this._ctx.restore();
      }
    }

    // This draws the atlas (for debugging purposes)
    // this._ctx.drawImage(this._charAtlas, 0, 0);
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
