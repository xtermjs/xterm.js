/**
 * Copyright (c) 2019 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import type { UnicodeCharProperties, UnicodeCharWidth } from 'common/input/UnicodeTypes';

export function extractShouldJoin(value: UnicodeCharProperties): boolean {
  return (value & 1) !== 0;
}

export function extractWidth(value: UnicodeCharProperties): UnicodeCharWidth {
  return ((value >> 1) & 0x3) as UnicodeCharWidth;
}

export function extractCharKind(value: UnicodeCharProperties): number {
  return value >> 3;
}

export function createPropertyValue(state: number, width: number, shouldJoin: boolean = false): UnicodeCharProperties {
  return ((state & 0xffffff) << 3) | ((width & 3) << 1) | (shouldJoin ? 1 : 0);
}
