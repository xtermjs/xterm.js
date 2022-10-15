/**
 * Copyright (c) 2017 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import { IDisposable, Terminal } from 'xterm';
import { IRenderDimensions } from 'browser/renderer/shared/Types';

export interface IRenderLayer extends IDisposable {
  /**
   * Called when the terminal loses focus.
   */
  handleBlur(terminal: Terminal): void;

  /**
   * Called when the terminal gets focus.
   */
  handleFocus(terminal: Terminal): void;

  /**
   * Called when the cursor is moved.
   */
  handleCursorMove(terminal: Terminal): void;

  /**
   * Called when the data in the grid has changed (or needs to be rendered
   * again).
   */
  handleGridChanged(terminal: Terminal, startRow: number, endRow: number): void;

  /**
   * Calls when the selection changes.
   */
  handleSelectionChanged(terminal: Terminal, start: [number, number] | undefined, end: [number, number] | undefined, columnSelectMode: boolean): void;

  /**
   * Registers a handler to join characters to render as a group
   */
  registerCharacterJoiner?(handler: (text: string) => [number, number][]): void;

  /**
   * Deregisters the specified character joiner handler
   */
  deregisterCharacterJoiner?(joinerId: number): void;

  /**
   * Resize the render layer.
   */
  resize(terminal: Terminal, dim: IRenderDimensions): void;

  /**
   * Clear the state of the render layer.
   */
  reset(terminal: Terminal): void;
}
