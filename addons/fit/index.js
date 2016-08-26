/*
 *  Fit terminal columns and rows to the dimensions of its
 *  DOM element.
 *
 *  Approach:
 *    - Rows: Truncate the division of the terminal parent element height
 *            by the terminal row height
 *
 *    - Columns: Truncate the division of the terminal parent element width by
 *               the terminal character width (apply display: inline at the
 *               terminal row and truncate its width with the current number
 *               of columns)
 */

var exports = {};

function proposeGeometry(term) {
  var parentElementStyle = window.getComputedStyle(term.element.parentElement),
      parentElementHeight = parseInt(parentElementStyle.getPropertyValue('height')),
      parentElementWidth = parseInt(parentElementStyle.getPropertyValue('width')),
      elementStyle = window.getComputedStyle(term.element),
      elementPaddingVer = parseInt(elementStyle.getPropertyValue('padding-top')) + parseInt(elementStyle.getPropertyValue('padding-bottom')),
      elementPaddingHor = parseInt(elementStyle.getPropertyValue('padding-right')) + parseInt(elementStyle.getPropertyValue('padding-left')),
      availableHeight = parentElementHeight - elementPaddingVer,
      availableWidth = parentElementWidth - elementPaddingHor,
      container = term.rowContainer,
      subjectRow = term.rowContainer.firstElementChild,
      contentBuffer = subjectRow.innerHTML,
      characterHeight,
      rows,
      characterWidth,
      cols,
      geometry;

  subjectRow.style.display = 'inline';
  subjectRow.innerHTML = 'W'; // Common character for measuring width, although on monospace
  characterWidth = subjectRow.getBoundingClientRect().width;
  subjectRow.style.display = ''; // Revert style before calculating height, since they differ.
  characterHeight = parseInt(subjectRow.offsetHeight);
  subjectRow.innerHTML = contentBuffer;

  rows = parseInt(availableHeight / characterHeight);
  cols = parseInt(availableWidth / characterWidth) - 1;

  geometry = {cols: cols, rows: rows};
  return geometry;
};

function fit(term) {
  var geometry = proposeGeometry(term);
  term.resize(geometry.cols, geometry.rows);
};




/**
* This module provides methods for fitting a terminal's size to a parent container.
*
* @module xterm/addons/fit/fit
*/
module.exports = function(Xterm) {

  Xterm.prototype.proposeGeometry = function () {
    return proposeGeometry(this);
  };

  Xterm.prototype.fit = function () {
    return fit(this);
  };

};
