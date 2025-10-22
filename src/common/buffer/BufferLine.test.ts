/**
 * Copyright (c) 2018 The xterm.js authors. All rights reserved.
 * @license MIT
 */
import { NULL_CELL_CHAR, NULL_CELL_WIDTH, NULL_CELL_CODE, DEFAULT_ATTR, Content, UnderlineStyle, BgFlags, Attributes, FgFlags } from 'common/buffer/Constants';
import { BufferLine } from 'common/buffer//BufferLine';
import { CellData } from 'common/buffer/CellData';
import { CharData, IBufferLine, IExtendedAttrs } from '../Types';
import { assert } from 'chai';
import { AttributeData } from 'common/buffer/AttributeData';

function lineToArray(line: IBufferLine): CharData[] {
  const result = [];
  for (let i = 0; i < line.length; ++i) {
    result.push(line.loadCell(i, new CellData()).getAsCharData());
  }
  return result;
}

describe('AttributeData', () => {
  describe('extended attributes', () => {
    it('hasExtendedAttrs', () => {
      const attrs = new AttributeData();
      assert.equal(!!attrs.hasExtendedAttrs(), false);
      attrs.bg |= BgFlags.HAS_EXTENDED;
      assert.equal(!!attrs.hasExtendedAttrs(), true);
    });
    it('getUnderlineColor - P256', () => {
      const attrs = new AttributeData();
      // set a P256 color
      attrs.extended.underlineColor = Attributes.CM_P256 | 45;

      // should use FG color if BgFlags.HAS_EXTENDED is not set
      assert.equal(attrs.getUnderlineColor(), -1);

      // should use underlineColor if BgFlags.HAS_EXTENDED is set and underlineColor holds a value
      attrs.bg |= BgFlags.HAS_EXTENDED;
      assert.equal(attrs.getUnderlineColor(), 45);

      // should use FG color if underlineColor holds no value
      attrs.extended.underlineColor = 0;
      attrs.fg |= Attributes.CM_P256 | 123;
      assert.equal(attrs.getUnderlineColor(), 123);
    });
    it('getUnderlineColor - RGB', () => {
      const attrs = new AttributeData();
      // set a P256 color
      attrs.extended.underlineColor = Attributes.CM_RGB | (1 << 16) | (2 << 8) | 3;

      // should use FG color if BgFlags.HAS_EXTENDED is not set
      assert.equal(attrs.getUnderlineColor(), -1);

      // should use underlineColor if BgFlags.HAS_EXTENDED is set and underlineColor holds a value
      attrs.bg |= BgFlags.HAS_EXTENDED;
      assert.equal(attrs.getUnderlineColor(), (1 << 16) | (2 << 8) | 3);

      // should use FG color if underlineColor holds no value
      attrs.extended.underlineColor = 0;
      attrs.fg |= Attributes.CM_P256 | 123;
      assert.equal(attrs.getUnderlineColor(), 123);
    });
    it('getUnderlineColorMode / isUnderlineColorRGB / isUnderlineColorPalette / isUnderlineColorDefault', () => {
      const attrs = new AttributeData();

      // should always return color mode of fg
      for (const mode of [Attributes.CM_DEFAULT, Attributes.CM_P16, Attributes.CM_P256, Attributes.CM_RGB]) {
        attrs.extended.underlineColor = mode;
        assert.equal(attrs.getUnderlineColorMode(), attrs.getFgColorMode());
        assert.equal(attrs.isUnderlineColorDefault(), true);
      }
      attrs.fg = Attributes.CM_RGB;
      for (const mode of [Attributes.CM_DEFAULT, Attributes.CM_P16, Attributes.CM_P256, Attributes.CM_RGB]) {
        attrs.extended.underlineColor = mode;
        assert.equal(attrs.getUnderlineColorMode(), attrs.getFgColorMode());
        assert.equal(attrs.isUnderlineColorDefault(), false);
        assert.equal(attrs.isUnderlineColorRGB(), true);
      }

      // should return own mode
      attrs.bg |= BgFlags.HAS_EXTENDED;
      attrs.extended.underlineColor = Attributes.CM_DEFAULT;
      assert.equal(attrs.getUnderlineColorMode(), Attributes.CM_DEFAULT);
      attrs.extended.underlineColor = Attributes.CM_P16;
      assert.equal(attrs.getUnderlineColorMode(), Attributes.CM_P16);
      assert.equal(attrs.isUnderlineColorPalette(), true);
      attrs.extended.underlineColor = Attributes.CM_P256;
      assert.equal(attrs.getUnderlineColorMode(), Attributes.CM_P256);
      assert.equal(attrs.isUnderlineColorPalette(), true);
      attrs.extended.underlineColor = Attributes.CM_RGB;
      assert.equal(attrs.getUnderlineColorMode(), Attributes.CM_RGB);
      assert.equal(attrs.isUnderlineColorRGB(), true);
    });
    it('getUnderlineStyle', () => {
      const attrs = new AttributeData();

      // defaults to no underline style
      assert.equal(attrs.getUnderlineStyle(), UnderlineStyle.NONE);

      // should return NONE if UNDERLINE is not set
      attrs.extended.underlineStyle = UnderlineStyle.CURLY;
      assert.equal(attrs.getUnderlineStyle(), UnderlineStyle.NONE);

      // should return SINGLE style if UNDERLINE is set and HAS_EXTENDED is false
      attrs.fg |= FgFlags.UNDERLINE;
      assert.equal(attrs.getUnderlineStyle(), UnderlineStyle.SINGLE);

      // should return correct style if both is set
      attrs.bg |= BgFlags.HAS_EXTENDED;
      assert.equal(attrs.getUnderlineStyle(), UnderlineStyle.CURLY);

      // should return NONE if UNDERLINE is not set, but HAS_EXTENDED is true
      attrs.fg &= ~FgFlags.UNDERLINE;
      assert.equal(attrs.getUnderlineStyle(), UnderlineStyle.NONE);
    });
    it('getUnderlineVariantOffset', () => {
      const attrs = new AttributeData();

      // defaults to no offset
      assert.equal(attrs.getUnderlineVariantOffset(), 0);

      // should return 0 - 7
      for (let i = 0; i < 8; ++i) {
        attrs.extended.underlineVariantOffset = i;
        assert.equal(attrs.getUnderlineVariantOffset(), i);
      }
    });
  });
});

