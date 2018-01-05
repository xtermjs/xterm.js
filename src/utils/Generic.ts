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
};
