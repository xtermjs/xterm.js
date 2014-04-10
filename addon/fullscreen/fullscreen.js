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
Terminal.prototype.toggleFullscreen = function (fullscreen) {
  var fn;
  
  if (typeof fullscreen == 'undefined') {
    fn = (this.element.classList.contains('fullscreen')) ? 'remove' : 'add';
  } else if (!fullscreen) {
    fn = 'remove';
  } else {
    fn = 'add';
  }
  
  this.element.classList[fn]('fullscreen');
}