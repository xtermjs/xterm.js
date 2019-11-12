/**
 * Copyright (c) 2017 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import { IColor, IColorContrastCache } from 'browser/Types';

export class ColorContrastCache implements IColorContrastCache {
  private _color: { [bg: number]: { [fg: number]: IColor | null | undefined } | undefined } = {};
  private _rgba: { [bg: number]: { [fg: number]: number | null | undefined } | undefined } = {};

  public clear(): void {
    this._color = {};
    this._rgba = {};
  }

  public setRgba(bg: number, fg: number, value: number | null): void {
    if (!this._rgba[bg]) {
      this._rgba[bg] = {};
    }
    this._rgba[bg]![fg] = value;
  }

  public getRgba(bg: number, fg: number): number | null | undefined {
    return this._rgba[bg] ? this._rgba[bg]![fg] : undefined;
  }

  public setColor(bg: number, fg: number, value: IColor | null): void {
    if (!this._color[bg]) {
      this._color[bg] = {};
    }
    this._color[bg]![fg] = value;
  }

  public getColor(bg: number, fg: number): IColor | null | undefined {
    return this._color[bg] ? this._color[bg]![fg] : undefined;
  }
}
