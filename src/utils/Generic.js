/**
 * xterm.js: xterm, in the browser
 * Copyright (c) 2016, SourceLair Private Company <www.sourcelair.com> (MIT License)
 */

/**
 * Generic utilities module. This module contains generic methods that can be helpful at
 * different parts of the code base.
 * @module xterm/utils/Generic
 */

export let contains = function(el, arr) {
  for (var i = 0; i < arr.length; i += 1) {
    if (el === arr[i]) {
      return true;
    }
  }
  return false;
};
