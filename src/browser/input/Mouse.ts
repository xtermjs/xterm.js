/**
 * Copyright (c) 2017 The xterm.js authors. All rights reserved.
 * @license MIT
 */

export function getCoordsRelativeToElement(event: {clientX: number, clientY: number}, element: HTMLElement): [number, number] {
  const rect = element.getBoundingClientRect();
  return [event.clientX - rect.left, event.clientY - rect.top];
}

/**
 * Gets coordinates within the terminal for a particular mouse event. The result
 * is returned as an array in the form [x, y] instead of an object as it's a
 * little faster and this function is used in some low level code.
 * @param event The mouse event.
 * @param element The terminal's container element.
 * @param colCount The number of columns in the terminal.
 * @param rowCount The number of rows n the terminal.
 * @param isSelection Whether the request is for the selection or not. This will
 * apply an offset to the x value such that the left half of the cell will
 * select that cell and the right half will select the next cell.
 */
export function getCoords(event: {clientX: number, clientY: number}, element: HTMLElement, colCount: number, rowCount: number, hasValidCharSize: boolean, actualCellWidth: number, actualCellHeight: number, isSelection?: boolean): [number, number] | undefined {
  // Coordinates cannot be measured if there are no valid
  if (!hasValidCharSize) {
    return undefined;
  }

  const coords = getCoordsRelativeToElement(event, element);
  if (!coords) {
    return undefined;
  }

  coords[0] = Math.ceil((coords[0] + (isSelection ? actualCellWidth / 2 : 0)) / actualCellWidth);
  coords[1] = Math.ceil(coords[1] / actualCellHeight);

  // Ensure coordinates are within the terminal viewport. Note that selections
  // need an addition point of precision to cover the end point (as characters
  // cover half of one char and half of the next).
  coords[0] = Math.min(Math.max(coords[0], 1), colCount + (isSelection ? 1 : 0));
  coords[1] = Math.min(Math.max(coords[1], 1), rowCount);

  return coords;
}

/**
 * Gets coordinates within the terminal for a particular mouse event, wrapping
 * them to the bounds of the terminal and adding 32 to both the x and y values
 * as expected by xterm.
 */
export function getRawByteCoords(coords: [number, number] | undefined): { x: number, y: number } | undefined {
  if (!coords) {
    return undefined;
  }

  // xterm sends raw bytes and starts at 32 (SP) for each.
  return { x: coords[0] + 32, y: coords[1] + 32 };
}
