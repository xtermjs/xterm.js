/**
 * Copyright (c) 2017 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import jsdom = require('jsdom');
import { assert } from 'chai';
import { MouseHelper } from './MouseHelper';
import { MockCharMeasure, MockRenderer } from './TestUtils.test';

const CHAR_WIDTH = 10;
const CHAR_HEIGHT = 20;

describe('MouseHelper.getCoords', () => {
  let dom: jsdom.JSDOM;
  let window: Window;
  let document: Document;
  let mouseHelper: MouseHelper;

  let charMeasure: MockCharMeasure;

  beforeEach(() => {
    dom = new jsdom.JSDOM('');
    window = dom.window;
    document = window.document;
    charMeasure = new MockCharMeasure();
    charMeasure.width = CHAR_WIDTH;
    charMeasure.height = CHAR_HEIGHT;
    const renderer = new MockRenderer();
    renderer.dimensions = <any>{
      actualCellWidth: CHAR_WIDTH,
      actualCellHeight: CHAR_HEIGHT
    };
    mouseHelper = new MouseHelper(renderer);
  });

  describe('when charMeasure is not initialized', () => {
    it('should return null', () => {
      charMeasure = new MockCharMeasure();
      assert.equal(mouseHelper.getCoords({ pageX: 0, pageY: 0 }, document.createElement('div'), charMeasure, 1, 10, 10), null);
    });
  });

  describe('when pageX/pageY are not supported', () => {
    it('should return null', () => {
      assert.equal(mouseHelper.getCoords({ pageX: undefined, pageY: undefined }, document.createElement('div'), charMeasure, 1, 10, 10), null);
    });
  });

  it('should return the cell that was clicked', () => {
    let coords: [number, number];
    coords = mouseHelper.getCoords({ pageX: CHAR_WIDTH / 2, pageY: CHAR_HEIGHT / 2 }, document.createElement('div'), charMeasure, 1, 10, 10);
    assert.deepEqual(coords, [1, 1]);
    coords = mouseHelper.getCoords({ pageX: CHAR_WIDTH, pageY: CHAR_HEIGHT }, document.createElement('div'), charMeasure, 1, 10, 10);
    assert.deepEqual(coords, [1, 1]);
    coords = mouseHelper.getCoords({ pageX: CHAR_WIDTH, pageY: CHAR_HEIGHT + 1 }, document.createElement('div'), charMeasure, 1, 10, 10);
    assert.deepEqual(coords, [1, 2]);
    coords = mouseHelper.getCoords({ pageX: CHAR_WIDTH + 1, pageY: CHAR_HEIGHT }, document.createElement('div'), charMeasure, 1, 10, 10);
    assert.deepEqual(coords, [2, 1]);
  });

  it('should ensure the coordinates are returned within the terminal bounds', () => {
    let coords: [number, number];
    coords = mouseHelper.getCoords({ pageX: -1, pageY: -1 }, document.createElement('div'), charMeasure, 1, 10, 10);
    assert.deepEqual(coords, [1, 1]);
    // Event are double the cols/rows
    coords = mouseHelper.getCoords({ pageX: CHAR_WIDTH * 20, pageY: CHAR_HEIGHT * 20 }, document.createElement('div'), charMeasure, 1, 10, 10);
    assert.deepEqual(coords, [10, 10], 'coordinates should never come back as larger than the terminal');
  });
});
