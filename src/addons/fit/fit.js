/**
 * Copyright (c) 2014 The xterm.js authors. All rights reserved.
 * @license MIT
 *
 * Fit terminal columns and rows to the dimensions of its DOM element.
 *
 * ## Approach
 *
 *    Rows: Truncate the division of the terminal parent element height by the
 *          terminal row height.
 * Columns: Truncate the division of the terminal parent element width by the
 *          terminal character width (apply display: inline at the terminal
 *          row and truncate its width with the current number of columns).
 */

(function (fit) {
  if (typeof exports === 'object' && typeof module === 'object') {
    /*
     * CommonJS environment
     */
    module.exports = fit(require('../../Terminal').Terminal);
  } else if (typeof define == 'function') {
    /*
     * Require.js is available
     */
    define(['../../xterm'], fit);
  } else {
    /*
     * Plain browser environment
     */
    fit(window.Terminal);
  }
})(function (Terminal) {
  var exports = {};

  exports.proposeGeometry = function (term) {
    if (!term.element.parentElement) {
      return null;
    }
    var parentElementStyle = window.getComputedStyle(term.element.parentElement);
    var parentElementHeight = parseInt(parentElementStyle.getPropertyValue('height'));
    var parentElementWidth = Math.max(0, parseInt(parentElementStyle.getPropertyValue('width')) - 17);
    var elementStyle = window.getComputedStyle(term.element);
    var elementPaddingVer = parseInt(elementStyle.getPropertyValue('padding-top')) + parseInt(elementStyle.getPropertyValue('padding-bottom'));
    var elementPaddingHor = parseInt(elementStyle.getPropertyValue('padding-right')) + parseInt(elementStyle.getPropertyValue('padding-left'));
    var availableHeight = parentElementHeight - elementPaddingVer;
    var availableWidth = parentElementWidth - elementPaddingHor;
    var geometry = {
      cols: Math.floor(availableWidth / term.charMeasure.width),
      rows: Math.floor(availableHeight / Math.floor(term.charMeasure.height * term.getOption('lineHeight')))
    };

    return geometry;
  };

  exports.fit = function (term) {
    // Wrap fit in a setTimeout as charMeasure needs time to get initialized
    // after calling Terminal.open
    setTimeout(function () {
      var geometry = exports.proposeGeometry(term);

      if (geometry) {
        // Force a full render
        if (term.rows !== geometry.rows || term.cols !== geometry.cols) {
          term.renderer.clear();
          term.resize(geometry.cols, geometry.rows);
        }
      }
    }, 0);
  };

  Terminal.prototype.proposeGeometry = function () {
    return exports.proposeGeometry(this);
  };

  Terminal.prototype.fit = function () {
    return exports.fit(this);
  };

  return exports;
});
