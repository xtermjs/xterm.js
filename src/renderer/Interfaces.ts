import { ITerminal } from '../Interfaces';

export interface IRenderLayer {
  resize(canvasWidth: number, canvasHeight: number, charWidth: number, charHeight: number, charSizeChanged: boolean): void;
  render(terminal: ITerminal, startRow: number, endRow: number): void;
}
