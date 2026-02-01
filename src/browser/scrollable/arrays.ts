/**
 * Copyright (c) 2026 The xterm.js authors. All rights reserved.
 * @license MIT
 */

export function tail<T>(array: ArrayLike<T>, n: number = 0): T | undefined {
  return array[array.length - (1 + n)];
}

export function tail2<T>(arr: T[]): [T[], T] {
  if (arr.length === 0) {
    throw new Error('Invalid tail call');
  }

  return [arr.slice(0, arr.length - 1), arr[arr.length - 1]];
}
