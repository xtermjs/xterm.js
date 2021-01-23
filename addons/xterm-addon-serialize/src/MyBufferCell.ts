import { IBufferCell } from 'xterm';

/**
 * This is a dummy buffer cell to hold data from real buffer cell
 */
export class MyBufferCell implements IBufferCell {
  constructor(private _cell: IBufferCell) {}
  private _width: number = this._cell.getWidth();
  private _chars: string = this._cell.getChars();
  private _code: number = this._cell.getCode();
  private _fgColorMode: number = this._cell.getFgColorMode();
  private _bgColorMode: number = this._cell.getBgColorMode();
  private _fgColor: number = this._cell.getFgColor();
  private _bgColor: number = this._cell.getBgColor();
  private _bold: number = this._cell.isBold();
  private _italic: number = this._cell.isItalic();
  private _dim: number = this._cell.isDim();
  private _underline: number = this._cell.isUnderline();
  private _blink: number = this._cell.isBlink();
  private _inverse: number = this._cell.isInverse();
  private _invisible: number = this._cell.isInvisible();
  private _fgRGB: boolean = this._cell.isFgRGB();
  private _bgRGB: boolean = this._cell.isBgRGB();
  private _fgPalette: boolean = this._cell.isFgPalette();
  private _bgPallette: boolean = this._cell.isBgPalette();
  private _fgDefault: boolean = this._cell.isFgDefault();
  private _bgDefault: boolean = this._cell.isBgDefault();
  private _attributeDefault: boolean = this._cell.isAttributeDefault();
  public getWidth(): number {
    return this._width;
  }
  public getChars(): string {
    return this._chars;
  }
  public getCode(): number {
    return this._code;
  }
  public getFgColorMode(): number {
    return this._fgColorMode;
  }
  public getBgColorMode(): number {
    return this._bgColorMode;
  }
  public getFgColor(): number {
    return this._fgColor;
  }
  public getBgColor(): number {
    return this._bgColor;
  }
  public isBold(): number {
    return this._bold;
  }
  public isItalic(): number {
    return this._italic;
  }
  public isDim(): number {
    return this._dim;
  }
  public isUnderline(): number {
    return this._underline;
  }
  public isBlink(): number {
    return this._blink;
  }
  public isInverse(): number {
    return this._inverse;
  }
  public isInvisible(): number {
    return this._invisible;
  }
  public isFgRGB(): boolean {
    return this._fgRGB;
  }
  public isBgRGB(): boolean {
    return this._bgRGB;
  }
  public isFgPalette(): boolean {
    return this._fgPalette;
  }
  public isBgPalette(): boolean {
    return this._bgPallette;
  }
  public isFgDefault(): boolean {
    return this._fgDefault;
  }
  public isBgDefault(): boolean {
    return this._bgDefault;
  }
  public isAttributeDefault(): boolean {
    return this._attributeDefault;
  }

  public static from(cell: IBufferCell): MyBufferCell {
    return new MyBufferCell(cell);
  }
}
