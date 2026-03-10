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
export type CustomGlyphPathDrawFunctionDefinition = (xp: number, yp: number) => string;

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

export const enum CustomGlyphDefinitionType {
  SOLID_OCTANT_BLOCK_VECTOR,
  BLOCK_PATTERN,
  PATH_FUNCTION,
  PATH,
  PATH_NEGATIVE,
  VECTOR_SHAPE,
  BRAILLE,
}

export type CustomGlyphDefinitionPartRaw = (
  { type: CustomGlyphDefinitionType.SOLID_OCTANT_BLOCK_VECTOR, data: ICustomGlyphSolidOctantBlockVector[] } |
  { type: CustomGlyphDefinitionType.BLOCK_PATTERN, data: CustomGlyphPatternDefinition } |
  { type: CustomGlyphDefinitionType.PATH_FUNCTION, data: CustomGlyphPathDrawFunctionDefinition | string } |
  { type: CustomGlyphDefinitionType.PATH, data: string } |
  { type: CustomGlyphDefinitionType.PATH_NEGATIVE, data: ICustomGlyphVectorShape } |
  { type: CustomGlyphDefinitionType.VECTOR_SHAPE, data: ICustomGlyphVectorShape} |
  { type: CustomGlyphDefinitionType.BRAILLE, data: number }
);

export const enum CustomGlyphScaleType {
  /**
   * Scale to the entire cell, including letter spacing and line height.
   */
  CELL,
  /**
   * Scale to only the character area, excluding letter spacing and line height.
   */
  CHAR,
}

export interface ICustomGlyphDefinitionCommon {
  /**
   * A custom clip path for the draw definition, restricting the area it can draw to.
   */
  clipPath?: string;
  /**
   * The stroke width to use when drawing the path. Defaults to 1.
   */
  strokeWidth?: number;
  /**
   * Defines how to scale the draw. Defaults to scaling to the full cell including letter spacing
   * and line height.
   */
  scaleType?: CustomGlyphScaleType;
}

export type CustomGlyphDefinitionPart = CustomGlyphDefinitionPartRaw & ICustomGlyphDefinitionCommon;

/**
 * A character definition that can be a single part or an array of parts drawn in sequence.
 */
export type CustomGlyphCharacterDefinition = CustomGlyphDefinitionPart | CustomGlyphDefinitionPart[];
