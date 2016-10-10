/*
 * Fullscreen addon for xterm.js
 *
 * Implements the toggleFullscreen function.
 *
 * If the `fullscreen` argument has been supplied, then
 * if it is true, the fullscreen mode gets turned on,
 * if it is false or null, the fullscreen mode gets turned off.
 *
 * If the `fullscreen` argument has not been supplied, the
 * fullscreen mode is being toggled.
 */
(function (fullscreen) {
  if (typeof exports === 'object' && typeof module === 'object') {
    /*
     * CommonJS environment
     */
    module.exports = fullscreen(require('../../dist/xterm'));
  } else if (typeof define == 'function') {
    /*
     * Require.js is available
     */
    define(['../../dist/xterm'], fullscreen);
  } else {
    /*
     * Plain browser environment
     */
    fullscreen(window.Terminal);
  }
})(function (Xterm) {
  var exports = {};

  exports.toggleFullScreen = function (term, fullscreen) {
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

  Xterm.prototype.toggleFullscreen = function (fullscreen) {
    exports.toggleFullScreen(this, fullscreen);
  };

  return exports;
});
