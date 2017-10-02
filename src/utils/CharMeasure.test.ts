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
    it('should set _measureElement on first call', () => {
      charMeasure.measure({});
      assert.isDefined((<any>charMeasure)._measureElement, 'CharMeasure.measure should have created _measureElement');
    });

    it('should be performed async on first call', done => {
      assert.equal(charMeasure.width, null);
      charMeasure.measure({});
      // Mock getBoundingClientRect since jsdom doesn't have a layout engine
      (<any>charMeasure)._measureElement.getBoundingClientRect = () => {
        return { width: 1, height: 1 };
      };
      assert.equal(charMeasure.width, null);
      setTimeout(() => {
        assert.equal(charMeasure.width, 1);
        done();
      }, 0);
    });

    it('should be performed sync on successive calls', done => {
      charMeasure.measure({});
      // Mock getBoundingClientRect since jsdom doesn't have a layout engine
      (<any>charMeasure)._measureElement.getBoundingClientRect = () => {
        return { width: 1, height: 1 };
      };
      setTimeout(() => {
        const firstWidth = charMeasure.width;
        // Mock getBoundingClientRect since jsdom doesn't have a layout engine
        (<any>charMeasure)._measureElement.getBoundingClientRect = () => {
          return { width: 2, height: 2 };
        };
        charMeasure.measure({});
        assert.equal(charMeasure.width, firstWidth * 2);
        done();
      }, 0);
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
