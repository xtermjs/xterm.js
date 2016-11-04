/**
 * xterm.js: xterm, in the browser
 * Copyright (c) 2016, SourceLair Private Company <www.sourcelair.com> (MIT License)
 */

/**
 * Generic utilities module. This module contains generic methods that can be helpful at
 * different parts of the code base.
 * @module xterm/utils/Generic
 */

/**
 * Return if the given array contains the given element
 * @param {Array} array The array to search for the given element.
 * @param {Object} el The element to look for into the array
 */
export let contains = function(arr, el) {
  return arr.indexOf(el) >= 0;
};
