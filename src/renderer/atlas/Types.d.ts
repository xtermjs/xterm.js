/**
 * Copyright (c) 2017 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import { FontWeight } from 'xterm';
import { IColorSet } from 'browser/Types';

export interface ICharAtlasConfig {
  devicePixelRatio: number;
  fontSize: number;
  fontFamily: string;
  fontWeight: FontWeight;
  fontWeightBold: FontWeight;
  scaledCharWidth: number;
  scaledCharHeight: number;
  allowTransparency: boolean;
  colors: IColorSet;
}
