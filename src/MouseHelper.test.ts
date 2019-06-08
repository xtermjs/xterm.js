/**
 * Copyright (c) 2017 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import jsdom = require('jsdom');
import { assert } from 'chai';
import { MouseHelper } from './MouseHelper';
import { MockRenderer, MockCharSizeService } from './TestUtils.test';

const CHAR_WIDTH = 10;
const CHAR_HEIGHT = 20;

describe('MouseHelper.getCoords', () => {
  let document: Document;
  let mouseHelper: MouseHelper;

  beforeEach(() => {
    document = new jsdom.JSDOM('').window.document;
    const renderer = new MockRenderer();
    renderer.dimensions = <any>{
      actualCellWidth: CHAR_WIDTH,
      actualCellHeight: CHAR_HEIGHT
    };
    mouseHelper = new MouseHelper(renderer as any, new MockCharSizeService(CHAR_WIDTH, CHAR_HEIGHT));
  });

  it('should return the cell that was clicked', () => {
    let coords: [number, number];
    coords = mouseHelper.getCoords({ clientX: CHAR_WIDTH / 2, clientY: CHAR_HEIGHT / 2 }, document.createElement('div'), 10, 10);
    assert.deepEqual(coords, [1, 1]);
    coords = mouseHelper.getCoords({ clientX: CHAR_WIDTH, clientY: CHAR_HEIGHT }, document.createElement('div'), 10, 10);
    assert.deepEqual(coords, [1, 1]);
    coords = mouseHelper.getCoords({ clientX: CHAR_WIDTH, clientY: CHAR_HEIGHT + 1 }, document.createElement('div'), 10, 10);
    assert.deepEqual(coords, [1, 2]);
    coords = mouseHelper.getCoords({ clientX: CHAR_WIDTH + 1, clientY: CHAR_HEIGHT }, document.createElement('div'), 10, 10);
    assert.deepEqual(coords, [2, 1]);
  });

  it('should ensure the coordinates are returned within the terminal bounds', () => {
    let coords: [number, number];
    coords = mouseHelper.getCoords({ clientX: -1, clientY: -1 }, document.createElement('div'), 10, 10);
    assert.deepEqual(coords, [1, 1]);
    // Event are double the cols/rows
    coords = mouseHelper.getCoords({ clientX: CHAR_WIDTH * 20, clientY: CHAR_HEIGHT * 20 }, document.createElement('div'), 10, 10);
    assert.deepEqual(coords, [10, 10], 'coordinates should never come back as larger than the terminal');
  });
});
