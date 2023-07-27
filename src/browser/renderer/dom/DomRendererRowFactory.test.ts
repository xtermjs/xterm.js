/**
 * Copyright (c) 2017 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import jsdom = require('jsdom');
import { assert } from 'chai';
import { DomRendererRowFactory } from 'browser/renderer/dom/DomRendererRowFactory';
import { NULL_CELL_CODE, NULL_CELL_WIDTH, NULL_CELL_CHAR, DEFAULT_ATTR, FgFlags, BgFlags, Attributes, UnderlineStyle } from 'common/buffer/Constants';
import { BufferLine, DEFAULT_ATTR_DATA } from 'common/buffer/BufferLine';
import { IBufferLine } from 'common/Types';
import { CellData } from 'common/buffer/CellData';
import { MockCoreService, MockDecorationService, MockOptionsService } from 'common/TestUtils.test';
import { css } from 'common/Color';
import { MockCharacterJoinerService, MockCoreBrowserService, MockThemeService } from 'browser/TestUtils.test';
import { FontMetrics } from 'browser/renderer/dom/DomRenderer';

const EMPTY_METRICS = new Uint8Array(FontMetrics.MAX);
EMPTY_METRICS.fill(0xFF);
const EMPTY_LINKSTATE = new Uint8Array(3);

describe('DomRendererRowFactory', () => {
  let dom: jsdom.JSDOM;
  let rowFactory: DomRendererRowFactory;
  let lineData: IBufferLine;

  beforeEach(() => {
    dom = new jsdom.JSDOM('');
    rowFactory = new DomRendererRowFactory(
      dom.window.document,
      new MockCharacterJoinerService(),
      new MockOptionsService({ drawBoldTextInBrightColors: true }),
      new MockCoreBrowserService(),
      new MockCoreService(),
      new MockDecorationService(),
      new MockThemeService()
    );
    lineData = createEmptyLineData(2);
  });

  describe('createRow', () => {
    it('should not create anything for an empty row', () => {
      const fragment = rowFactory.createRow(lineData, 0, false, undefined, 0, false, 5, EMPTY_METRICS, EMPTY_LINKSTATE);
      assert.equal(getFragmentHtml(fragment),
        ''
      );
    });

    it('should set correct attributes for double width characters', () => {
      lineData.setCell(0, CellData.fromCharData([DEFAULT_ATTR, '語', 2, '語'.charCodeAt(0)]));
      // There should be no element for the following "empty" cell
      lineData.setCell(1, CellData.fromCharData([DEFAULT_ATTR, '', 0, 0]));
      const fragment = rowFactory.createRow(lineData, 0, false, undefined, 0, false, 5, EMPTY_METRICS, EMPTY_LINKSTATE);
      assert.equal(getFragmentHtml(fragment),
        '<span style="width: 10px;">語</span>'
      );
    });

    it('should add class for cursor and cursor style', () => {
      for (const style of ['block', 'bar', 'underline']) {
        const fragment = rowFactory.createRow(lineData, 0, true, style, 0, false, 5, EMPTY_METRICS, EMPTY_LINKSTATE);
        assert.equal(getFragmentHtml(fragment),
          `<span class="xterm-cursor xterm-cursor-${style}"> </span>`
        );
      }
    });

    it('should add class for cursor blink', () => {
      const fragment = rowFactory.createRow(lineData, 0, true, 'block', 0, true, 5, EMPTY_METRICS, EMPTY_LINKSTATE);
      assert.equal(getFragmentHtml(fragment),
        `<span class="xterm-cursor xterm-cursor-blink xterm-cursor-block"> </span>`
      );
    });

    describe('attributes', () => {
      it('should add class for bold', () => {
        const cell = CellData.fromCharData([0, 'a', 1, 'a'.charCodeAt(0)]);
        cell.fg = DEFAULT_ATTR_DATA.fg | FgFlags.BOLD;
        lineData.setCell(0, cell);
        const fragment = rowFactory.createRow(lineData, 0, false, undefined, 0, false, 5, EMPTY_METRICS, EMPTY_LINKSTATE);
        assert.equal(getFragmentHtml(fragment),
          '<span class="xterm-bold">a</span>'
        );
      });

      it('should add class for italic', () => {
        const cell = CellData.fromCharData([0, 'a', 1, 'a'.charCodeAt(0)]);
        cell.bg = DEFAULT_ATTR_DATA.bg | BgFlags.ITALIC;
        lineData.setCell(0, cell);
        const fragment = rowFactory.createRow(lineData, 0, false, undefined, 0, false, 5, EMPTY_METRICS, EMPTY_LINKSTATE);
        assert.equal(getFragmentHtml(fragment),
          '<span class="xterm-italic">a</span>'
        );
      });

      it('should add class for dim', () => {
        const cell = CellData.fromCharData([0, 'a', 1, 'a'.charCodeAt(0)]);
        cell.bg = DEFAULT_ATTR_DATA.bg | BgFlags.DIM;
        lineData.setCell(0, cell);
        const fragment = rowFactory.createRow(lineData, 0, false, undefined, 0, false, 5, EMPTY_METRICS, EMPTY_LINKSTATE);
        assert.equal(getFragmentHtml(fragment),
          '<span class="xterm-dim">a</span>'
        );
      });

      describe('underline', () => {
        it('should add class for straight underline style', () => {
          const cell = CellData.fromCharData([0, 'a', 1, 'a'.charCodeAt(0)]);
          cell.fg = DEFAULT_ATTR_DATA.fg | FgFlags.UNDERLINE;
          cell.bg = DEFAULT_ATTR_DATA.bg | BgFlags.HAS_EXTENDED;
          cell.extended.underlineStyle = UnderlineStyle.SINGLE;
          lineData.setCell(0, cell);
          const fragment = rowFactory.createRow(lineData, 0, false, undefined, 0, false, 5, EMPTY_METRICS, EMPTY_LINKSTATE);
          assert.equal(getFragmentHtml(fragment),
            '<span class="xterm-underline-1">a</span>'
          );
        });
        it('should add class for double underline style', () => {
          const cell = CellData.fromCharData([0, 'a', 1, 'a'.charCodeAt(0)]);
          cell.fg = DEFAULT_ATTR_DATA.fg | FgFlags.UNDERLINE;
          cell.bg = DEFAULT_ATTR_DATA.bg | BgFlags.HAS_EXTENDED;
          cell.extended.underlineStyle = UnderlineStyle.DOUBLE;
          lineData.setCell(0, cell);
          const fragment = rowFactory.createRow(lineData, 0, false, undefined, 0, false, 5, EMPTY_METRICS, EMPTY_LINKSTATE);
          assert.equal(getFragmentHtml(fragment),
            '<span class="xterm-underline-2">a</span>'
          );
        });
        it('should add class for curly underline style', () => {
          const cell = CellData.fromCharData([0, 'a', 1, 'a'.charCodeAt(0)]);
          cell.fg = DEFAULT_ATTR_DATA.fg | FgFlags.UNDERLINE;
          cell.bg = DEFAULT_ATTR_DATA.bg | BgFlags.HAS_EXTENDED;
          cell.extended.underlineStyle = UnderlineStyle.CURLY;
          lineData.setCell(0, cell);
          const fragment = rowFactory.createRow(lineData, 0, false, undefined, 0, false, 5, EMPTY_METRICS, EMPTY_LINKSTATE);
          assert.equal(getFragmentHtml(fragment),
            '<span class="xterm-underline-3">a</span>'
          );
        });
        it('should add class for double dotted style', () => {
          const cell = CellData.fromCharData([0, 'a', 1, 'a'.charCodeAt(0)]);
          cell.fg = DEFAULT_ATTR_DATA.fg | FgFlags.UNDERLINE;
          cell.bg = DEFAULT_ATTR_DATA.bg | BgFlags.HAS_EXTENDED;
          cell.extended.underlineStyle = UnderlineStyle.DOTTED;
          lineData.setCell(0, cell);
          const fragment = rowFactory.createRow(lineData, 0, false, undefined, 0, false, 5, EMPTY_METRICS, EMPTY_LINKSTATE);
          assert.equal(getFragmentHtml(fragment),
            '<span class="xterm-underline-4">a</span>'
          );
        });
        it('should add class for dashed underline style', () => {
          const cell = CellData.fromCharData([0, 'a', 1, 'a'.charCodeAt(0)]);
          cell.fg = DEFAULT_ATTR_DATA.fg | FgFlags.UNDERLINE;
          cell.bg = DEFAULT_ATTR_DATA.bg | BgFlags.HAS_EXTENDED;
          cell.extended.underlineStyle = UnderlineStyle.DASHED;
          lineData.setCell(0, cell);
          const fragment = rowFactory.createRow(lineData, 0, false, undefined, 0, false, 5, EMPTY_METRICS, EMPTY_LINKSTATE);
          assert.equal(getFragmentHtml(fragment),
            '<span class="xterm-underline-5">a</span>'
          );
        });
      });

      it('should add class for overline', () => {
        const cell = CellData.fromCharData([0, 'a', 1, 'a'.charCodeAt(0)]);
        cell.bg = DEFAULT_ATTR_DATA.bg | BgFlags.OVERLINE;
        lineData.setCell(0, cell);
        const fragment = rowFactory.createRow(lineData, 0, false, undefined, 0, false, 5, EMPTY_METRICS, EMPTY_LINKSTATE);
        assert.equal(getFragmentHtml(fragment),
          '<span class="xterm-overline">a</span>'
        );
      });

      it('should add class for strikethrough', () => {
        const cell = CellData.fromCharData([0, 'a', 1, 'a'.charCodeAt(0)]);
        cell.fg = DEFAULT_ATTR_DATA.fg | FgFlags.STRIKETHROUGH;
        lineData.setCell(0, cell);
        const fragment = rowFactory.createRow(lineData, 0, false, undefined, 0, false, 5, EMPTY_METRICS, EMPTY_LINKSTATE);
        assert.equal(getFragmentHtml(fragment),
          '<span class="xterm-strikethrough">a</span>'
        );
      });

      it('should add classes for 256 foreground colors', () => {
        const cell = CellData.fromCharData([0, 'a', 1, 'a'.charCodeAt(0)]);
        cell.fg |= Attributes.CM_P256;
        for (let i = 0; i < 256; i++) {
          cell.fg &= ~Attributes.PCOLOR_MASK;
          cell.fg |= i;
          lineData.setCell(0, cell);
          const fragment = rowFactory.createRow(lineData, 0, false, undefined, 0, false, 5, EMPTY_METRICS, EMPTY_LINKSTATE);
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
          const fragment = rowFactory.createRow(lineData, 0, false, undefined, 0, false, 5, EMPTY_METRICS, EMPTY_LINKSTATE);
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
        const fragment = rowFactory.createRow(lineData, 0, false, undefined, 0, false, 5, EMPTY_METRICS, EMPTY_LINKSTATE);
        assert.equal(getFragmentHtml(fragment),
          '<span class="xterm-bg-2 xterm-fg-1">a</span>'
        );
      });

      it('should correctly invert default fg color', () => {
        const cell = CellData.fromCharData([0, 'a', 1, 'a'.charCodeAt(0)]);
        cell.fg |= FgFlags.INVERSE;
        cell.bg |= Attributes.CM_P16 | 1;
        lineData.setCell(0, cell);
        const fragment = rowFactory.createRow(lineData, 0, false, undefined, 0, false, 5, EMPTY_METRICS, EMPTY_LINKSTATE);
        assert.equal(getFragmentHtml(fragment),
          '<span class="xterm-bg-257 xterm-fg-1">a</span>'
        );
      });

      it('should correctly invert default bg color', () => {
        const cell = CellData.fromCharData([0, 'a', 1, 'a'.charCodeAt(0)]);
        cell.fg |= Attributes.CM_P16 | 1 | FgFlags.INVERSE;
        lineData.setCell(0, cell);
        const fragment = rowFactory.createRow(lineData, 0, false, undefined, 0, false, 5, EMPTY_METRICS, EMPTY_LINKSTATE);
        assert.equal(getFragmentHtml(fragment),
          '<span class="xterm-bg-1 xterm-fg-257">a</span>'
        );
      });

      it('should turn bold fg text bright', () => {
        const cell = CellData.fromCharData([0, 'a', 1, 'a'.charCodeAt(0)]);
        cell.fg |= FgFlags.BOLD | Attributes.CM_P16;
        for (let i = 0; i < 8; i++) {
          cell.fg &= ~Attributes.PCOLOR_MASK;
          cell.fg |= i;
          lineData.setCell(0, cell);
          const fragment = rowFactory.createRow(lineData, 0, false, undefined, 0, false, 5, EMPTY_METRICS, EMPTY_LINKSTATE);
          assert.equal(getFragmentHtml(fragment),
            `<span class="xterm-bold xterm-fg-${i + 8}">a</span>`
          );
        }
      });

      it('should set style attribute for RBG', () => {
        const cell = CellData.fromCharData([0, 'a', 1, 'a'.charCodeAt(0)]);
        cell.fg |= Attributes.CM_RGB | 1 << 16 | 2 << 8 | 3;
        cell.bg |= Attributes.CM_RGB | 4 << 16 | 5 << 8 | 6;
        lineData.setCell(0, cell);
        const fragment = rowFactory.createRow(lineData, 0, false, undefined, 0, false, 5, EMPTY_METRICS, EMPTY_LINKSTATE);
        assert.equal(getFragmentHtml(fragment),
          '<span style="background-color:#040506;color:#010203;">a</span>'
        );
      });

      it('should correctly invert RGB colors', () => {
        const cell = CellData.fromCharData([0, 'a', 1, 'a'.charCodeAt(0)]);
        cell.fg |= Attributes.CM_RGB | 1 << 16 | 2 << 8 | 3 | FgFlags.INVERSE;
        cell.bg |= Attributes.CM_RGB | 4 << 16 | 5 << 8 | 6;
        lineData.setCell(0, cell);
        const fragment = rowFactory.createRow(lineData, 0, false, undefined, 0, false, 5, EMPTY_METRICS, EMPTY_LINKSTATE);
        assert.equal(getFragmentHtml(fragment),
          '<span style="background-color:#010203;color:#040506;">a</span>'
        );
      });
    });

    describe('selectionForeground', () => {
      it('should force selected cells with content to be rendered above the background', () => {
        lineData.setCell(0, CellData.fromCharData([DEFAULT_ATTR, 'a', 1, 'a'.charCodeAt(0)]));
        lineData.setCell(1, CellData.fromCharData([DEFAULT_ATTR, 'b', 1, 'b'.charCodeAt(0)]));
        rowFactory.handleSelectionChanged([1, 0], [2, 0], false);
        const fragment = rowFactory.createRow(lineData, 0, false, undefined, 0, false, 5, EMPTY_METRICS, EMPTY_LINKSTATE);
        assert.equal(getFragmentHtml(fragment),
          '<span>a</span><span class="xterm-decoration-top">b</span>'
        );
      });
      it('should force whitespace cells to be rendered above the background', () => {
        lineData.setCell(1, CellData.fromCharData([DEFAULT_ATTR, 'a', 1, 'a'.charCodeAt(0)]));
        rowFactory.handleSelectionChanged([0, 0], [2, 0], false);
        const fragment = rowFactory.createRow(lineData, 0, false, undefined, 0, false, 5, EMPTY_METRICS, EMPTY_LINKSTATE);
        assert.equal(getFragmentHtml(fragment),
          '<span class="xterm-decoration-top"> </span><span class="xterm-decoration-top">a</span>'
        );
      });
    });
  });

  describe.only('createRow with merged spans', () => {
    // for test purpose assume all in codepoints 0..255 are merging
    const ALL_MERGING = new Uint8Array(FontMetrics.MAX);

    beforeEach(() => {
      lineData = createEmptyLineData(10);
    });

    it('should not create anything for an empty row', () => {
      const fragment = rowFactory.createRow(lineData, 0, false, undefined, 0, false, 5, ALL_MERGING, EMPTY_LINKSTATE);
      assert.equal(getFragmentHtml(fragment),
        ''
      );
    });

    it('can merge codepoints in FontMetrics range', () => {
      lineData.setCell(0, CellData.fromCharData([DEFAULT_ATTR, 'a', 1, 'a'.charCodeAt(0)]));
      lineData.setCell(1, CellData.fromCharData([DEFAULT_ATTR, 'b', 1, 'b'.charCodeAt(0)]));
      lineData.setCell(2, CellData.fromCharData([DEFAULT_ATTR, 'c', 1, 'c'.charCodeAt(0)]));
      const fragment = rowFactory.createRow(lineData, 0, false, undefined, 0, false, 5, ALL_MERGING, EMPTY_LINKSTATE);
      assert.equal(getFragmentHtml(fragment),
        '<span style="width: auto;">abc</span>'
      );
    });

    it('should not merge codepoints outside of FontMetrics range', () => {
      lineData.setCell(0, CellData.fromCharData([DEFAULT_ATTR, 'a', 1, 'a'.charCodeAt(0)]));
      lineData.setCell(1, CellData.fromCharData([DEFAULT_ATTR, '€', 1, '€'.charCodeAt(0)]));
      lineData.setCell(2, CellData.fromCharData([DEFAULT_ATTR, 'c', 1, 'c'.charCodeAt(0)]));
      const fragment = rowFactory.createRow(lineData, 0, false, undefined, 0, false, 5, ALL_MERGING, EMPTY_LINKSTATE);
      assert.equal(getFragmentHtml(fragment),
        '<span>a</span><span>€</span><span>c</span>'
      );
    });

    it('should not merge on FG change', () => {
      const a_color1 = CellData.fromCharData([DEFAULT_ATTR, 'a', 1, 'a'.charCodeAt(0)]);
      a_color1.fg |= Attributes.CM_P16 | 1;
      const b_color2 = CellData.fromCharData([DEFAULT_ATTR, 'b', 1, 'b'.charCodeAt(0)]);
      b_color2.fg |= Attributes.CM_P16 | 2;
      lineData.setCell(0, a_color1);
      lineData.setCell(1, a_color1);
      lineData.setCell(2, b_color2);
      lineData.setCell(3, b_color2);
      const fragment = rowFactory.createRow(lineData, 0, false, undefined, 0, false, 5, ALL_MERGING, EMPTY_LINKSTATE);
      assert.equal(getFragmentHtml(fragment),
        '<span class="xterm-fg-1" style="width: 10px;">aa</span><span class="xterm-fg-2" style="width: auto;">bb</span>'
      );
    });

    it('should not merge cursor cell', () => {
      lineData.setCell(0, CellData.fromCharData([DEFAULT_ATTR, 'a', 1, 'a'.charCodeAt(0)]));
      lineData.setCell(1, CellData.fromCharData([DEFAULT_ATTR, 'a', 1, 'a'.charCodeAt(0)]));
      lineData.setCell(2, CellData.fromCharData([DEFAULT_ATTR, 'X', 1, 'X'.charCodeAt(0)]));
      lineData.setCell(3, CellData.fromCharData([DEFAULT_ATTR, 'b', 1, 'b'.charCodeAt(0)]));
      lineData.setCell(4, CellData.fromCharData([DEFAULT_ATTR, 'b', 1, 'b'.charCodeAt(0)]));
      const fragment = rowFactory.createRow(lineData, 0, true, undefined, 2, false, 5, ALL_MERGING, EMPTY_LINKSTATE);
      assert.equal(getFragmentHtml(fragment),
        '<span style="width: 10px;">aa</span><span class="xterm-cursor xterm-cursor-block">X</span><span style="width: auto;">bb</span>'
      );
    });

    it('should handle BCE correctly', () => {
      const nullCell = lineData.loadCell(0, new CellData());
      nullCell.bg = Attributes.CM_P16 | 1;
      lineData.setCell(2, nullCell);
      nullCell.bg = Attributes.CM_P16 | 2;
      lineData.setCell(3, nullCell);
      lineData.setCell(4, nullCell);
      const fragment = rowFactory.createRow(lineData, 0, false, undefined, 0, false, 5, ALL_MERGING, EMPTY_LINKSTATE);
      assert.equal(getFragmentHtml(fragment),
        '<span style="width: 10px;">  </span><span class="xterm-bg-1"> </span><span class="xterm-bg-2" style="width: 10px;">  </span>'
      );
    });

    it('should contain px value in BCE for multiple cells', () => {
      const nullCell = lineData.loadCell(0, new CellData());
      nullCell.bg = Attributes.CM_P16 | 1;
      lineData.setCell(0, nullCell);
      let fragment = rowFactory.createRow(lineData, 0, false, undefined, 0, false, 5, ALL_MERGING, EMPTY_LINKSTATE);
      assert.equal(getFragmentHtml(fragment),
        '<span class="xterm-bg-1"> </span>'
      );
      lineData.setCell(1, nullCell);
      fragment = rowFactory.createRow(lineData, 0, false, undefined, 0, false, 5, ALL_MERGING, EMPTY_LINKSTATE);
      assert.equal(getFragmentHtml(fragment),
        '<span class="xterm-bg-1" style="width: 10px;">  </span>'
      );
      lineData.setCell(2, nullCell);
      lineData.setCell(3, nullCell);
      fragment = rowFactory.createRow(lineData, 0, false, undefined, 0, false, 5, ALL_MERGING, EMPTY_LINKSTATE);
      assert.equal(getFragmentHtml(fragment),
        '<span class="xterm-bg-1" style="width: 20px;">    </span>'
      );
      lineData.setCell(4, CellData.fromCharData([DEFAULT_ATTR, 'a', 1, 'a'.charCodeAt(0)]));
      fragment = rowFactory.createRow(lineData, 0, false, undefined, 0, false, 5, ALL_MERGING, EMPTY_LINKSTATE);
      assert.equal(getFragmentHtml(fragment),
        '<span class="xterm-bg-1" style="width: 20px;">    </span><span>a</span>'
      );
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
