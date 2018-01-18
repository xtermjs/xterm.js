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

export interface IGeometry {
  rows: number;
  cols: number;
}

export function proposeGeometry(term: any): IGeometry {
  if (!term.element.parentElement) {
    return null;
  }
  const parentElementStyle = window.getComputedStyle(term.element.parentElement);
  const parentElementHeight = parseInt(parentElementStyle.getPropertyValue('height'));
  const parentElementWidth = Math.max(0, parseInt(parentElementStyle.getPropertyValue('width')) - 17);
  const elementStyle = window.getComputedStyle(term.element);
  const elementPaddingVer = parseInt(elementStyle.getPropertyValue('padding-top')) + parseInt(elementStyle.getPropertyValue('padding-bottom'));
  const elementPaddingHor = parseInt(elementStyle.getPropertyValue('padding-right')) + parseInt(elementStyle.getPropertyValue('padding-left'));
  const availableHeight = parentElementHeight - elementPaddingVer;
  const availableWidth = parentElementWidth - elementPaddingHor;
  const geometry = {
    cols: Math.floor(availableWidth / term.renderer.dimensions.actualCellWidth),
    rows: Math.floor(availableHeight / term.renderer.dimensions.actualCellHeight)
  };

  return geometry;
}

export function fit(term: any): void {
  const geometry = proposeGeometry(term);
  if (geometry) {
    // Force a full render
    if (term.rows !== geometry.rows || term.cols !== geometry.cols) {
      term.renderer.clear();
      term.resize(geometry.cols, geometry.rows);
    }
  }
}

export function apply(terminalConstructor: any): void {
  terminalConstructor.prototype.proposeGeometry = function (): IGeometry {
    return proposeGeometry(this);
  };

  terminalConstructor.prototype.fit = function (): void {
    fit(this);
  };
}