describe('CellData', () => {
  it('CharData <--> CellData equality', () => {
    const cell = new CellData();
    // ASCII
    cell.setFromCharData([123, 'a', 1, 'a'.charCodeAt(0)]);
    assert.deepEqual(cell.getAsCharData(), [123, 'a', 1, 'a'.charCodeAt(0)]);
    assert.equal(cell.isCombined(), 0);
    // combining
    cell.setFromCharData([123, 'e\u0301', 1, '\u0301'.charCodeAt(0)]);
    assert.deepEqual(cell.getAsCharData(), [123, 'e\u0301', 1, '\u0301'.charCodeAt(0)]);
    assert.equal(cell.isCombined(), Content.IS_COMBINED_MASK);
    // surrogate
    cell.setFromCharData([123, '𝄞', 1, 0x1D11E]);
    assert.deepEqual(cell.getAsCharData(), [123, '𝄞', 1, 0x1D11E]);
    assert.equal(cell.isCombined(), 0);
    // surrogate + combining
    cell.setFromCharData([123, '𓂀\u0301', 1, '𓂀\u0301'.charCodeAt(2)]);
    assert.deepEqual(cell.getAsCharData(), [123, '𓂀\u0301', 1, '𓂀\u0301'.charCodeAt(2)]);
    assert.equal(cell.isCombined(), Content.IS_COMBINED_MASK);
    // wide char
    cell.setFromCharData([123, '１', 2, '１'.charCodeAt(0)]);
    assert.deepEqual(cell.getAsCharData(), [123, '１', 2, '１'.charCodeAt(0)]);
    assert.equal(cell.isCombined(), 0);
  });
});

