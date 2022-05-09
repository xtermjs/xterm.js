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
  return 0xE0A0 <= codepoint && codepoint <=  0xE0D6;
}
