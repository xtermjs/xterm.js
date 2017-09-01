import { ITerminal, ITerminalOptions } from '../Interfaces';

export interface IRenderLayer {
  onOptionsChanged(options: ITerminal): void;

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