describe('BufferLine', function(): void {
  it('ctor', function(): void {
    let line: IBufferLine = BufferLine.make(0);
    assert.equal(line.length, 0);
    assert.equal(line.isWrapped, false);
    line = BufferLine.make(10);
    assert.equal(line.length, 10);
    assert.deepEqual(line.loadCell(0, new CellData()).getAsCharData(), [0, NULL_CELL_CHAR, NULL_CELL_WIDTH, NULL_CELL_CODE]);
    assert.equal(line.isWrapped, false);
    line = BufferLine.make(10, undefined, true);
    assert.equal(line.length, 10);
    assert.deepEqual(line.loadCell(0, new CellData()).getAsCharData(), [0, NULL_CELL_CHAR, NULL_CELL_WIDTH, NULL_CELL_CODE]);
    assert.equal(line.isWrapped, true);
    line = BufferLine.make(10, CellData.fromCharData([123, 'a', 1, 'a'.charCodeAt(0)]), true);
    assert.equal(line.length, 10);
    assert.deepEqual(line.loadCell(0, new CellData()).getAsCharData(), [123, 'a', 1, 'a'.charCodeAt(0)]);
    assert.equal(line.isWrapped, true);
  });
  it('insertCells', function(): void {
    const line = BufferLine.make(3);
    line.setCell(0, CellData.fromChar('a', 1, 1));
    line.setCell(1, CellData.fromChar('b', 1, 2));
    line.setCell(2, CellData.fromChar('c', 1, 3));
    line.insertCells(1, 3, CellData.fromChar('d', 1, 4));
    assert.deepEqual(lineToArray(line), [
      [1, 'a', 1, 'a'.charCodeAt(0)],
      [4, 'd', 1, 'd'.charCodeAt(0)],
      [4, 'd', 1, 'd'.charCodeAt(0)]
    ]);
    (line as any).xyz = 0;
  });
  it('deleteCells', function(): void {
    const line = BufferLine.make(5);
    line.setCell(0, CellData.fromChar('a', 1, 1));
    line.setCell(1, CellData.fromChar('b', 1, 2));
    line.setCell(2, CellData.fromChar('c', 1, 3));
    line.setCell(3, CellData.fromChar('d', 1, 4));
    line.setCell(4, CellData.fromChar('e', 1, 5));
    line.deleteCells(1, 2, CellData.fromChar('f', 1, 6));
    assert.deepEqual(lineToArray(line), [
      [1, 'a', 1, 'a'.charCodeAt(0)],
      [4, 'd', 1, 'd'.charCodeAt(0)],
      [5, 'e', 1, 'e'.charCodeAt(0)],
      [6, 'f', 1, 'f'.charCodeAt(0)],
      [6, 'f', 1, 'f'.charCodeAt(0)]
    ]);
  });
  it('replaceCells', function(): void {
    const line = BufferLine.make(5);
    line.setCell(0, CellData.fromChar('a', 1, 1));
    line.setCell(1, CellData.fromChar('b', 1, 2));
    line.setCell(2, CellData.fromChar('c', 1, 3));
    line.setCell(3, CellData.fromChar('d', 1, 4));
    line.setCell(4, CellData.fromChar('e', 1, 5));
    line.replaceCells(2, 4, CellData.fromChar('f', 1, 6));
    assert.deepEqual(lineToArray(line), [
      [1, 'a', 1, 'a'.charCodeAt(0)],
      [2, 'b', 1, 'b'.charCodeAt(0)],
      [6, 'f', 1, 'f'.charCodeAt(0)],
      [6, 'f', 1, 'f'.charCodeAt(0)],
      [5, 'e', 1, 'e'.charCodeAt(0)]
    ]);
  });
  it('fill', function(): void {
    const line = BufferLine.make(5);
    line.setCell(0, CellData.fromChar('a', 1, 1));
    line.setCell(1, CellData.fromChar('b', 1, 2));
    line.setCell(2, CellData.fromChar('c', 1, 3));
    line.setCell(3, CellData.fromChar('d', 1, 4));
    line.setCell(4, CellData.fromChar('e', 1, 5));
    line.fill(CellData.fromChar('z', 1, 123));
    assert.deepEqual(lineToArray(line), [
      [123, 'z', 1, 'z'.charCodeAt(0)],
      [123, 'z', 1, 'z'.charCodeAt(0)],
      [123, 'z', 1, 'z'.charCodeAt(0)],
      [123, 'z', 1, 'z'.charCodeAt(0)],
      [123, 'z', 1, 'z'.charCodeAt(0)]
    ]);
  });
  it('should support combining chars', function(): void {
    // CHAR_DATA_CODE_INDEX resembles current behavior in InputHandler.print
    // --> set code to the last charCodeAt value of the string
    // Note: needs to be fixed once the string pointer is in place
    const line = BufferLine.make(2, CellData.fromCharData([1, 'e\u0301', 1, '\u0301'.charCodeAt(0)]));
    assert.deepEqual(lineToArray(line), [[1, 'e\u0301', 1, '\u0301'.charCodeAt(0)], [1, 'e\u0301', 1, '\u0301'.charCodeAt(0)]]);
  });
  describe('resize', function(): void {
    it('enlarge(false)', function(): void {
      const line = BufferLine.make(5, CellData.fromChar('a', 1, 1), false);
      line.resize(10, CellData.fromChar('a', 1, 1));
      assert.deepEqual(lineToArray(line), (Array(10) as any).fill([1, 'a', 1, 'a'.charCodeAt(0)]));
    });
    it('enlarge(true)', function(): void {
      const line = BufferLine.make(5, CellData.fromChar('a', 1, 1), false);
      line.resize(10, CellData.fromChar('a', 1, 1));
      assert.deepEqual(lineToArray(line), (Array(10) as any).fill([1, 'a', 1, 'a'.charCodeAt(0)]));
    });
    it('shrink(true) - should apply new size', function(): void {
      const line = BufferLine.make(10, CellData.fromChar('a', 1, 1));
      line.resize(5, CellData.fromChar('a', 1, 1));
      assert.deepEqual(lineToArray(line), (Array(5) as any).fill([1, 'a', 1, 'a'.charCodeAt(0)]));
    });
    it('shrink to 0 length', function(): void {
      const line = BufferLine.make(10, CellData.fromCharData([1, 'a', 0, 'a'.charCodeAt(0)]), false);
      line.resize(0, CellData.fromCharData([1, 'a', 0, 'a'.charCodeAt(0)]));
      assert.deepEqual(lineToArray(line), (Array(0) as any).fill([1, 'a', 0, 'a'.charCodeAt(0)]));
    });
    it('should remove combining data on replaced cells after shrinking then enlarging', () => {
      const line = BufferLine.make(10, CellData.fromCharData([1, 'a', 0, 'a'.charCodeAt(0)]), false);
      line.set(2, [ 0, '😁', 1, '😁'.charCodeAt(0) ]);
      line.set(9, [ 0, '😁', 1, '😁'.charCodeAt(0) ]);
      assert.equal(line.translateToString(), 'aa😁aaaaaa😁');
      // assert.equal(Object.keys(line.combined).length, 2);
      line.resize(5, CellData.fromCharData([1, 'a', 0, 'a'.charCodeAt(0)]));
      assert.equal(line.translateToString(), 'aa😁aa');
      line.resize(10, CellData.fromCharData([1, 'a', 0, 'a'.charCodeAt(0)]));
      assert.equal(line.translateToString(), 'aa😁aaaaaaa');
      // assert.equal(Object.keys(line.combined).length, 1);
    });
  });
  describe('getTrimLength', function(): void {
    it('empty line', function(): void {
      const line = BufferLine.make(10, CellData.fromCharData([DEFAULT_ATTR, NULL_CELL_CHAR, NULL_CELL_WIDTH, NULL_CELL_CODE]), false);
      assert.equal(line.getTrimmedLength(), 0);
    });
    it('ASCII', function(): void {
      const line = BufferLine.make(10, CellData.fromCharData([DEFAULT_ATTR, NULL_CELL_CHAR, NULL_CELL_WIDTH, NULL_CELL_CODE]), false);
      line.setCell(0, CellData.fromCharData([1, 'a', 1, 'a'.charCodeAt(0)]));
      line.setCell(2, CellData.fromCharData([1, 'a', 1, 'a'.charCodeAt(0)]));
      assert.equal(line.getTrimmedLength(), 3);
    });
    it('surrogate', function(): void {
      const line = BufferLine.make(10, CellData.fromCharData([DEFAULT_ATTR, NULL_CELL_CHAR, NULL_CELL_WIDTH, NULL_CELL_CODE]), false);
      line.setCell(0, CellData.fromCharData([1, 'a', 1, 'a'.charCodeAt(0)]));
      line.setCell(2, CellData.fromCharData([1, '𝄞', 1, '𝄞'.charCodeAt(0)]));
      assert.equal(line.getTrimmedLength(), 3);
    });
    it('combining', function(): void {
      const line = BufferLine.make(10, CellData.fromCharData([DEFAULT_ATTR, NULL_CELL_CHAR, NULL_CELL_WIDTH, NULL_CELL_CODE]), false);
      line.setCell(0, CellData.fromCharData([1, 'a', 1, 'a'.charCodeAt(0)]));
      line.setCell(2, CellData.fromCharData([1, 'e\u0301', 1, '\u0301'.charCodeAt(0)]));
      assert.equal(line.getTrimmedLength(), 3);
    });
    it('fullwidth', function(): void {
      const line = BufferLine.make(10, CellData.fromCharData([DEFAULT_ATTR, NULL_CELL_CHAR, NULL_CELL_WIDTH, NULL_CELL_CODE]), false);
      line.setCell(0, CellData.fromCharData([1, 'a', 1, 'a'.charCodeAt(0)]));
      line.setCell(2, CellData.fromCharData([1, '１', 2, '１'.charCodeAt(0)]));
      line.setCell(3, CellData.fromCharData([0, '', 0, 0]));
      assert.equal(line.getTrimmedLength(), 4); // also counts null cell after fullwidth
    });
  });
  describe('translateToString with and w\'o trimming', function(): void {
    it('empty line', function(): void {
      const line = BufferLine.make(10, CellData.fromCharData([DEFAULT_ATTR, NULL_CELL_CHAR, NULL_CELL_WIDTH, NULL_CELL_CODE]), false);
      const columns: number[] = [];
      assert.equal(line.translateToString(false, undefined, undefined, columns), '          ');
      assert.deepEqual(columns, [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
      assert.equal(line.translateToString(true, undefined, undefined, columns), '');
      assert.deepEqual(columns, [0]);
    });
    it('ASCII', function(): void {
      const columns: number[] = [];
      const line = BufferLine.make(10, CellData.fromCharData([DEFAULT_ATTR, NULL_CELL_CHAR, NULL_CELL_WIDTH, NULL_CELL_CODE]), false);
      line.setCell(0, CellData.fromCharData([1, 'a', 1, 'a'.charCodeAt(0)]));
      line.setCell(2, CellData.fromCharData([1, 'a', 1, 'a'.charCodeAt(0)]));
      line.setCell(4, CellData.fromCharData([1, 'a', 1, 'a'.charCodeAt(0)]));
      line.setCell(5, CellData.fromCharData([1, 'a', 1, 'a'.charCodeAt(0)]));
      assert.equal(line.translateToString(false, undefined, undefined, columns), 'a a aa    ');
      assert.deepEqual(columns, [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
      assert.equal(line.translateToString(true, undefined, undefined, columns), 'a a aa');
      assert.deepEqual(columns, [0, 1, 2, 3, 4, 5, 6]);
      for (const trimRight of [true, false]) {
        assert.equal(line.translateToString(trimRight, 0, 5, columns), 'a a a');
        assert.deepEqual(columns, [0, 1, 2, 3, 4, 5]);
        assert.equal(line.translateToString(trimRight, 0, 4, columns), 'a a ');
        assert.deepEqual(columns, [0, 1, 2, 3, 4]);
        assert.equal(line.translateToString(trimRight, 0, 3, columns), 'a a');
        assert.deepEqual(columns, [0, 1, 2, 3]);
      }

    });
    it('surrogate', function(): void {
      const columns: number[] = [];
      const line = BufferLine.make(10, CellData.fromCharData([DEFAULT_ATTR, NULL_CELL_CHAR, NULL_CELL_WIDTH, NULL_CELL_CODE]), false);
      line.setCell(0, CellData.fromCharData([1, 'a', 1, 'a'.charCodeAt(0)]));
      line.setCell(2, CellData.fromCharData([1, '𝄞', 1, '𝄞'.charCodeAt(0)]));
      line.setCell(4, CellData.fromCharData([1, '𝄞', 1, '𝄞'.charCodeAt(0)]));
      line.setCell(5, CellData.fromCharData([1, '𝄞', 1, '𝄞'.charCodeAt(0)]));
      assert.equal(line.translateToString(false, undefined, undefined, columns), 'a 𝄞 𝄞𝄞    ');
      assert.deepEqual(columns, [0, 1, 2, 2, 3, 4, 4, 5, 5, 6, 7, 8, 9, 10]);
      assert.equal(line.translateToString(true, undefined, undefined, columns), 'a 𝄞 𝄞𝄞');
      assert.deepEqual(columns, [0, 1, 2, 2, 3, 4, 4, 5, 5, 6]);
      for (const trimRight of [true, false]) {
        assert.equal(line.translateToString(trimRight, 0, 5, columns), 'a 𝄞 𝄞');
        assert.deepEqual(columns, [0, 1, 2, 2, 3, 4, 4, 5]);
        assert.equal(line.translateToString(trimRight, 0, 4, columns), 'a 𝄞 ');
        assert.deepEqual(columns, [0, 1, 2, 2, 3, 4]);
        assert.equal(line.translateToString(trimRight, 0, 3, columns), 'a 𝄞');
        assert.deepEqual(columns, [0, 1, 2, 2, 3]);
      }
    });
    it('combining', function(): void {
      const columns: number[] = [];
      const line = BufferLine.make(10, CellData.fromCharData([DEFAULT_ATTR, NULL_CELL_CHAR, NULL_CELL_WIDTH, NULL_CELL_CODE]), false);
      line.setCell(0, CellData.fromCharData([1, 'a', 1, 'a'.charCodeAt(0)]));
      line.setCell(2, CellData.fromCharData([1, 'e\u0301', 1, '\u0301'.charCodeAt(0)]));
      line.setCell(4, CellData.fromCharData([1, 'e\u0301', 1, '\u0301'.charCodeAt(0)]));
      line.setCell(5, CellData.fromCharData([1, 'e\u0301', 1, '\u0301'.charCodeAt(0)]));
      assert.equal(line.translateToString(false, undefined, undefined, columns), 'a e\u0301 e\u0301e\u0301    ');
      assert.deepEqual(columns, [0, 1, 2, 2, 3, 4, 4, 5, 5, 6, 7, 8, 9, 10]);
      assert.equal(line.translateToString(true, undefined, undefined, columns), 'a e\u0301 e\u0301e\u0301');
      assert.deepEqual(columns, [0, 1, 2, 2, 3, 4, 4, 5, 5, 6]);
      for (const trimRight of [true, false]) {
        assert.equal(line.translateToString(trimRight, 0, 5, columns), 'a e\u0301 e\u0301');
        assert.deepEqual(columns, [0, 1, 2, 2, 3, 4, 4, 5]);
        assert.equal(line.translateToString(trimRight, 0, 4, columns), 'a e\u0301 ');
        assert.deepEqual(columns, [0, 1, 2, 2, 3, 4]);
        assert.equal(line.translateToString(trimRight, 0, 3, columns), 'a e\u0301');
        assert.deepEqual(columns, [0, 1, 2, 2, 3]);
      }
    });
    it('fullwidth', function(): void {
      const columns: number[] = [];
      const line = BufferLine.make(10, CellData.fromCharData([DEFAULT_ATTR, NULL_CELL_CHAR, NULL_CELL_WIDTH, NULL_CELL_CODE]), false);
      line.setCell(0, CellData.fromCharData([1, 'a', 1, 'a'.charCodeAt(0)]));
      line.setCell(2, CellData.fromCharData([1, '１', 2, '１'.charCodeAt(0)]));
      line.setCell(3, CellData.fromCharData([0, '', 0, 0]));
      line.setCell(5, CellData.fromCharData([1, '１', 2, '１'.charCodeAt(0)]));
      line.setCell(6, CellData.fromCharData([0, '', 0, 0]));
      line.setCell(7, CellData.fromCharData([1, '１', 2, '１'.charCodeAt(0)]));
      line.setCell(8, CellData.fromCharData([0, '', 0, 0]));
      assert.equal(line.translateToString(false, undefined, undefined, columns), 'a １ １１ ');
      assert.deepEqual(columns, [0, 1, 2, 4, 5, 7, 9, 10]);
      assert.equal(line.translateToString(true, undefined, undefined, columns), 'a １ １１');
      assert.deepEqual(columns, [0, 1, 2, 4, 5, 7, 9]);
      for (const trimRight of [true, false]) {
        assert.equal(line.translateToString(trimRight, 0, 7, columns), 'a １ １');
        assert.deepEqual(columns, [0, 1, 2, 4, 5, 7]);
        assert.equal(line.translateToString(trimRight, 0, 6, columns), 'a １ １');
        assert.deepEqual(columns, [0, 1, 2, 4, 5, 7]);
        assert.equal(line.translateToString(trimRight, 0, 5, columns), 'a １ ');
        assert.deepEqual(columns, [0, 1, 2, 4, 5]);
        assert.equal(line.translateToString(trimRight, 0, 4, columns), 'a １');
        assert.deepEqual(columns, [0, 1, 2, 4]);
        assert.equal(line.translateToString(trimRight, 0, 3, columns), 'a １');
        assert.deepEqual(columns, [0, 1, 2, 4]);
        assert.equal(line.translateToString(trimRight, 0, 2, columns), 'a ');
        assert.deepEqual(columns, [0, 1, 2]);
      }
    });
    it('space at end', function(): void {
      const columns: number[] = [];
      const line = BufferLine.make(10, CellData.fromCharData([DEFAULT_ATTR, NULL_CELL_CHAR, NULL_CELL_WIDTH, NULL_CELL_CODE]), false);
      line.setCell(0, CellData.fromCharData([1, 'a', 1, 'a'.charCodeAt(0)]));
      line.setCell(2, CellData.fromCharData([1, 'a', 1, 'a'.charCodeAt(0)]));
      line.setCell(4, CellData.fromCharData([1, 'a', 1, 'a'.charCodeAt(0)]));
      line.setCell(5, CellData.fromCharData([1, 'a', 1, 'a'.charCodeAt(0)]));
      line.setCell(6, CellData.fromCharData([1, ' ', 1, ' '.charCodeAt(0)]));
      assert.equal(line.translateToString(false, undefined, undefined, columns), 'a a aa    ');
      assert.deepEqual(columns, [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
      assert.equal(line.translateToString(true, undefined, undefined, columns), 'a a aa ');
      assert.deepEqual(columns, [0, 1, 2, 3, 4, 5, 6, 7]);
    });
    it('should always return some sane value', function(): void {
      const columns: number[] = [];
      // sanity check - broken line with invalid out of bound null width cells
      // this can atm happen with deleting/inserting chars in inputhandler by "breaking"
      // fullwidth pairs --> needs to be fixed after settling BufferLine impl
      const line = BufferLine.make(10, CellData.fromCharData([DEFAULT_ATTR, NULL_CELL_CHAR, 0, NULL_CELL_CODE]), false);
      assert.equal(line.translateToString(false, undefined, undefined, columns), '          ');
      assert.deepEqual(columns, [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
      assert.equal(line.translateToString(true, undefined, undefined, columns), '');
      assert.deepEqual(columns, [0]);
    });
    it('should work with endCol=0', () => {
      const columns: number[] = [];
      const line = BufferLine.make(10, CellData.fromCharData([DEFAULT_ATTR, NULL_CELL_CHAR, 0, NULL_CELL_CODE]), false);
      line.setCell(0, CellData.fromCharData([1, 'a', 1, 'a'.charCodeAt(0)]));
      assert.equal(line.translateToString(true, 0, 0, columns), '');
      assert.deepEqual(columns, [0]);
    });
  });
  describe('addCharToCell', () => {
    it('should set width to 1 for empty cell', () => {
      const line = BufferLine.make(3, CellData.fromCharData([DEFAULT_ATTR, NULL_CELL_CHAR, NULL_CELL_WIDTH, NULL_CELL_CODE]), false);
      line.addCodepointToCell(0, '\u0301'.charCodeAt(0), 0);
      const cell = line.loadCell(0, new CellData());
      // chars contains single combining char
      // width is set to 1
      assert.deepEqual(cell.getAsCharData(), [DEFAULT_ATTR, '\u0301', 1, 0x0301]);
      // do not account a single combining char as combined
      assert.equal(cell.isCombined(), 0);
    });
    it('should add char to combining string in cell', () => {
      const line = BufferLine.make(3, CellData.fromCharData([DEFAULT_ATTR, NULL_CELL_CHAR, NULL_CELL_WIDTH, NULL_CELL_CODE]), false);
      const cell = line.loadCell(0, new CellData());
      cell.setFromCharData([123, 'e\u0301', 1, 'e\u0301'.charCodeAt(1)]);
      line.setCell(0, cell);
      line.addCodepointToCell(0, '\u0301'.charCodeAt(0), 0);
      line.loadCell(0, cell);
      // chars contains 3 chars
      // width is set to 1
      assert.deepEqual(cell.getAsCharData(), [123, 'e\u0301\u0301', 1, 0x0301]);
      // do not account a single combining char as combined
      assert.equal(cell.isCombined(), Content.IS_COMBINED_MASK);
    });
    it('should create combining string on taken cell', () => {
      const line = BufferLine.make(3, CellData.fromCharData([DEFAULT_ATTR, NULL_CELL_CHAR, NULL_CELL_WIDTH, NULL_CELL_CODE]), false);
      const cell = line .loadCell(0, new CellData());
      cell.setFromCharData([123, 'e', 1, 'e'.charCodeAt(1)]);
      line.setCell(0, cell);
      line.addCodepointToCell(0, '\u0301'.charCodeAt(0), 0);
      line.loadCell(0, cell);
      // chars contains 2 chars
      // width is set to 1
      assert.deepEqual(cell.getAsCharData(), [123, 'e\u0301', 1, 0x0301]);
      // do not account a single combining char as combined
      assert.equal(cell.isCombined(), Content.IS_COMBINED_MASK);
    });
  });
  describe('correct fullwidth handling', () => {
    function populate(line: BufferLine): void {
      const cell = CellData.fromCharData([1, '￥', 2, '￥'.charCodeAt(0)]);
      for (let i = 0; i < line.length; i += 2) {
        line.setCell(i, cell);
      }
    }
    it('insert - wide char at pos', () => {
      const line = BufferLine.make(10, CellData.fromCharData([DEFAULT_ATTR, NULL_CELL_CHAR, 0, NULL_CELL_CODE]), false);
      populate(line);
      line.insertCells(9, 1, CellData.fromCharData([1, 'a', 1, 'a'.charCodeAt(0)]));
      assert.equal(line.translateToString(), '￥￥￥￥ a');
      line.insertCells(8, 1, CellData.fromCharData([1, 'a', 1, 'a'.charCodeAt(0)]));
      assert.equal(line.translateToString(), '￥￥￥￥a ');
      line.insertCells(1, 1, CellData.fromCharData([1, 'a', 1, 'a'.charCodeAt(0)]));
      assert.equal(line.translateToString(), ' a ￥￥￥a');
    });
    it('insert - wide char at end', () => {
      const line = BufferLine.make(10, CellData.fromCharData([DEFAULT_ATTR, NULL_CELL_CHAR, 0, NULL_CELL_CODE]), false);
      populate(line);
      line.insertCells(0, 3, CellData.fromCharData([1, 'a', 1, 'a'.charCodeAt(0)]));
      assert.equal(line.translateToString(), 'aaa￥￥￥ ');
      line.insertCells(4, 1, CellData.fromCharData([1, 'a', 1, 'a'.charCodeAt(0)]));
      assert.equal(line.translateToString(), 'aaa a ￥￥');
      line.insertCells(4, 1, CellData.fromCharData([1, 'a', 1, 'a'.charCodeAt(0)]));
      assert.equal(line.translateToString(), 'aaa aa ￥ ');
    });
    it('delete', () => {
      const line = BufferLine.make(10, CellData.fromCharData([DEFAULT_ATTR, NULL_CELL_CHAR, 0, NULL_CELL_CODE]), false);
      populate(line);
      line.deleteCells(0, 1, CellData.fromCharData([1, 'a', 1, 'a'.charCodeAt(0)]));
      assert.equal(line.translateToString(), ' ￥￥￥￥a');
      line.deleteCells(5, 2, CellData.fromCharData([1, 'a', 1, 'a'.charCodeAt(0)]));
      assert.equal(line.translateToString(), ' ￥￥￥aaa');
      line.deleteCells(0, 2, CellData.fromCharData([1, 'a', 1, 'a'.charCodeAt(0)]));
      assert.equal(line.translateToString(), ' ￥￥aaaaa');
    });
    it('replace - start at 0', () => {
      let line = BufferLine.make(10, CellData.fromCharData([DEFAULT_ATTR, NULL_CELL_CHAR, 0, NULL_CELL_CODE]), false);
      populate(line);
      line.replaceCells(0, 1, CellData.fromCharData([1, 'a', 1, 'a'.charCodeAt(0)]));
      assert.equal(line.translateToString(), 'a ￥￥￥￥');
      line = BufferLine.make(10, CellData.fromCharData([DEFAULT_ATTR, NULL_CELL_CHAR, 0, NULL_CELL_CODE]), false);
      populate(line);
      line.replaceCells(0, 2, CellData.fromCharData([1, 'a', 1, 'a'.charCodeAt(0)]));
      assert.equal(line.translateToString(), 'aa￥￥￥￥');
      line = BufferLine.make(10, CellData.fromCharData([DEFAULT_ATTR, NULL_CELL_CHAR, 0, NULL_CELL_CODE]), false);
      populate(line);
      line.replaceCells(0, 3, CellData.fromCharData([1, 'a', 1, 'a'.charCodeAt(0)]));
      assert.equal(line.translateToString(), 'aaa ￥￥￥');
      line = BufferLine.make(10, CellData.fromCharData([DEFAULT_ATTR, NULL_CELL_CHAR, 0, NULL_CELL_CODE]), false);
      populate(line);
      line.replaceCells(0, 8, CellData.fromCharData([1, 'a', 1, 'a'.charCodeAt(0)]));
      assert.equal(line.translateToString(), 'aaaaaaaa￥');
      line = BufferLine.make(10, CellData.fromCharData([DEFAULT_ATTR, NULL_CELL_CHAR, 0, NULL_CELL_CODE]), false);
      populate(line);
      line.replaceCells(0, 9, CellData.fromCharData([1, 'a', 1, 'a'.charCodeAt(0)]));
      assert.equal(line.translateToString(), 'aaaaaaaaa ');
      line = BufferLine.make(10, CellData.fromCharData([DEFAULT_ATTR, NULL_CELL_CHAR, 0, NULL_CELL_CODE]), false);
      populate(line);
      line.replaceCells(0, 10, CellData.fromCharData([1, 'a', 1, 'a'.charCodeAt(0)]));
      assert.equal(line.translateToString(), 'aaaaaaaaaa');
    });
    it('replace - start at 1', () => {
      let line = BufferLine.make(10, CellData.fromCharData([DEFAULT_ATTR, NULL_CELL_CHAR, 0, NULL_CELL_CODE]), false);
      populate(line);
      line.replaceCells(1, 2, CellData.fromCharData([1, 'a', 1, 'a'.charCodeAt(0)]));
      assert.equal(line.translateToString(), ' a￥￥￥￥');
      line = BufferLine.make(10, CellData.fromCharData([DEFAULT_ATTR, NULL_CELL_CHAR, 0, NULL_CELL_CODE]), false);
      populate(line);
      line.replaceCells(1, 3, CellData.fromCharData([1, 'a', 1, 'a'.charCodeAt(0)]));
      assert.equal(line.translateToString(), ' aa ￥￥￥');
      line = BufferLine.make(10, CellData.fromCharData([DEFAULT_ATTR, NULL_CELL_CHAR, 0, NULL_CELL_CODE]), false);
      populate(line);
      line.replaceCells(1, 4, CellData.fromCharData([1, 'a', 1, 'a'.charCodeAt(0)]));
      assert.equal(line.translateToString(), ' aaa￥￥￥');
      line = BufferLine.make(10, CellData.fromCharData([DEFAULT_ATTR, NULL_CELL_CHAR, 0, NULL_CELL_CODE]), false);
      populate(line);
      line.replaceCells(1, 8, CellData.fromCharData([1, 'a', 1, 'a'.charCodeAt(0)]));
      assert.equal(line.translateToString(), ' aaaaaaa￥');
      line = BufferLine.make(10, CellData.fromCharData([DEFAULT_ATTR, NULL_CELL_CHAR, 0, NULL_CELL_CODE]), false);
      populate(line);
      line.replaceCells(1, 9, CellData.fromCharData([1, 'a', 1, 'a'.charCodeAt(0)]));
      assert.equal(line.translateToString(), ' aaaaaaaa ');
      line = BufferLine.make(10, CellData.fromCharData([DEFAULT_ATTR, NULL_CELL_CHAR, 0, NULL_CELL_CODE]), false);
      populate(line);
      line.replaceCells(1, 10, CellData.fromCharData([1, 'a', 1, 'a'.charCodeAt(0)]));
      assert.equal(line.translateToString(), ' aaaaaaaaa');
    });
  });
  describe('extended attributes', () => {
    function extendedAttributes(line: BufferLine, index: number): IExtendedAttrs | undefined {
      const cell = new CellData();
      line.loadCell(index, cell);
      return cell.hasExtendedAttrs() !== 0 ? cell.extended : undefined;
    }
    it('setCells', function(): void {
      const line = BufferLine.make(5);
      const cell = CellData.fromChar('a', 1, 1);
      // no eAttrs
      line.setCell(0, cell);

      // some underline style
      cell.extended.underlineStyle = UnderlineStyle.CURLY;
      cell.bg |= BgFlags.HAS_EXTENDED;
      line.setCell(1, cell);

      // same eAttr, different codepoint
      cell.content = 65;  // 'A'
      line.setCell(2, cell);

      // different eAttr
      cell.extended = cell.extended.clone();
      cell.extended.underlineStyle = UnderlineStyle.DOTTED;
      line.setCell(3, cell);

      // no eAttrs again
      cell.bg &= ~BgFlags.HAS_EXTENDED;
      line.setCell(4, cell);

      assert.deepEqual(lineToArray(line), [
        [1, 'a', 1, 'a'.charCodeAt(0)],
        [1, 'a', 1, 'a'.charCodeAt(0)],
        [1, 'A', 1, 'A'.charCodeAt(0)],
        [1, 'A', 1, 'A'.charCodeAt(0)],
        [1, 'A', 1, 'A'.charCodeAt(0)]
      ]);
      assert.equal(extendedAttributes(line, 0), undefined);
      assert.equal(extendedAttributes(line, 1)?.underlineStyle, UnderlineStyle.CURLY);
      assert.equal(extendedAttributes(line, 2)?.underlineStyle, UnderlineStyle.CURLY);
      assert.equal(extendedAttributes(line, 3)?.underlineStyle, UnderlineStyle.DOTTED);
      assert.equal(extendedAttributes(line, 4)?.underlineStyle, undefined);
      // should be ref to the same object
      assert.equal(extendedAttributes(line, 1), extendedAttributes(line, 2));
      // should be a different obj
      assert.notEqual(extendedAttributes(line, 1), extendedAttributes(line, 3));
    });
    it('loadCell', () => {
      const line = BufferLine.make(5);
      const cell = CellData.fromCharData([1, 'a', 0, 'a'.charCodeAt(0)]);
      // no eAttrs
      line.setCell(0, cell);

      // some underline style
      cell.extended.underlineStyle = UnderlineStyle.CURLY;
      cell.bg |= BgFlags.HAS_EXTENDED;
      line.setCell(1, cell);

      // same eAttr, different codepoint
      cell.content = 65;  // 'A'
      line.setCell(2, cell);

      // different eAttr
      cell.extended = cell.extended.clone();
      cell.extended.underlineStyle = UnderlineStyle.DOTTED;
      line.setCell(3, cell);

      // no eAttrs again
      cell.bg &= ~BgFlags.HAS_EXTENDED;
      line.setCell(4, cell);

      const ext0 = extendedAttributes(line, 0);
      const ext1 = extendedAttributes(line, 1);
      const ext2 = extendedAttributes(line, 2);
      const ext3 = extendedAttributes(line, 3);
      const ext4 = extendedAttributes(line, 4);
      assert.equal(ext0?.underlineStyle, undefined); // UnderlineStyle.NONE
      assert.equal(ext1?.underlineStyle, UnderlineStyle.CURLY);
      assert.equal(ext2?.underlineStyle, UnderlineStyle.CURLY);
      assert.equal(ext3?.underlineStyle, UnderlineStyle.DOTTED);
      assert.equal(ext4?.underlineStyle, undefined); // UnderlineStyle.NONE
      assert.equal(ext1, ext2);
      assert.notEqual(ext2, ext3);
    });
    it('fill', () => {
      const line = BufferLine.make(3);
      const cell = CellData.fromCharData([1, 'a', 0, 'a'.charCodeAt(0)]);
      cell.extended.underlineStyle = UnderlineStyle.CURLY;
      cell.bg |= BgFlags.HAS_EXTENDED;
      line.fill(cell);
      assert.equal(extendedAttributes(line, 0)?.underlineStyle, UnderlineStyle.CURLY);
      assert.equal(extendedAttributes(line, 1)?.underlineStyle, UnderlineStyle.CURLY);
      assert.equal(extendedAttributes(line, 2)?.underlineStyle, UnderlineStyle.CURLY);
    });
    it('insertCells', () => {
      const line = BufferLine.make(5);
      const cell = CellData.fromCharData([1, 'a', 0, 'a'.charCodeAt(0)]);
      cell.extended.underlineStyle = UnderlineStyle.CURLY;
      cell.bg |= BgFlags.HAS_EXTENDED;
      line.insertCells(1, 3, cell);
      assert.equal(extendedAttributes(line, 1)?.underlineStyle, UnderlineStyle.CURLY);
      assert.equal(extendedAttributes(line, 2)?.underlineStyle, UnderlineStyle.CURLY);
      assert.equal(extendedAttributes(line, 3)?.underlineStyle, UnderlineStyle.CURLY);
      assert.equal(extendedAttributes(line, 4), undefined);
      cell.extended = cell.extended.clone();
      cell.extended.underlineStyle = UnderlineStyle.DOTTED;
      line.insertCells(2, 2, cell);
      assert.equal(extendedAttributes(line, 1)?.underlineStyle, UnderlineStyle.CURLY);
      assert.equal(extendedAttributes(line, 2)?.underlineStyle, UnderlineStyle.DOTTED);
      assert.equal(extendedAttributes(line, 3)?.underlineStyle, UnderlineStyle.DOTTED);
      assert.equal(extendedAttributes(line, 4)?.underlineStyle, UnderlineStyle.CURLY);
    });
    it('deleteCells', () => {
      const line = BufferLine.make(5);
      const fillCell = CellData.fromCharData([1, 'a', 0, 'a'.charCodeAt(0)]);
      fillCell.extended.underlineStyle = UnderlineStyle.CURLY;
      fillCell.bg |= BgFlags.HAS_EXTENDED;
      line.fill(fillCell);
      fillCell.extended = fillCell.extended.clone();
      fillCell.extended.underlineStyle = UnderlineStyle.DOUBLE;
      line.deleteCells(1, 3, fillCell);
      assert.equal(extendedAttributes(line, 0)?.underlineStyle, UnderlineStyle.CURLY);
      assert.equal(extendedAttributes(line, 1)?.underlineStyle, UnderlineStyle.CURLY);
      assert.equal(extendedAttributes(line, 2)?.underlineStyle, UnderlineStyle.DOUBLE);
      assert.equal(extendedAttributes(line, 3)?.underlineStyle, UnderlineStyle.DOUBLE);
      assert.equal(extendedAttributes(line, 4)?.underlineStyle, UnderlineStyle.DOUBLE);
    });
    it('replaceCells', () => {
      const line = BufferLine.make(5);
      const fillCell = CellData.fromCharData([1, 'a', 0, 'a'.charCodeAt(0)]);
      fillCell.extended.underlineStyle = UnderlineStyle.CURLY;
      fillCell.bg |= BgFlags.HAS_EXTENDED;
      line.fill(fillCell);
      fillCell.extended = fillCell.extended.clone();
      fillCell.extended.underlineStyle = UnderlineStyle.DOUBLE;
      line.replaceCells(1, 3, fillCell);
      assert.equal(extendedAttributes(line, 0)?.underlineStyle, UnderlineStyle.CURLY);
      assert.equal(extendedAttributes(line, 1)?.underlineStyle, UnderlineStyle.DOUBLE);
      assert.equal(extendedAttributes(line, 2)?.underlineStyle, UnderlineStyle.DOUBLE);
      assert.equal(extendedAttributes(line, 3)?.underlineStyle, UnderlineStyle.CURLY);
      assert.equal(extendedAttributes(line, 4)?.underlineStyle, UnderlineStyle.CURLY);
    });
  });
});
