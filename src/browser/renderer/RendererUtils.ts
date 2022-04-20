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
  // This range was established via
  // https://apw-bash-settings.readthedocs.io/en/latest/fontpatching.html
  return 0xE000 <= codepoint && codepoint <=  0xF8FF;
}
