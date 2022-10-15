/**
 * Copyright (c) 2019 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import { IDimensions, IOffset, IRenderDimensions } from 'browser/renderer/shared/Types';

export function throwIfFalsy<T>(value: T | undefined | null): T {
  if (!value) {
    throw new Error('value must not be falsy');
  }
  return value;
}

export function isPowerlineGlyph(codepoint: number): boolean {
  // Only return true for Powerline symbols which require
  // different padding and should be excluded from minimum contrast
  // ratio standards
  return 0xE0A4 <= codepoint && codepoint <= 0xE0D6;
}

export function isRestrictedPowerlineGlyph(codepoint: number): boolean {
  return 0xE0B0 <= codepoint && codepoint <= 0xE0B7;
}

function isBoxOrBlockGlyph(codepoint: number): boolean {
  return 0x2500 <= codepoint && codepoint <= 0x259F;
}

export function excludeFromContrastRatioDemands(codepoint: number): boolean {
  return isPowerlineGlyph(codepoint) || isBoxOrBlockGlyph(codepoint);
}

export function createRenderDimensions(): IRenderDimensions {
  return {
    css: {
      canvas: createDimension(),
      cell: createDimension()
    },
    device: {
      canvas: createDimension(),
      cell: createDimension(),
      char: {
        width: 0,
        height: 0,
        left: 0,
        top: 0
      }
    },
    scaledCharWidth: 0,
    scaledCharHeight: 0,
    scaledCellWidth: 0,
    scaledCellHeight: 0,
    scaledCharLeft: 0,
    scaledCharTop: 0,
    scaledCanvasWidth: 0,
    scaledCanvasHeight: 0,
    canvasWidth: 0,
    canvasHeight: 0,
    actualCellWidth: 0,
    actualCellHeight: 0
  };
}

function createDimension(): IDimensions {
  return {
    width: 0,
    height: 0
  };
}
