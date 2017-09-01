import { ITerminal, ITerminalOptions } from '../Interfaces';

export interface IRenderLayer {
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
  resize(terminal: ITerminal, canvasWidth: number, canvasHeight: number, charSizeChanged: boolean): void;

  /**
   * Clear the state of the render layer.
   */
  reset(terminal: ITerminal): void;
}


export interface IColorSet {
  foreground: string;
  background: string;
  ansi: string[];
}
