import { ITerminal, ITerminalOptions } from '../Interfaces';

export interface IRenderLayer {
  onCursorMove(terminal: ITerminal): void;
  onOptionsChanged(terminal: ITerminal): void;
  onThemeChanged(terminal: ITerminal, colorSet: IColorSet): void;

  /**
   * Resize the render layer.
   */
  resize(terminal: ITerminal, canvasWidth: number, canvasHeight: number, charSizeChanged: boolean): void;

  /**
   * Clear the state of the render layer.
   */
  reset(terminal: ITerminal): void;
}

/**
 * A render layer that renders when there is a data change.
 */
export interface IDataRenderLayer extends IRenderLayer {
  render(terminal: ITerminal, startRow: number, endRow: number): void;
}

/**
 * A render layer that renders when there is a selection change.
 */
export interface ISelectionRenderLayer extends IRenderLayer {
  render(terminal: ITerminal, start: [number, number], end: [number, number]): void;
}


export interface IColorSet {
  foreground: string;
  background: string;
  ansi: string[];
}
