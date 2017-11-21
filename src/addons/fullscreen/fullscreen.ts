/**
 * Copyright (c) 2014 The xterm.js authors. All rights reserved.
 * @license MIT
 */

/**
 * Toggle the given terminal's fullscreen mode.
 * @param {Terminal} term - The terminal to toggle full screen mode
 * @param {boolean} fullscreen - Toggle fullscreen on (true) or off (false)
 */
export function toggleFullScreen(term, fullscreen) {
  var fn;

  if (typeof fullscreen == 'undefined') {
    fn = (term.element.classList.contains('fullscreen')) ? 'remove' : 'add';
  } else if (!fullscreen) {
    fn = 'remove';
  } else {
    fn = 'add';
  }

  term.element.classList[fn]('fullscreen');
};

export function apply(terminalConstructor) {
  terminalConstructor.prototype.toggleFullScreen = function (fullscreen) {
    return toggleFullScreen(this, fullscreen);
  };
}
