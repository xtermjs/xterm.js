/**
 * Copyright (c) 2017 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import { ITerminal } from '../Types';
import { IDisposable } from 'xterm';
import { IColorSet } from 'browser/Types';
import { IRenderDimensions, CharacterJoinerHandler, ICharacterJoiner } from 'browser/renderer/Types';

export interface IRenderLayer extends IDisposable {
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
  setColors(terminal: ITerminal, colorSet: IColorSet): void;

  /**
   * Called when the data in the grid has changed (or needs to be rendered
   * again).
   */
  onGridChanged(terminal: ITerminal, startRow: number, endRow: number): void;

  /**
   * Calls when the selection changes.
   */
  onSelectionChanged(terminal: ITerminal, start: [number, number], end: [number, number], columnSelectMode: boolean): void;

  /**
   * Registers a handler to join characters to render as a group
   */
  registerCharacterJoiner?(joiner: ICharacterJoiner): void;

  /**
   * Deregisters the specified character joiner handler
   */
  deregisterCharacterJoiner?(joinerId: number): void;

  /**
   * Resize the render layer.
   */
  resize(terminal: ITerminal, dim: IRenderDimensions): void;

  /**
   * Clear the state of the render layer.
   */
  reset(terminal: ITerminal): void;
}
