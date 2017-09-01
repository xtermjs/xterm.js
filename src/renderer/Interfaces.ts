import { ITerminal } from '../Interfaces';

export interface IRenderLayer {
  /**
   * Resize the render layer.
   */
  resize(terminal: ITerminal, canvasWidth: number, canvasHeight: number, charSizeChanged: boolean): void;

  /**
   * Clear the state of the render layer.
   */
  reset(terminal: ITerminal): void;
}

export interface IDataRenderLayer extends IRenderLayer {
  render(terminal: ITerminal, startRow: number, endRow: number): void;
}

export interface ISelectionRenderLayer extends IRenderLayer {
  render(terminal: ITerminal, start: [number, number], end: [number, number]): void;
}
