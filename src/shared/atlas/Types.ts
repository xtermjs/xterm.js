/**
 * Copyright (c) 2017 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import { FontWeight } from 'xterm';
import { IColorSet } from '../Types';

export const CHAR_ATLAS_CELL_SPACING = 1;

export interface ICharAtlasConfig {
  type: 'none' | 'static' | 'dynamic';
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
