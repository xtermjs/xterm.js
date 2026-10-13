/**
 * Copyright (c) 2017 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import jsdom = require('jsdom');
import { assert } from 'chai';
import { getCoords, getCoordsRelativeToElement } from './Mouse';

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

  function createElement(left: number, top: number, width: number, height: number, scaleX = 1, scaleY = scaleX): HTMLElement {
    const element = document.createElement('div');
    Object.defineProperties(element, {
      offsetWidth: { value: width },
      offsetHeight: { value: height }
    });
    element.getBoundingClientRect = () => ({
      x: left,
      y: top,
      left,
      top,
      right: left + width * scaleX,
      bottom: top + height * scaleY,
      width: width * scaleX,
      height: height * scaleY,
      toJSON: () => undefined
    });
    return element;
  }

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

  it('should account for an element scaled down by a CSS transform', () => {
    const element = createElement(50, 80, 100, 200, 0.6);
    const coords = getCoords(windowOverride, { clientX: 65, clientY: 98 }, element, 10, 10, true, CHAR_WIDTH, CHAR_HEIGHT);
    assert.deepEqual(coords, [3, 2]);
  });

  it('should account for an element scaled up by a CSS transform', () => {
    const element = createElement(50, 80, 100, 200, 1.6);
    const coords = getCoords(windowOverride, { clientX: 90, clientY: 128 }, element, 10, 10, true, CHAR_WIDTH, CHAR_HEIGHT);
    assert.deepEqual(coords, [3, 2]);
  });

  it('should subtract padding after accounting for CSS transform scale', () => {
    windowOverride = {
      getComputedStyle(): any {
        return {
          getPropertyValue: (property: string) => property === 'padding-left' ? '10px' : '5px'
        } as Pick<CSSStyleDeclaration, 'getPropertyValue'>;
      }
    };
    const element = createElement(50, 80, 200, 400, 0.5, 0.25);
    const coords = getCoordsRelativeToElement(windowOverride, { clientX: 100, clientY: 105 }, element);
    assert.deepEqual(coords, [90, 95]);
  });

  it('should preserve unscaled coordinates when element dimensions cannot be measured', () => {
    const element = createElement(50, 80, 0, 0);
    const coords = getCoordsRelativeToElement(windowOverride, { clientX: 75, clientY: 110 }, element);
    assert.deepEqual(coords, [25, 30]);
  });
});
