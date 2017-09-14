/**
 * Copyright (c) 2017 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import { IColorSet, IRenderDimensions } from './Interfaces';
import { IBuffer, ICharMeasure, ITerminal } from '../Interfaces';
import { CHAR_DATA_ATTR_INDEX } from '../Buffer';
import { GridCache } from './GridCache';
import { FLAGS } from './Types';
import { BaseRenderLayer, INVERTED_DEFAULT_COLOR } from './BaseRenderLayer';

export class BackgroundRenderLayer extends BaseRenderLayer {
  private _state: GridCache<number>;

  constructor(container: HTMLElement, zIndex: number, colors: IColorSet) {
    super(container, 'bg', zIndex, colors);
    this._state = new GridCache<number>();
  }

  public resize(terminal: ITerminal, dim: IRenderDimensions, charSizeChanged: boolean): void {
    super.resize(terminal, dim, charSizeChanged);
    // Resizing the canvas discards the contents of the canvas so clear state
    this._state.clear();
    this._state.resize(terminal.cols, terminal.rows);
  }

  public reset(terminal: ITerminal): void {
    this._state.clear();
    this.clearAll();
  }

  public onGridChanged(terminal: ITerminal, startRow: number, endRow: number): void {
    // Resize has not been called yet
    if (this._state.cache.length === 0) {
      return;
    }
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
          if (bg === 257) {
            bg = INVERTED_DEFAULT_COLOR;
          }
        }

        const cellState = this._state.cache[x][y];
        const needsRefresh = (bg < 256 && cellState !== bg) || cellState !== null;
        if (needsRefresh) {
          if (bg < 256) {
            this._ctx.save();
            this._ctx.fillStyle = (bg === INVERTED_DEFAULT_COLOR ? this.colors.foreground : this.colors.ansi[bg]);
            this.fillCells(x, y, 1, 1);
            this._ctx.restore();
            this._state.cache[x][y] = bg;
          } else {
            this.clearCells(x, y, 1, 1);
            this._state.cache[x][y] = null;
          }
        }
      }
    }
  }
}
