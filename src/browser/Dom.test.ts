/**
 * Copyright (c) 2020 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import jsdom = require('jsdom');
import { removeElementFromParent } from 'browser/Dom';
import { strictEqual, doesNotThrow } from 'assert';

describe('Dom', () => {
  const dom = new jsdom.JSDOM();
  const document = dom.window.document;

  describe('removeElementFromParent', () => {
    it('should remove single child', () => {
      const e = document.createElement('div');
      document.body.appendChild(e);
      strictEqual(e.parentElement, document.body);
      removeElementFromParent(e);
      strictEqual(e.parentElement, null);
    });
    it('should remove multiple elements', () => {
      const e1 = document.createElement('div');
      const e2 = document.createElement('div');
      document.body.appendChild(e1);
      document.body.appendChild(e2);
      strictEqual(e1.parentElement, document.body);
      strictEqual(e2.parentElement, document.body);
      removeElementFromParent(e1, e2);
      strictEqual(e1.parentElement, null);
      strictEqual(e2.parentElement, null);
    });
    it('should not throw on undefined', () => {
      const e = document.createElement('div');
      document.body.appendChild(e);
      strictEqual(e.parentElement, document.body);
      doesNotThrow(() => removeElementFromParent(undefined, e));
      strictEqual(e.parentElement, null);
    });
  });
});
