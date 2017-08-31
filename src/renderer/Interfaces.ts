import { ITerminal } from '../Interfaces';

export interface IRenderLayer {
  resize(terminal: ITerminal, canvasWidth: number, canvasHeight: number, charSizeChanged: boolean): void;
}

export interface IDataRenderLayer extends IRenderLayer {
  render(terminal: ITerminal, startRow: number, endRow: number): void;
}

export interface ISelectionRenderLayer extends IRenderLayer {
  render(terminal: ITerminal, start: [number, number], end: [number, number]): void;
}
