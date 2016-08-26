(function(f){if(typeof exports==="object"&&typeof module!=="undefined"){module.exports=f()}else if(typeof define==="function"&&define.amd){define([],f)}else{var g;if(typeof window!=="undefined"){g=window}else if(typeof global!=="undefined"){g=global}else if(typeof self!=="undefined"){g=self}else{g=this}g.Terminal_Fit = f()}})(function(){var define,module,exports;return (function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
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

},{}]},{},[1])(1)
});