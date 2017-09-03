import { IColorSet } from './Interfaces';
import { IBuffer, ICharMeasure, ITerminal } from '../Interfaces';
import { CHAR_DATA_ATTR_INDEX, CHAR_DATA_CODE_INDEX, CHAR_DATA_CHAR_INDEX, CHAR_DATA_WIDTH_INDEX } from '../Buffer';
import { FLAGS } from './Types';
import { GridCache } from './GridCache';
import { CharData } from '../Types';
import { BaseRenderLayer, INVERTED_DEFAULT_COLOR } from './BaseRenderLayer';

export class ForegroundRenderLayer extends BaseRenderLayer {
  private _state: GridCache<CharData>;

  constructor(container: HTMLElement, zIndex: number, colors: IColorSet) {
    super(container, 'fg', zIndex, colors);
    this._state = new GridCache<CharData>();
  }

  public resize(terminal: ITerminal, canvasWidth: number, canvasHeight: number, charSizeChanged: boolean): void {
    super.resize(terminal, canvasWidth, canvasHeight, charSizeChanged);
    // Resizing the canvas discards the contents of the canvas so clear state
    this._state.clear();
    this._state.resize(terminal.cols, terminal.rows);
  }

  public reset(terminal: ITerminal): void {
    this._state.clear();
    this.clearAll();
  }

  public onGridChanged(terminal: ITerminal, startRow: number, endRow: number): void {
    // TODO: Ensure that the render is eventually performed
    // Don't bother render until the atlas bitmap is ready
    // TODO: Move this to BaseRenderLayer?
    // if (!BaseRenderLayer._charAtlas) {
    //   return;
    // }

    // Resize has not been called yet
    if (this._state.cache.length === 0) {
      return;
    }

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

        // Clear the old character if present
        if (state && state[CHAR_DATA_CODE_INDEX] !== 32 /*' '*/) {
          this.clearCells(x, y, 1, 1);
        }
        this._state.cache[x][y] = charData;

        const flags = attr >> 18;

        // Skip rendering if the character is invisible
        if (!code || code === 32 /*' '*/ || (flags & FLAGS.INVISIBLE)) {
          continue;
        }

        let fg = (attr >> 9) & 0x1ff;

        // If inverse flag is on, the foreground should become the background.
        if (flags & FLAGS.INVERSE) {
          fg = attr & 0x1ff;
          // TODO: Is this case still needed
          if (fg === 256) {
            fg = INVERTED_DEFAULT_COLOR;
          }
        }

        this._ctx.save();
        if (flags & FLAGS.BOLD) {
          this._ctx.font = `bold ${this._ctx.font}`;
          // Convert the FG color to the bold variant
          if (fg < 8) {
            fg += 8;
          }
        }

        if (flags & FLAGS.UNDERLINE) {
          if (fg === INVERTED_DEFAULT_COLOR) {
            this._ctx.fillStyle = this.colors.background;
          } else if (fg < 256) {
            // 256 color support
            this._ctx.fillStyle = this.colors.ansi[fg];
          } else {
            this._ctx.fillStyle = this.colors.foreground;
          }
          this.drawBottomLineAtCell(x, y);
        }

        const width: number = charData[CHAR_DATA_WIDTH_INDEX];
        this.drawChar(terminal, char, code, width, x, y, fg);

        this._ctx.restore();
      }
    }
  }
}
