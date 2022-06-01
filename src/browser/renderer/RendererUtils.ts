/**
 * Copyright (c) 2019 The xterm.js authors. All rights reserved.
 * @license MIT
 */

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
  return 0xE0A4 <= codepoint && codepoint <=  0xE0D6;
}

function isBoxOrBlockGlyph(codepoint: number): boolean {
  return (0x2500 <= codepoint && codepoint <= 0x259F);
}

export function excludeFromContrastRatioDemands(codepoint: number): boolean {
  return isPowerlineGlyph(codepoint) || isBoxOrBlockGlyph(codepoint);
}
