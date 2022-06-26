/**
 * Copyright (c) 2017 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import jsdom = require('jsdom');
import { assert } from 'chai';
import { getCoords } from 'browser/input/Mouse';

const CHAR_WIDTH = 10;
const CHAR_HEIGHT = 20;

describe('Mouse getCoords', () => {
  let windowOverride: Pick<Window, 'getComputedStyle'>;
  let document: Document;

  beforeEach(() => {
    windowOverride = {
      getComputedStyle(): any {
        return {
          getPropertyValue: () => '0px'
        } as Pick<CSSStyleDeclaration, 'getPropertyValue'>;
      }
    };
    document = new jsdom.JSDOM('').window.document;
  });

  it('should return the cell that was clicked', () => {
    let coords: [number, number] | undefined;
    coords = getCoords(windowOverride, { clientX: CHAR_WIDTH / 2, clientY: CHAR_HEIGHT / 2 }, document.createElement('div'), 10, 10, true, CHAR_WIDTH, CHAR_HEIGHT);
    assert.deepEqual(coords, [1, 1]);
    coords = getCoords(windowOverride, { clientX: CHAR_WIDTH, clientY: CHAR_HEIGHT }, document.createElement('div'), 10, 10, true, CHAR_WIDTH, CHAR_HEIGHT);
    assert.deepEqual(coords, [1, 1]);
    coords = getCoords(windowOverride, { clientX: CHAR_WIDTH, clientY: CHAR_HEIGHT + 1 }, document.createElement('div'), 10, 10, true, CHAR_WIDTH, CHAR_HEIGHT);
    assert.deepEqual(coords, [1, 2]);
    coords = getCoords(windowOverride, { clientX: CHAR_WIDTH + 1, clientY: CHAR_HEIGHT }, document.createElement('div'), 10, 10, true, CHAR_WIDTH, CHAR_HEIGHT);
    assert.deepEqual(coords, [2, 1]);
  });

  it('should ensure the coordinates are returned within the terminal bounds', () => {
    let coords: [number, number] | undefined;
    coords = getCoords(windowOverride, { clientX: -1, clientY: -1 }, document.createElement('div'), 10, 10, true, CHAR_WIDTH, CHAR_HEIGHT);
    assert.deepEqual(coords, [1, 1]);
    // Event are double the cols/rows
    coords = getCoords(windowOverride, { clientX: CHAR_WIDTH * 20, clientY: CHAR_HEIGHT * 20 }, document.createElement('div'), 10, 10, true, CHAR_WIDTH, CHAR_HEIGHT);
    assert.deepEqual(coords, [10, 10], 'coordinates should never come back as larger than the terminal');
  });
});
