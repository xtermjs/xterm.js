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
}
