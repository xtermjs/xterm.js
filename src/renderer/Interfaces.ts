import { ITerminal } from '../Interfaces';

export interface IRenderLayer {
  resize(terminal: ITerminal, canvasWidth: number, canvasHeight: number, charSizeChanged: boolean): void;
  render(terminal: ITerminal, startRow: number, endRow: number): void;
}
