/**
 * Copyright (c) 2017 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import { FontWeight } from 'xterm';
import { IColorSet } from '../Types';

export const CHAR_ATLAS_CELL_SPACING = 1;
export const INVERTED_DEFAULT_COLOR = -1;
export const DIM_OPACITY = 0.5;

export interface ICharAtlasConfig {
  fontSize: number;
  fontFamily: string;
  fontWeight: FontWeight;
  fontWeightBold: FontWeight;
  scaledCharWidth: number;
  scaledCharHeight: number;
  allowTransparency: boolean;
  colors: IColorSet;
}
