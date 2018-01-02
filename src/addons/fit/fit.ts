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

export function proposeGeometry(term) {
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
    cols: Math.floor(availableWidth / term.renderer.dimensions.actualCellWidth),
    rows: Math.floor(availableHeight / term.renderer.dimensions.actualCellHeight)
  };

  return geometry;
};

export function fit(term) {
  var geometry = proposeGeometry(term);
  if (geometry) {
    // Force a full render
    if (term.rows !== geometry.rows || term.cols !== geometry.cols) {
      term.renderer.clear();
      term.resize(geometry.cols, geometry.rows);
    }
  }
};

export function apply(terminalConstructor) {
  terminalConstructor.prototype.proposeGeometry = function() {
    return proposeGeometry(this);
  }

  terminalConstructor.prototype.fit = function() {
    return fit(this);
  }
}
