import { ITerminal, ITerminalOptions } from '../Interfaces';

export interface IRenderLayer {
  onCursorMove(terminal: ITerminal): void;
  onOptionsChanged(terminal: ITerminal): void;
  onThemeChanged(terminal: ITerminal, colorSet: IColorSet): void;
  onGridChanged(terminal: ITerminal, startRow: number, endRow: number): void;
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
