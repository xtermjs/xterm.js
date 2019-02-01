/**
 * Copyright (c) 2017 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import { ITerminal, CharacterJoinerHandler } from '../Types';
import { IEventEmitter, ITheme, IDisposable } from 'xterm';

/**
 * Flags used to render terminal text properly.
 */
export const enum FLAGS {
  BOLD = 1,
  UNDERLINE = 2,
  BLINK = 4,
  INVERSE = 8,
  INVISIBLE = 16,
  DIM = 32,
  ITALIC = 64
}

/**
 * Note that IRenderer implementations should emit the refresh event after
 * rendering rows to the screen.
 */
export interface IRenderer extends IEventEmitter, IDisposable {
  dimensions: IRenderDimensions;
  colorManager: IColorManager;

  dispose(): void;
  setTheme(theme: ITheme): IColorSet;
  onWindowResize(devicePixelRatio: number): void;
  onResize(cols: number, rows: number): void;
  onCharSizeChanged(): void;
  onBlur(): void;
  onFocus(): void;
  onSelectionChanged(start: [number, number], end: [number, number], columnSelectMode: boolean): void;
  onCursorMove(): void;
  onOptionsChanged(): void;
  clear(): void;
  refreshRows(start: number, end: number): void;
  registerCharacterJoiner(handler: CharacterJoinerHandler): number;
  deregisterCharacterJoiner(joinerId: number): boolean;
}

export interface IColorManager {
  colors: IColorSet;
}

export interface IRenderDimensions {
  scaledCharWidth: number;
  scaledCharHeight: number;
  scaledCellWidth: number;
  scaledCellHeight: number;
  scaledCharLeft: number;
  scaledCharTop: number;
  scaledCanvasWidth: number;
  scaledCanvasHeight: number;
  canvasWidth: number;
  canvasHeight: number;
  actualCellWidth: number;
  actualCellHeight: number;
}

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
  onThemeChanged(terminal: ITerminal, colorSet: IColorSet): void;

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

export interface ICharacterJoiner {
  id: number;
  handler: CharacterJoinerHandler;
}

export interface ICharacterJoinerRegistry {
  registerCharacterJoiner(handler: (text: string) => [number, number][]): number;
  deregisterCharacterJoiner(joinerId: number): boolean;
  getJoinedCharacters(row: number): [number, number][];
}

export interface IColor {
  css: string;
  rgba: number; // 32-bit int with rgba in each byte
}

export interface IColorSet {
  foreground: IColor;
  background: IColor;
  cursor: IColor;
  cursorAccent: IColor;
  selection: IColor;
  ansi: IColor[];
}
