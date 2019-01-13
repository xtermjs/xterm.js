/**
 * Copyright (c) 2017 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import jsdom = require('jsdom');
import { assert } from 'chai';
import { DomRendererRowFactory } from './DomRendererRowFactory';
import { DEFAULT_ATTR, NULL_CELL_CODE, NULL_CELL_WIDTH, NULL_CELL_CHAR, DEFAULT_ATTR_DATA } from '../../Buffer';
import { BufferLine, CellData, FgFlags, BgFlags, Attributes } from '../../BufferLine';
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
    it('should not create anything for an empty row', () => {
      const fragment = rowFactory.createRow(lineData, false, undefined, 0, 5, 20);
      assert.equal(getFragmentHtml(fragment),
        ''
      );
    });

    it('should set correct attributes for double width characters', () => {
      lineData.setCell(0, CellData.fromCharData([DEFAULT_ATTR, '語', 2, '語'.charCodeAt(0)]));
      // There should be no element for the following "empty" cell
      lineData.setCell(1, CellData.fromCharData([DEFAULT_ATTR, '', 0, undefined]));
      const fragment = rowFactory.createRow(lineData, false, undefined, 0, 5, 20);
      assert.equal(getFragmentHtml(fragment),
        '<span style="width: 10px;">語</span>'
      );
    });

    it('should add class for cursor and cursor style', () => {
      for (const style of ['block', 'bar', 'underline']) {
        const fragment = rowFactory.createRow(lineData, true, style, 0, 5, 20);
        assert.equal(getFragmentHtml(fragment),
          `<span class="xterm-cursor xterm-cursor-${style}"> </span>`
        );
      }
    });

    it('should not render cells that go beyond the terminal\'s columns', () => {
      lineData.setCell(0, CellData.fromCharData([DEFAULT_ATTR, 'a', 1, 'a'.charCodeAt(0)]));
      lineData.setCell(1, CellData.fromCharData([DEFAULT_ATTR, 'b', 1, 'b'.charCodeAt(0)]));
      const fragment = rowFactory.createRow(lineData, false, undefined, 0, 5, 1);
      assert.equal(getFragmentHtml(fragment),
        '<span>a</span>'
      );
    });

    describe('attributes', () => {
      it('should add class for bold', () => {
        const cell = CellData.fromCharData([0, 'a', 1, 'a'.charCodeAt(0)]);
        cell.fg = DEFAULT_ATTR_DATA.fg | FgFlags.BOLD;
        lineData.setCell(0, cell);
        const fragment = rowFactory.createRow(lineData, false, undefined, 0, 5, 20);
        assert.equal(getFragmentHtml(fragment),
          '<span class="xterm-bold">a</span>'
        );
      });

      it('should add class for italic', () => {
        const cell = CellData.fromCharData([0, 'a', 1, 'a'.charCodeAt(0)]);
        cell.bg = DEFAULT_ATTR_DATA.bg | BgFlags.ITALIC;
        lineData.setCell(0, cell);
        const fragment = rowFactory.createRow(lineData, false, undefined, 0, 5, 20);
        assert.equal(getFragmentHtml(fragment),
          '<span class="xterm-italic">a</span>'
        );
      });

      it('should add classes for 256 foreground colors', () => {
        const cell = CellData.fromCharData([0, 'a', 1, 'a'.charCodeAt(0)]);
        cell.fg |= Attributes.CM_P256;
        for (let i = 0; i < 256; i++) {
          cell.fg &= ~Attributes.PCOLOR_MASK;
          cell.fg |= i;
          lineData.setCell(0, cell);
          const fragment = rowFactory.createRow(lineData, false, undefined, 0, 5, 20);
          assert.equal(getFragmentHtml(fragment),
            `<span class="xterm-fg-${i}">a</span>`
          );
        }
      });

      it('should add classes for 256 background colors', () => {
        const cell = CellData.fromCharData([0, 'a', 1, 'a'.charCodeAt(0)]);
        cell.bg |= Attributes.CM_P256;
        for (let i = 0; i < 256; i++) {
          cell.bg &= ~Attributes.PCOLOR_MASK;
          cell.bg |= i;
          lineData.setCell(0, cell);
          const fragment = rowFactory.createRow(lineData, false, undefined, 0, 5, 20);
          assert.equal(getFragmentHtml(fragment),
            `<span class="xterm-bg-${i}">a</span>`
          );
        }
      });

      it('should correctly invert colors', () => {
        const cell = CellData.fromCharData([0, 'a', 1, 'a'.charCodeAt(0)]);
        cell.fg |= Attributes.CM_P16 | 2 | FgFlags.INVERSE;
        cell.bg |= Attributes.CM_P16 | 1;
        lineData.setCell(0, cell);
        const fragment = rowFactory.createRow(lineData, false, undefined, 0, 5, 20);
        assert.equal(getFragmentHtml(fragment),
          '<span class="xterm-fg-1 xterm-bg-2">a</span>'
        );
      });

      it('should correctly invert default fg color', () => {
        const cell = CellData.fromCharData([0, 'a', 1, 'a'.charCodeAt(0)]);
        cell.fg |= FgFlags.INVERSE;
        cell.bg |= Attributes.CM_P16 | 1;
        lineData.setCell(0, cell);
        const fragment = rowFactory.createRow(lineData, false, undefined, 0, 5, 20);
        assert.equal(getFragmentHtml(fragment),
          '<span class="xterm-fg-1 xterm-bg-257">a</span>'
        );
      });

      it('should correctly invert default bg color', () => {
        const cell = CellData.fromCharData([0, 'a', 1, 'a'.charCodeAt(0)]);
        cell.fg |= Attributes.CM_P16 | 1 | FgFlags.INVERSE;
        lineData.setCell(0, cell);
        const fragment = rowFactory.createRow(lineData, false, undefined, 0, 5, 20);
        assert.equal(getFragmentHtml(fragment),
          '<span class="xterm-fg-257 xterm-bg-1">a</span>'
        );
      });

      it('should turn bold fg text bright', () => {
        const cell = CellData.fromCharData([0, 'a', 1, 'a'.charCodeAt(0)]);
        cell.fg |= FgFlags.BOLD | Attributes.CM_P16;
        for (let i = 0; i < 8; i++) {
          cell.fg &= ~Attributes.PCOLOR_MASK;
          cell.fg |= i;
          lineData.setCell(0, cell);
          const fragment = rowFactory.createRow(lineData, false, undefined, 0, 5, 20);
          assert.equal(getFragmentHtml(fragment),
            `<span class="xterm-bold xterm-fg-${i + 8}">a</span>`
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
    const lineData = new BufferLine(cols);
    for (let i = 0; i < cols; i++) {
      lineData.setCell(i, CellData.fromCharData([DEFAULT_ATTR, NULL_CELL_CHAR, NULL_CELL_WIDTH, NULL_CELL_CODE]));
    }
    return lineData;
  }
});
