/**
 * Copyright (c) 2017 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import jsdom = require('jsdom');
import { assert } from 'chai';
import { DomRendererRowFactory } from './DomRendererRowFactory';
import { DEFAULT_ATTR, NULL_CELL_CODE, NULL_CELL_WIDTH, NULL_CELL_CHAR } from '../../Buffer';
import { FLAGS } from '../Types';
import { BufferLine } from '../../BufferLine';
import { IBufferLine } from '../../Types';

describe('DomRendererRowFactory', () => {
  let dom: jsdom.JSDOM;
  let rowFactory: DomRendererRowFactory;
  let lineData: IBufferLine;

  beforeEach(() => {
    dom = new jsdom.JSDOM('');
    rowFactory = new DomRendererRowFactory(dom.window.document);
    lineData = createEmptyLineData(2);
  });

  describe('createRow', () => {
    it('should create an element for every character in the row', () => {
      const fragment = rowFactory.createRow(lineData, false, undefined, 0, 5, 20);
      assert.equal(getFragmentHtml(fragment),
        '<span> </span>' +
        '<span> </span>'
      );
    });

    it('should set correct attributes for double width characters', () => {
      lineData.set(0, [DEFAULT_ATTR, '語', 2, '語'.charCodeAt(0)]);
      // There should be no element for the following "empty" cell
      lineData.set(1, [DEFAULT_ATTR, '', 0, undefined]);
      const fragment = rowFactory.createRow(lineData, false, undefined, 0, 5, 20);
      assert.equal(getFragmentHtml(fragment),
        '<span style="width: 10px;">語</span>'
      );
    });

    it('should add class for cursor and cursor style', () => {
      for (const style of ['block', 'bar', 'underline']) {
        const fragment = rowFactory.createRow(lineData, true, style, 0, 5, 20);
        assert.equal(getFragmentHtml(fragment),
          `<span class="xterm-cursor xterm-cursor-${style}"> </span>` +
          '<span> </span>'
        );
      }
    });

    it('should not render cells that go beyond the terminal\'s columns', () => {
      lineData.set(0, [DEFAULT_ATTR, 'a', 1, 'a'.charCodeAt(0)]);
      lineData.set(1, [DEFAULT_ATTR, 'b', 1, 'b'.charCodeAt(0)]);
      const fragment = rowFactory.createRow(lineData, false, undefined, 0, 5, 1);
      assert.equal(getFragmentHtml(fragment),
        '<span>a</span>'
      );
    });

    describe('attributes', () => {
      it('should add class for bold', () => {
        lineData.set(0, [DEFAULT_ATTR | (FLAGS.BOLD << 18), 'a', 1, 'a'.charCodeAt(0)]);
        const fragment = rowFactory.createRow(lineData, false, undefined, 0, 5, 20);
        assert.equal(getFragmentHtml(fragment),
          '<span class="xterm-bold">a</span>' +
          '<span> </span>'
        );
      });

      it('should add class for italic', () => {
        lineData.set(0, [DEFAULT_ATTR | (FLAGS.ITALIC << 18), 'a', 1, 'a'.charCodeAt(0)]);
        const fragment = rowFactory.createRow(lineData, false, undefined, 0, 5, 20);
        assert.equal(getFragmentHtml(fragment),
          '<span class="xterm-italic">a</span>' +
          '<span> </span>'
        );
      });

      it('should add classes for 256 foreground colors', () => {
        const defaultAttrNoFgColor = (0 << 9) | (256 << 0);
        for (let i = 0; i < 256; i++) {
          lineData.set(0, [defaultAttrNoFgColor | (i << 9), 'a', 1, 'a'.charCodeAt(0)]);
          const fragment = rowFactory.createRow(lineData, false, undefined, 0, 5, 20);
          assert.equal(getFragmentHtml(fragment),
            `<span class="xterm-fg-${i}">a</span>` +
            '<span> </span>'
          );
        }
      });

      it('should add classes for 256 background colors', () => {
        const defaultAttrNoBgColor = (257 << 9) | (0 << 0);
        for (let i = 0; i < 256; i++) {
          lineData.set(0, [defaultAttrNoBgColor | (i << 0), 'a', 1, 'a'.charCodeAt(0)]);
          const fragment = rowFactory.createRow(lineData, false, undefined, 0, 5, 20);
          assert.equal(getFragmentHtml(fragment),
            `<span class="xterm-bg-${i}">a</span>` +
            '<span> </span>'
          );
        }
      });

      it('should correctly invert colors', () => {
        lineData.set(0, [(FLAGS.INVERSE << 18) | (2 << 9) | (1 << 0), 'a', 1, 'a'.charCodeAt(0)]);
        const fragment = rowFactory.createRow(lineData, false, undefined, 0, 5, 20);
        assert.equal(getFragmentHtml(fragment),
          '<span class="xterm-fg-1 xterm-bg-2">a</span>' +
          '<span> </span>'
        );
      });

      it('should correctly invert default fg color', () => {
        lineData.set(0, [(FLAGS.INVERSE << 18) | (257 << 9) | (1 << 0), 'a', 1, 'a'.charCodeAt(0)]);
        const fragment = rowFactory.createRow(lineData, false, undefined, 0, 5, 20);
        assert.equal(getFragmentHtml(fragment),
          '<span class="xterm-fg-1 xterm-bg-15">a</span>' +
          '<span> </span>'
        );
      });

      it('should correctly invert default bg color', () => {
        lineData.set(0, [(FLAGS.INVERSE << 18) | (1 << 9) | (256 << 0), 'a', 1, 'a'.charCodeAt(0)]);
        const fragment = rowFactory.createRow(lineData, false, undefined, 0, 5, 20);
        assert.equal(getFragmentHtml(fragment),
          '<span class="xterm-fg-0 xterm-bg-1">a</span>' +
          '<span> </span>'
        );
      });

      it('should turn bold fg text bright', () => {
        for (let i = 0; i < 8; i++) {
          lineData.set(0, [(FLAGS.BOLD << 18) | (i << 9) | (256 << 0), 'a', 1, 'a'.charCodeAt(0)]);
          const fragment = rowFactory.createRow(lineData, false, undefined, 0, 5, 20);
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

  function createEmptyLineData(cols: number): IBufferLine {
    const lineData = new BufferLine();
    for (let i = 0; i < cols; i++) {
      lineData.push([DEFAULT_ATTR, NULL_CELL_CHAR, NULL_CELL_WIDTH, NULL_CELL_CODE]);
    }
    return lineData;
  }
});
