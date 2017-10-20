/**
 * Generic utilities module with methods that can be helpful at different parts of the code base.
 * @module xterm/utils/Generic
 * @license MIT
 */

/**
 * Return if the given array contains the given element
 * @param {Array} array The array to search for the given element.
 * @param {Object} el The element to look for into the array
 */
export function contains(arr: any[], el: any) {
  return arr.indexOf(el) >= 0;
};
