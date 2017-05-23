/**
 * @license MIT
 */

import { CharMeasure } from './CharMeasure';

/**
 * Gets coordinates within the terminal for a particular mouse event. The result
 * is returned as an array in the form [x, y] instead of an object as it's a
 * little faster and this function is used in some low level code.
 * @param event The mouse event.
 * @param rowContainer The terminal's row container.
 * @param charMeasure The char measure object used to determine character sizes.
 */
export function getCoords(event: MouseEvent, rowContainer: HTMLElement, charMeasure: CharMeasure): [number, number] {
  // Ignore browsers that don't support MouseEvent.pageX
  if (event.pageX == null) {
    return null;
  }

  let x = event.pageX;
  let y = event.pageY;
  let el = rowContainer;

  // Converts the coordinates from being relative to the document to being
  // relative to the terminal.
  while (el && el !== self.document.documentElement) {
    x -= el.offsetLeft;
    y -= el.offsetTop;
    el = 'offsetParent' in el ? <HTMLElement>el.offsetParent : <HTMLElement>el.parentElement;
  }

  // Convert to cols/rows
  x = Math.ceil(x / charMeasure.width);
  y = Math.ceil(y / charMeasure.height);

  return [x, y];
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
  const coords = getCoords(event, rowContainer, charMeasure);
  let x = coords[0];
  let y = coords[1];

  // Ensure coordinates are within the terminal viewport.
  x = Math.min(Math.max(x, 0), colCount);
  y = Math.min(Math.max(y, 0), rowCount);

  // xterm sends raw bytes and starts at 32 (SP) for each.
  x += 32;
  y += 32;

  return { x, y };
}
