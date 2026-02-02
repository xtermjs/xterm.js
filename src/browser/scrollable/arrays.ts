/**
 * Copyright (c) 2026 The xterm.js authors. All rights reserved.
 * @license MIT
 */

export function tail<T>(array: ArrayLike<T>, n: number = 0): T | undefined {
  return array[array.length - (1 + n)];
}
