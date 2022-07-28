/**
 * Copyright (c) 2017 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import { FontWeight } from 'common/services/Services';
import { IPartialColorSet } from 'browser/Types';

export interface IGlyphIdentifier {
  chars: string;
  code: number;
  bg: number;
  fg: number;
  bold: boolean;
  dim: boolean;
  italic: boolean;
}

export interface ICharAtlasConfig {
  devicePixelRatio: number;
  fontSize: number;
  fontFamily: string;
  fontWeight: FontWeight;
  fontWeightBold: FontWeight;
  scaledCharWidth: number;
  scaledCharHeight: number;
  allowTransparency: boolean;
  colors: IPartialColorSet;
}
