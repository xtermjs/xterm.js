/**
 * Copyright (c) 2017 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import jsdom = require('jsdom');
import { assert } from 'chai';
import { DomRendererRowFactory } from './DomRendererRowFactory';
import { LineData } from '../../Types';
import { DEFAULT_ATTR } from '../../Buffer';
import { FLAGS } from '../Types';

describe('DomRendererRowFactory', () => {
  let dom: jsdom.JSDOM;
  let rowFactory: DomRendererRowFactory;
  let lineData: LineData;

  beforeEach(() => {
    dom = new jsdom.JSDOM('');
    rowFactory = new DomRendererRowFactory(dom.window.document);
    lineData = createEmptyLineData(2);
  });

  describe('createRow', () => {
    it('should create an element for every character in the row', () => {
      const fragment = rowFactory.createRow(lineData, false, 0, 5, 20);
      assert.equal(getFragmentHtml(fragment),
        '<span> </span>' +
        '<span> </span>'
      );
    });

    it('should set correct attributes for double width characters', () => {
      lineData[0] = [DEFAULT_ATTR, '語', 2, '語'.charCodeAt(0)];
      // There should be no element for the following "empty" cell
      lineData[1] = [DEFAULT_ATTR, '', 0, undefined];
      const fragment = rowFactory.createRow(lineData, false, 0, 5, 20);
      assert.equal(getFragmentHtml(fragment),
        '<span style="width: 10px;">語</span>'
      );
    });

    it('should add class for cursor', () => {
      const fragment = rowFactory.createRow(lineData, true, 0, 5, 20);
      assert.equal(getFragmentHtml(fragment),
        '<span class="xterm-cursor"> </span>' +
        '<span> </span>'
      );
    });

    it('should not render cells that go beyond the terminal\'s columns', () => {
      lineData[0] = [DEFAULT_ATTR, 'a', 1, 'a'.charCodeAt(0)];
      lineData[1] = [DEFAULT_ATTR, 'b', 1, 'b'.charCodeAt(0)];
      const fragment = rowFactory.createRow(lineData, false, 0, 5, 1);
      assert.equal(getFragmentHtml(fragment),
        '<span>a</span>'
      );
    });

    describe('attributes', () => {
      it('should add class for bold', () => {
        lineData[0] = [DEFAULT_ATTR | (FLAGS.BOLD << 18), 'a', 1, 'a'.charCodeAt(0)];
        const fragment = rowFactory.createRow(lineData, false, 0, 5, 20);
        assert.equal(getFragmentHtml(fragment),
          '<span class="xterm-bold">a</span>' +
          '<span> </span>'
        );
      });

      it('should add class for italic', () => {
        lineData[0] = [DEFAULT_ATTR | (FLAGS.ITALIC << 18), 'a', 1, 'a'.charCodeAt(0)];
        const fragment = rowFactory.createRow(lineData, false, 0, 5, 20);
        assert.equal(getFragmentHtml(fragment),
          '<span class="xterm-italic">a</span>' +
          '<span> </span>'
        );
      });

      it('should add classes for 256 foreground colors', () => {
        const defaultAttrNoFgColor = (0 << 9) | (256 << 0);
        for (let i = 0; i < 256; i++) {
          lineData[0] = [defaultAttrNoFgColor | (i << 9), 'a', 1, 'a'.charCodeAt(0)];
          const fragment = rowFactory.createRow(lineData, false, 0, 5, 20);
          assert.equal(getFragmentHtml(fragment),
            `<span class="xterm-fg-${i}">a</span>` +
            '<span> </span>'
          );
        }
      });

      it('should add classes for 256 background colors', () => {
        const defaultAttrNoBgColor = (257 << 9) | (0 << 0);
        for (let i = 0; i < 256; i++) {
          lineData[0] = [defaultAttrNoBgColor | (i << 0), 'a', 1, 'a'.charCodeAt(0)];
          const fragment = rowFactory.createRow(lineData, false, 0, 5, 20);
          assert.equal(getFragmentHtml(fragment),
            `<span class="xterm-bg-${i}">a</span>` +
            '<span> </span>'
          );
        }
      });

      it('should correctly invert colors', () => {
        lineData[0] = [(FLAGS.INVERSE << 18) | (2 << 9) | (1 << 0), 'a', 1, 'a'.charCodeAt(0)];
        const fragment = rowFactory.createRow(lineData, false, 0, 5, 20);
        assert.equal(getFragmentHtml(fragment),
          '<span class="xterm-fg-1 xterm-bg-2">a</span>' +
          '<span> </span>'
        );
      });

      it('should correctly invert default fg color', () => {
        lineData[0] = [(FLAGS.INVERSE << 18) | (257 << 9) | (1 << 0), 'a', 1, 'a'.charCodeAt(0)];
        const fragment = rowFactory.createRow(lineData, false, 0, 5, 20);
        assert.equal(getFragmentHtml(fragment),
          '<span class="xterm-fg-1 xterm-bg-15">a</span>' +
          '<span> </span>'
        );
      });

      it('should correctly invert default bg color', () => {
        lineData[0] = [(FLAGS.INVERSE << 18) | (1 << 9) | (256 << 0), 'a', 1, 'a'.charCodeAt(0)];
        const fragment = rowFactory.createRow(lineData, false, 0, 5, 20);
        assert.equal(getFragmentHtml(fragment),
          '<span class="xterm-fg-0 xterm-bg-1">a</span>' +
          '<span> </span>'
        );
      });

      it('should turn bold fg text bright', () => {
        for (let i = 0; i < 8; i++) {
          lineData[0] = [(FLAGS.BOLD << 18) | (i << 9) | (256 << 0), 'a', 1, 'a'.charCodeAt(0)];
          const fragment = rowFactory.createRow(lineData, false, 0, 5, 20);
          assert.equal(getFragmentHtml(fragment),
            `<span class="xterm-bold xterm-fg-${i + 8}">a</span>` +
            '<span> </span>'
          );
        }
      });
    });
  });

  function getFragmentHtml(fragment: DocumentFragment): string {
    const element = dom.window.document.createElement('div');
    element.appendChild(fragment);
    return element.innerHTML;
  }

  function createEmptyLineData(cols: number): LineData {
    const lineData: LineData = [];
    for (let i = 0; i < cols; i++) {
      lineData.push([DEFAULT_ATTR, ' ', 1, 32 /* ' '.charCodeAt(0) */]);
    }
    return lineData;
  }
});
