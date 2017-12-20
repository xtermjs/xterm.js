/**
 * Copyright (c) 2016 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import jsdom = require('jsdom');
import { assert } from 'chai';
import { ICharMeasure, ITerminal } from '../Interfaces';
import { CharMeasure } from './CharMeasure';

describe('CharMeasure', () => {
  let dom: jsdom.JSDOM;
  let window: Window;
  let document: Document;
  let container: HTMLElement;
  let charMeasure: ICharMeasure;

  beforeEach(() => {
    dom = new jsdom.JSDOM('');
    window = dom.window;
    document = window.document;
    container = document.createElement('div');
    document.body.appendChild(container);
    charMeasure = new CharMeasure(document, container);
  });

  describe('measure', () => {
    it('should have _measureElement', () => {
      assert.isDefined((<any>charMeasure)._measureElement, 'new CharMeasure() should have created _measureElement');
    });

    it('should be performed sync', () => {
      // Mock getBoundingClientRect since jsdom doesn't have a layout engine
      (<any>charMeasure)._measureElement.getBoundingClientRect = () => {
        return { width: 1, height: 1 };
      };
      charMeasure.measure({});
      assert.equal(charMeasure.height, 1);
      assert.equal(charMeasure.width, 1);
    });

    it('should NOT do a measure when the parent is hidden', done => {
      charMeasure.measure({});
      setTimeout(() => {
        const firstWidth = charMeasure.width;
        container.style.display = 'none';
        container.style.fontSize = '2em';
        charMeasure.measure({});
        assert.equal(charMeasure.width, firstWidth);
        done();
      }, 0);
    });
  });
});
