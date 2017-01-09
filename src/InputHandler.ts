import { IInputHandler, ITerminal } from './Interfaces';

export class InputHandler implements IInputHandler {
  // TODO: We want to type _terminal when it's pulled into TS
  constructor(private _terminal: any) { }

  public bell(): void {
    if (!this._terminal.visualBell) {
      return;
    }
    this._terminal.element.style.borderColor = 'white';
    setTimeout(() => this._terminal.element.style.borderColor = '', 10);
    if (this._terminal.popOnBell) {
      this._terminal.focus();
    }
  }

  public lineFeed(): void {
    if (this._terminal.convertEol) {
      this._terminal.x = 0;
    }
    this._terminal.y++;
    if (this._terminal.y > this._terminal.scrollBottom) {
      this._terminal.y--;
      this._terminal.scroll();
    }
  }

  public carriageReturn(): void {
    this._terminal.x = 0;
  }

  public backspace(): void {
    if (this._terminal.x > 0) {
      this._terminal.x--;
    }
  }

  public tab(): void {
    this._terminal.x = this._terminal.nextStop();
  }

  public shiftOut(): void {
    this._terminal.setgLevel(1);
  }

  public shiftIn(): void {
    this._terminal.setgLevel(0);
  }

  public cursorUp(params: number[]): void {
    let param = params[0];
    if (param < 1) {
      param = 1;
    }
    this._terminal.y -= param;
    if (this._terminal.y < 0) {
      this._terminal.y = 0;
    }
  }

  public cursorDown(params: number[]) {
    let param = params[0];
    if (param < 1) {
      param = 1;
    }
    this._terminal.y += param;
    if (this._terminal.y >= this._terminal.rows) {
      this._terminal.y = this._terminal.rows - 1;
    }
  }

  public cursorForward(params: number[]) {
    let param = params[0];
    if (param < 1) {
      param = 1;
    }
    this._terminal.x += param;
    if (this._terminal.x >= this._terminal.cols) {
      this._terminal.x = this._terminal.cols - 1;
    }
  }

  public cursorBackward(params: number[]) {
    let param = params[0];
    if (param < 1) {
      param = 1;
    }
    this._terminal.x -= param;
    if (this._terminal.x < 0) {
      this._terminal.x = 0;
    }
  }
}
