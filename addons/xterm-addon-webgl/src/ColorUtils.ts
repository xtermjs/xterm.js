/**
 * @license MIT
 * Copyright (c) 2018 The xterm.js authors. All rights reserved.
 */

import { IColor } from 'browser/Types';

export function getLuminance(color: IColor): number {
  // Coefficients taken from: https://www.w3.org/TR/AERT/#color-contrast
  const r = color.rgba >> 24 & 0xff;
  const g = color.rgba >> 16 & 0xff;
  const b = color.rgba >> 8 & 0xff;
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
}
