/**
 * Copyright (c) 2018 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import { IAttributeData, IColorRGB } from 'common/Types';
import { Attributes, FgFlags, BgFlags } from 'common/buffer/Constants';

export class AttributeData implements IAttributeData {
  static toColorRGB(value: number): IColorRGB {
    return [
      value >>> Attributes.RED_SHIFT & 255,
      value >>> Attributes.GREEN_SHIFT & 255,
      value & 255
    ];
  }
  static fromColorRGB(value: IColorRGB): number {
    return (value[0] & 255) << Attributes.RED_SHIFT | (value[1] & 255) << Attributes.GREEN_SHIFT | value[2] & 255;
  }

  public clone(): IAttributeData {
    const newObj = new AttributeData();
    newObj.fg = this.fg;
    newObj.bg = this.bg;
    return newObj;
  }

  // data
  public fg: number = 0;
  public bg: number = 0;

  // flags
  public isInverse(): number   { return this.fg & FgFlags.INVERSE; }
  public isBold(): number      { return this.fg & FgFlags.BOLD; }
  public isUnderline(): number { return this.fg & FgFlags.UNDERLINE; }
  public isBlink(): number     { return this.fg & FgFlags.BLINK; }
  public isInvisible(): number { return this.fg & FgFlags.INVISIBLE; }
  public isItalic(): number    { return this.bg & BgFlags.ITALIC; }
  public isDim(): number       { return this.bg & BgFlags.DIM; }

  // color modes
  public getFgColorMode(): number { return this.fg & Attributes.CM_MASK; }
  public getBgColorMode(): number { return this.bg & Attributes.CM_MASK; }
  public isFgRGB(): boolean       { return (this.fg & Attributes.CM_MASK) === Attributes.CM_RGB; }
  public isBgRGB(): boolean       { return (this.bg & Attributes.CM_MASK) === Attributes.CM_RGB; }
  public isFgPalette(): boolean   { return (this.fg & Attributes.CM_MASK) === Attributes.CM_P16 || (this.fg & Attributes.CM_MASK) === Attributes.CM_P256; }
  public isBgPalette(): boolean   { return (this.bg & Attributes.CM_MASK) === Attributes.CM_P16 || (this.bg & Attributes.CM_MASK) === Attributes.CM_P256; }
  public isFgDefault(): boolean   { return (this.fg & Attributes.CM_MASK) === 0; }
  public isBgDefault(): boolean   { return (this.bg & Attributes.CM_MASK) === 0; }
  public isAttributeDefault(): boolean { return this.fg === 0 && this.bg === 0; }

  // colors
  public getFgColor(): number {
    switch (this.fg & Attributes.CM_MASK) {
      case Attributes.CM_P16:
      case Attributes.CM_P256:  return this.fg & Attributes.PCOLOR_MASK;
      case Attributes.CM_RGB:   return this.fg & Attributes.RGB_MASK;
      default:                  return -1;  // CM_DEFAULT defaults to -1
    }
  }
  public getBgColor(): number {
    switch (this.bg & Attributes.CM_MASK) {
      case Attributes.CM_P16:
      case Attributes.CM_P256:  return this.bg & Attributes.PCOLOR_MASK;
      case Attributes.CM_RGB:   return this.bg & Attributes.RGB_MASK;
      default:                  return -1;  // CM_DEFAULT defaults to -1
    }
  }
}
