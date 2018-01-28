/**
 * Copyright (c) 2016 The xterm.js authors. All rights reserved.
 * @license MIT
 */

/**
 * Return if the given array contains the given element
 * @param {Array} array The array to search for the given element.
 * @param {Object} el The element to look for into the array
 */
export function contains(arr: any[], el: any): boolean {
  return arr.indexOf(el) >= 0;
}

/**
 * Returns a string repeated a given number of times
 * Polyfill from https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String/repeat
 * @param {Number} count The number of times to repeat the string
 * @param {String} string The string that is to be repeated
 */
export function repeat(count: number, str: string): string {
  if (count < 0) throw new RangeError('repeat count must be non-negative');
  if (count === Infinity) throw new RangeError('repeat count must be less than infinity');

  count = Math.floor(count);
  if (str.length === 0 || count === 0) return '';

  // Ensuring count is a 31-bit integer allows us to heavily optimize the
  // main part. But anyway, most current (August 2014) browsers can't handle
  // strings 1 << 28 chars or longer, so:
  if (str.length * count >= 1 << 28) {
    throw new RangeError('repeat count must not overflow maximum string size');
  }

  let rpt = '';
  for (let i = 0; i < count; i++) {
    rpt += str;
  }

  return rpt;
}
