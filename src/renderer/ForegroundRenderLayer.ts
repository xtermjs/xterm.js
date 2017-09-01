import { IDataRenderLayer } from './Interfaces';
import { IBuffer, ICharMeasure, ITerminal } from '../Interfaces';
import { CHAR_DATA_ATTR_INDEX, CHAR_DATA_CODE_INDEX, CHAR_DATA_CHAR_INDEX, CHAR_DATA_WIDTH_INDEX } from '../Buffer';
import { COLORS } from './Color';
import { FLAGS } from './Types';
import { GridCache } from './GridCache';
import { CharData } from '../Types';
import { BaseRenderLayer } from './BaseRenderLayer';

export class ForegroundRenderLayer extends BaseRenderLayer implements IDataRenderLayer {
  private _state: GridCache<CharData>;

  constructor(container: HTMLElement, zIndex: number) {
    super(container, 'fg', zIndex);
    this._state = new GridCache<CharData>();
  }

  public resize(terminal: ITerminal, canvasWidth: number, canvasHeight: number, charSizeChanged: boolean): void {
    super.resize(terminal, canvasWidth, canvasHeight, charSizeChanged);
    this._state.resize(terminal.cols, terminal.rows);
  }

  public render(terminal: ITerminal, startRow: number, endRow: number): void {
    const scaledCharWidth = Math.ceil(terminal.charMeasure.width) * window.devicePixelRatio;
    const scaledCharHeight = Math.ceil(terminal.charMeasure.height) * window.devicePixelRatio;

    // TODO: Ensure that the render is eventually performed
    // Don't bother render until the atlas bitmap is ready
    if (!BaseRenderLayer._charAtlas) {
      return;
    }

    this._ctx.fillStyle = '#ffffff';
    this._ctx.textBaseline = 'top';
    this._ctx.font = `${16 * window.devicePixelRatio}px courier`;

    for (let y = startRow; y <= endRow; y++) {
      const row = y + terminal.buffer.ydisp;
      const line = terminal.buffer.lines.get(row);

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

        if (code < 256 && (colorIndex > 0 || fg > 255)) {
          // ImageBitmap's draw about twice as fast as from a canvas
          this._ctx.drawImage(BaseRenderLayer._charAtlas, code * scaledCharWidth, colorIndex * scaledCharHeight, scaledCharWidth, scaledCharHeight, x * scaledCharWidth, y * scaledCharHeight, scaledCharWidth, scaledCharHeight);
        } else {
          // TODO: Evaluate how long it takes to convert from a number
          const width: number = charData[CHAR_DATA_WIDTH_INDEX];
          this._drawUncachedChar(char, width, fg, x, y, scaledCharWidth, scaledCharHeight);
        }
      }
    }

    // This draws the atlas (for debugging purposes)
    // this._ctx.drawImage(this._charAtlas, 0, 0);
  }

  private _drawUncachedChar(char: string, width: number, fg: number, x: number, y: number, scaledCharWidth: number, scaledCharHeight: number): void {
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
