/**
 * Copyright (c) 2017 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import { IColorSet, IRenderDimensions, ITerminal } from '../../typings/xterm-internal';
import { IEventEmitter } from 'xterm';

/**
 * Flags used to render terminal text properly.
 */
export enum FLAGS {
  BOLD = 1,
  UNDERLINE = 2,
  BLINK = 4,
  INVERSE = 8,
  INVISIBLE = 16,
  DIM = 32
}

export interface IRenderLayer {
  /**
   * Called when the terminal loses focus.
   */
  onBlur(terminal: ITerminal): void;

  /**
   * * Called when the terminal gets focus.
   */
  onFocus(terminal: ITerminal): void;

  /**
   * Called when the cursor is moved.
   */
  onCursorMove(terminal: ITerminal): void;

  /**
   * Called when options change.
   */
  onOptionsChanged(terminal: ITerminal): void;

  /**
   * Called when the theme changes.
   */
  onThemeChanged(terminal: ITerminal, colorSet: IColorSet): void;

  /**
   * Called when the data in the grid has changed (or needs to be rendered
   * again).
   */
  onGridChanged(terminal: ITerminal, startRow: number, endRow: number): void;

  /**
   * Calls when the selection changes.
   */
  onSelectionChanged(terminal: ITerminal, start: [number, number], end: [number, number]): void;

  /**
   * Resize the render layer.
   */
  resize(terminal: ITerminal, dim: IRenderDimensions, charSizeChanged: boolean): void;

  /**
   * Clear the state of the render layer.
   */
  reset(terminal: ITerminal): void;
}
