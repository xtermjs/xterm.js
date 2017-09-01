import { IRenderLayer } from './Interfaces';
import { ITerminal } from '../Interfaces';

export abstract class BaseRenderLayer implements IRenderLayer {
  protected _canvas: HTMLCanvasElement;
  protected _ctx: CanvasRenderingContext2D;

  constructor(container: HTMLElement, id: string, zIndex: number) {
    this._canvas = document.createElement('canvas');
    this._canvas.id = `xterm-${id}-layer`;
    this._canvas.style.zIndex = zIndex.toString();
    this._ctx = this._canvas.getContext('2d');
    this._ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
    container.appendChild(this._canvas);
  }

  public resize(terminal: ITerminal, canvasWidth: number, canvasHeight: number, charSizeChanged: boolean): void {
    this._canvas.width = canvasWidth * window.devicePixelRatio;
    this._canvas.height = canvasHeight * window.devicePixelRatio;
    this._canvas.style.width = `${canvasWidth}px`;
    this._canvas.style.height = `${canvasHeight}px`;
  }
}
