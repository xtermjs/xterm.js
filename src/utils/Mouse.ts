/**
 * @license MIT
 */

import { CharMeasure } from './CharMeasure';

export function getCoords(event: MouseEvent, rowContainer: HTMLElement, charMeasure: CharMeasure): [number, number] {
  // ignore browsers without pageX for now
  if (event.pageX == null) {
    return null;
  }

  let x = event.pageX;
  let y = event.pageY;
  let el = rowContainer;

  // should probably check offsetParent
  // but this is more portable
  while (el && el !== self.document.documentElement) {
    x -= el.offsetLeft;
    y -= el.offsetTop;
    el = 'offsetParent' in el ? <HTMLElement>el.offsetParent : <HTMLElement>el.parentElement;
  }

  // convert to cols/rows
  x = Math.ceil(x / charMeasure.width);
  y = Math.ceil(y / charMeasure.height);

  return [x, y];
}

export function getRawByteCoords(event: MouseEvent, rowContainer: HTMLElement, charMeasure: CharMeasure, colCount: number, rowCount: number): { x: number, y: number } {
  const coords = getCoords(event, rowContainer, charMeasure);
  let x = coords[0];
  let y = coords[1];

  // be sure to avoid sending bad positions to the program
  if (x < 0) x = 0;
  if (x > colCount) x = colCount;
  if (y < 0) y = 0;
  if (y > rowCount) y = rowCount;

  // xterm sends raw bytes and
  // starts at 32 (SP) for each.
  x += 32;
  y += 32;

  return { x, y };
}
