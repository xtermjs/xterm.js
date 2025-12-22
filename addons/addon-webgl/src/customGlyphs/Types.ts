/**
 * Copyright (c) 2021 The xterm.js authors. All rights reserved.
 * @license MIT
 */

export interface ICustomGlyphSolidOctantBlockVector {
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * @param xp The percentage of 15% of the x axis.
 * @param yp The percentage of 15% of the x axis on the y axis.
 */
export type CustomGlyphDrawFunctionDefinition = (xp: number, yp: number) => string;

export interface ICustomGlyphVectorShape {
  d: string;
  type: CustomGlyphVectorType;
  leftPadding?: number;
  rightPadding?: number;
}

export const enum CustomGlyphVectorType {
  FILL,
  STROKE
}

export type CustomGlyphPatternDefinition = number[][];
