/**
 * @license MIT
 */

const DEFAULT_COLOR = 1 << 24;

export class TextStyle {
  constructor(
    public x1: number,
    public y1: number,
    public x2: number,
    public y2: number,
    // TODO: Int32Array (Maybe Int8?)
    // TODO: This should be private
    public _data: [number, number, number]
  ) {
  }

  public get flags(): number {
    return this._data[0];
  }

  public get isDefaultFg(): boolean {
    return this._data[1] === DEFAULT_COLOR;
  }

  public get truecolorFg(): string {
    return '#' + this._padLeft(this._data[1].toString(16), '0');
  }

  public get isDefaultBg(): boolean {
    return this._data[2] === DEFAULT_COLOR;
  }

  public get truecolorBg(): string {
    return '#' + this._padLeft(this._data[2].toString(16), '0');
  }

  private _padLeft(text: string, padChar: string): string {
    while (text.length < 6) {
      text = padChar + text;
    }
    return text;
  }
}
