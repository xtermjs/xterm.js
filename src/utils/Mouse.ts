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
