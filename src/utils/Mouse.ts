/**
 * @license MIT
 */

import { CharMeasure } from './CharMeasure';

export function getCoordsRelativeToElement(event: MouseEvent, element: HTMLElement): [number, number] {
  // Ignore browsers that don't support MouseEvent.pageX
  if (event.pageX == null) {
    return null;
  }

  let x = event.pageX;
  let y = event.pageY;

  // Converts the coordinates from being relative to the document to being
  // relative to the terminal.
  while (element && element !== self.document.documentElement) {
    x -= element.offsetLeft;
    y -= element.offsetTop;
    element = 'offsetParent' in element ? <HTMLElement>element.offsetParent : <HTMLElement>element.parentElement;
  }
  return [x, y];
}

/**
 * Gets coordinates within the terminal for a particular mouse event. The result
 * is returned as an array in the form [x, y] instead of an object as it's a
 * little faster and this function is used in some low level code.
 * @param event The mouse event.
 * @param rowContainer The terminal's row container.
 * @param charMeasure The char measure object used to determine character sizes.
 * @param colCount The number of columns in the terminal.
 * @param rowCount The number of rows n the terminal.
 * @param isSelection Whether the request is for the selection or not. This will
 * apply an offset to the x value such that the left half of the cell will
 * select that cell and the right half will select the next cell.
 */
export function getCoords(event: MouseEvent, rowContainer: HTMLElement, charMeasure: CharMeasure, colCount: number, rowCount: number, isSelection?: boolean): [number, number] {
  const coords = getCoordsRelativeToElement(event, rowContainer);

  // Convert to cols/rows.
  coords[0] = Math.ceil((coords[0] + (isSelection ? charMeasure.width / 2 : 0)) / charMeasure.width);
  coords[1] = Math.ceil(coords[1] / charMeasure.height);

  // Ensure coordinates are within the terminal viewport.
  coords[0] = Math.min(Math.max(coords[0], 1), colCount + 1);
  coords[1] = Math.min(Math.max(coords[1], 1), rowCount + 1);

  return coords;
}

/**
 * Gets coordinates within the terminal for a particular mouse event, wrapping
 * them to the bounds of the terminal and adding 32 to both the x and y values
 * as expected by xterm.
 * @param event The mouse event.
 * @param rowContainer The terminal's row container.
 * @param charMeasure The char measure object used to determine character sizes.
 * @param colCount The number of columns in the terminal.
 * @param rowCount The number of rows in the terminal.
 */
export function getRawByteCoords(event: MouseEvent, rowContainer: HTMLElement, charMeasure: CharMeasure, colCount: number, rowCount: number): { x: number, y: number } {
  const coords = getCoords(event, rowContainer, charMeasure, colCount, rowCount);
  let x = coords[0];
  let y = coords[1];

  // xterm sends raw bytes and starts at 32 (SP) for each.
  x += 32;
  y += 32;

  return { x, y };
}
