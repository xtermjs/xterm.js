/**
 * Copyright (c) 2018 The xterm.js authors. All rights reserved.
 * @license MIT
 */
import * as chai from 'chai';
import { BufferLine } from './BufferLine';
import { CharData, IBufferLine } from './Types';
import { NULL_CELL_CHAR, NULL_CELL_WIDTH, NULL_CELL_CODE, DEFAULT_ATTR } from './Buffer';


class TestBufferLine extends BufferLine {
  public get combined(): {[index: number]: string} {
    return this._combined;
  }

  public toArray(): CharData[] {
    const result = [];
    for (let i = 0; i < this.length; ++i) {
      result.push(this.get(i));
    }
    return result;
  }
}

describe('BufferLine', function(): void {
  it('ctor', function(): void {
    let line: IBufferLine = new TestBufferLine(0);
    chai.expect(line.length).equals(0);
    chai.expect(line.isWrapped).equals(false);
    line = new TestBufferLine(10);
    chai.expect(line.length).equals(10);
    chai.expect(line.get(0)).eql([0, NULL_CELL_CHAR, NULL_CELL_WIDTH, NULL_CELL_CODE]);
    chai.expect(line.isWrapped).equals(false);
    line = new TestBufferLine(10, null, true);
    chai.expect(line.length).equals(10);
    chai.expect(line.get(0)).eql([0, NULL_CELL_CHAR, NULL_CELL_WIDTH, NULL_CELL_CODE]);
    chai.expect(line.isWrapped).equals(true);
    line = new TestBufferLine(10, [123, 'a', 456, 'a'.charCodeAt(0)], true);
    chai.expect(line.length).equals(10);
    chai.expect(line.get(0)).eql([123, 'a', 456, 'a'.charCodeAt(0)]);
    chai.expect(line.isWrapped).equals(true);
  });
  it('insertCells', function(): void {
    const line = new TestBufferLine(3);
    line.set(0, [1, 'a', 0, 'a'.charCodeAt(0)]);
    line.set(1, [2, 'b', 0, 'b'.charCodeAt(0)]);
    line.set(2, [3, 'c', 0, 'c'.charCodeAt(0)]);
    line.insertCells(1, 3, [4, 'd', 0, 'd'.charCodeAt(0)]);
    chai.expect(line.toArray()).eql([
      [1, 'a', 0, 'a'.charCodeAt(0)],
      [4, 'd', 0, 'd'.charCodeAt(0)],
      [4, 'd', 0, 'd'.charCodeAt(0)]
    ]);
  });
  it('deleteCells', function(): void {
    const line = new TestBufferLine(5);
    line.set(0, [1, 'a', 0, 'a'.charCodeAt(0)]);
    line.set(1, [2, 'b', 0, 'b'.charCodeAt(0)]);
    line.set(2, [3, 'c', 0, 'c'.charCodeAt(0)]);
    line.set(3, [4, 'd', 0, 'd'.charCodeAt(0)]);
    line.set(4, [5, 'e', 0, 'e'.charCodeAt(0)]);
    line.deleteCells(1, 2, [6, 'f', 0, 'f'.charCodeAt(0)]);
    chai.expect(line.toArray()).eql([
      [1, 'a', 0, 'a'.charCodeAt(0)],
      [4, 'd', 0, 'd'.charCodeAt(0)],
      [5, 'e', 0, 'e'.charCodeAt(0)],
      [6, 'f', 0, 'f'.charCodeAt(0)],
      [6, 'f', 0, 'f'.charCodeAt(0)]
    ]);
  });
  it('replaceCells', function(): void {
    const line = new TestBufferLine(5);
    line.set(0, [1, 'a', 0, 'a'.charCodeAt(0)]);
    line.set(1, [2, 'b', 0, 'b'.charCodeAt(0)]);
    line.set(2, [3, 'c', 0, 'c'.charCodeAt(0)]);
    line.set(3, [4, 'd', 0, 'd'.charCodeAt(0)]);
    line.set(4, [5, 'e', 0, 'e'.charCodeAt(0)]);
    line.replaceCells(2, 4, [6, 'f', 0, 'f'.charCodeAt(0)]);
    chai.expect(line.toArray()).eql([
      [1, 'a', 0, 'a'.charCodeAt(0)],
      [2, 'b', 0, 'b'.charCodeAt(0)],
      [6, 'f', 0, 'f'.charCodeAt(0)],
      [6, 'f', 0, 'f'.charCodeAt(0)],
      [5, 'e', 0, 'e'.charCodeAt(0)]
    ]);
  });
  it('fill', function(): void {
    const line = new TestBufferLine(5);
    line.set(0, [1, 'a', 0, 'a'.charCodeAt(0)]);
    line.set(1, [2, 'b', 0, 'b'.charCodeAt(0)]);
    line.set(2, [3, 'c', 0, 'c'.charCodeAt(0)]);
    line.set(3, [4, 'd', 0, 'd'.charCodeAt(0)]);
    line.set(4, [5, 'e', 0, 'e'.charCodeAt(0)]);
    line.fill([123, 'z', 0, 'z'.charCodeAt(0)]);
    chai.expect(line.toArray()).eql([
      [123, 'z', 0, 'z'.charCodeAt(0)],
      [123, 'z', 0, 'z'.charCodeAt(0)],
      [123, 'z', 0, 'z'.charCodeAt(0)],
      [123, 'z', 0, 'z'.charCodeAt(0)],
      [123, 'z', 0, 'z'.charCodeAt(0)]
    ]);
  });
  it('clone', function(): void {
    const line = new TestBufferLine(5, null, true);
    line.set(0, [1, 'a', 0, 'a'.charCodeAt(0)]);
    line.set(1, [2, 'b', 0, 'b'.charCodeAt(0)]);
    line.set(2, [3, 'c', 0, 'c'.charCodeAt(0)]);
    line.set(3, [4, 'd', 0, 'd'.charCodeAt(0)]);
    line.set(4, [5, 'e', 0, 'e'.charCodeAt(0)]);
    const line2 = line.clone();
    chai.expect(TestBufferLine.prototype.toArray.apply(line2)).eql(line.toArray());
    chai.expect(line2.length).equals(line.length);
    chai.expect(line2.isWrapped).equals(line.isWrapped);
  });
  it('copyFrom', function(): void {
    const line = new TestBufferLine(5);
    line.set(0, [1, 'a', 0, 'a'.charCodeAt(0)]);
    line.set(1, [2, 'b', 0, 'b'.charCodeAt(0)]);
    line.set(2, [3, 'c', 0, 'c'.charCodeAt(0)]);
    line.set(3, [4, 'd', 0, 'd'.charCodeAt(0)]);
    line.set(4, [5, 'e', 0, 'e'.charCodeAt(0)]);
    const line2 = new TestBufferLine(5, [1, 'a', 0, 'a'.charCodeAt(0)], true);
    line2.copyFrom(line);
    chai.expect(line2.toArray()).eql(line.toArray());
    chai.expect(line2.length).equals(line.length);
    chai.expect(line2.isWrapped).equals(line.isWrapped);
  });
  it('should support combining chars', function(): void {
    // CHAR_DATA_CODE_INDEX resembles current behavior in InputHandler.print
    // --> set code to the last charCodeAt value of the string
    // Note: needs to be fixed once the string pointer is in place
    const line = new TestBufferLine(2, [1, 'e\u0301', 0, '\u0301'.charCodeAt(0)]);
    chai.expect(line.toArray()).eql([[1, 'e\u0301', 0, '\u0301'.charCodeAt(0)], [1, 'e\u0301', 0, '\u0301'.charCodeAt(0)]]);
    const line2 = new TestBufferLine(5, [1, 'a', 0, '\u0301'.charCodeAt(0)], true);
    line2.copyFrom(line);
    chai.expect(line2.toArray()).eql(line.toArray());
    const line3 = line.clone();
    chai.expect(TestBufferLine.prototype.toArray.apply(line3)).eql(line.toArray());
  });
  describe('resize', function(): void {
    it('enlarge(false)', function(): void {
      const line = new TestBufferLine(5, [1, 'a', 0, 'a'.charCodeAt(0)], false);
      line.resize(10, [1, 'a', 0, 'a'.charCodeAt(0)]);
      chai.expect(line.toArray()).eql(Array(10).fill([1, 'a', 0, 'a'.charCodeAt(0)]));
    });
    it('enlarge(true)', function(): void {
      const line = new TestBufferLine(5, [1, 'a', 0, 'a'.charCodeAt(0)], false);
      line.resize(10, [1, 'a', 0, 'a'.charCodeAt(0)]);
      chai.expect(line.toArray()).eql(Array(10).fill([1, 'a', 0, 'a'.charCodeAt(0)]));
    });
    it('shrink(true) - should apply new size', function(): void {
      const line = new TestBufferLine(10, [1, 'a', 0, 'a'.charCodeAt(0)], false);
      line.resize(5, [1, 'a', 0, 'a'.charCodeAt(0)]);
      chai.expect(line.toArray()).eql(Array(5).fill([1, 'a', 0, 'a'.charCodeAt(0)]));
    });
    it('shrink to 0 length', function(): void {
      const line = new TestBufferLine(10, [1, 'a', 0, 'a'.charCodeAt(0)], false);
      line.resize(0, [1, 'a', 0, 'a'.charCodeAt(0)]);
      chai.expect(line.toArray()).eql(Array(0).fill([1, 'a', 0, 'a'.charCodeAt(0)]));
    });
    it('should remove combining data on replaced cells after shrinking then enlarging', () => {
      const line = new TestBufferLine(10, [1, 'a', 0, 'a'.charCodeAt(0)], false);
      line.set(2, [ null, '😁', 1, '😁'.charCodeAt(0) ]);
      line.set(9, [ null, '😁', 1, '😁'.charCodeAt(0) ]);
      chai.expect(line.translateToString()).eql('aa😁aaaaaa😁');
      chai.expect(Object.keys(line.combined).length).eql(2);
      line.resize(5, [1, 'a', 0, 'a'.charCodeAt(0)]);
      chai.expect(line.translateToString()).eql('aa😁aa');
      line.resize(10, [1, 'a', 0, 'a'.charCodeAt(0)]);
      chai.expect(line.translateToString()).eql('aa😁aaaaaaa');
      chai.expect(Object.keys(line.combined).length).eql(1);
    });
  });
  describe('getTrimLength', function(): void {
    it('empty line', function(): void {
      const line = new TestBufferLine(10, [DEFAULT_ATTR, NULL_CELL_CHAR, NULL_CELL_WIDTH, NULL_CELL_CODE], false);
      chai.expect(line.getTrimmedLength()).equal(0);
    });
    it('ASCII', function(): void {
      const line = new TestBufferLine(10, [DEFAULT_ATTR, NULL_CELL_CHAR, NULL_CELL_WIDTH, NULL_CELL_CODE], false);
      line.set(0, [1, 'a', 1, 'a'.charCodeAt(0)]);
      line.set(2, [1, 'a', 1, 'a'.charCodeAt(0)]);
      chai.expect(line.getTrimmedLength()).equal(3);
    });
    it('surrogate', function(): void {
      const line = new TestBufferLine(10, [DEFAULT_ATTR, NULL_CELL_CHAR, NULL_CELL_WIDTH, NULL_CELL_CODE], false);
      line.set(0, [1, 'a', 1, 'a'.charCodeAt(0)]);
      line.set(2, [1, '𝄞', 1, '𝄞'.charCodeAt(0)]);
      chai.expect(line.getTrimmedLength()).equal(3);
    });
    it('combining', function(): void {
      const line = new TestBufferLine(10, [DEFAULT_ATTR, NULL_CELL_CHAR, NULL_CELL_WIDTH, NULL_CELL_CODE], false);
      line.set(0, [1, 'a', 1, 'a'.charCodeAt(0)]);
      line.set(2, [1, 'e\u0301', 1, '\u0301'.charCodeAt(0)]);
      chai.expect(line.getTrimmedLength()).equal(3);
    });
    it('fullwidth', function(): void {
      const line = new TestBufferLine(10, [DEFAULT_ATTR, NULL_CELL_CHAR, NULL_CELL_WIDTH, NULL_CELL_CODE], false);
      line.set(0, [1, 'a', 1, 'a'.charCodeAt(0)]);
      line.set(2, [1, '１', 2, '１'.charCodeAt(0)]);
      line.set(3, [0, '', 0, undefined]);
      chai.expect(line.getTrimmedLength()).equal(4); // also counts null cell after fullwidth
    });
  });
  describe('translateToString with and w\'o trimming', function(): void {
    it('empty line', function(): void {
      const line = new TestBufferLine(10, [DEFAULT_ATTR, NULL_CELL_CHAR, NULL_CELL_WIDTH, NULL_CELL_CODE], false);
      chai.expect(line.translateToString(false)).equal('          ');
      chai.expect(line.translateToString(true)).equal('');
    });
    it('ASCII', function(): void {
      const line = new TestBufferLine(10, [DEFAULT_ATTR, NULL_CELL_CHAR, NULL_CELL_WIDTH, NULL_CELL_CODE], false);
      line.set(0, [1, 'a', 1, 'a'.charCodeAt(0)]);
      line.set(2, [1, 'a', 1, 'a'.charCodeAt(0)]);
      line.set(4, [1, 'a', 1, 'a'.charCodeAt(0)]);
      line.set(5, [1, 'a', 1, 'a'.charCodeAt(0)]);
      chai.expect(line.translateToString(false)).equal('a a aa    ');
      chai.expect(line.translateToString(true)).equal('a a aa');
      chai.expect(line.translateToString(false, 0, 5)).equal('a a a');
      chai.expect(line.translateToString(false, 0, 4)).equal('a a ');
      chai.expect(line.translateToString(false, 0, 3)).equal('a a');
      chai.expect(line.translateToString(true, 0, 5)).equal('a a a');
      chai.expect(line.translateToString(true, 0, 4)).equal('a a ');
      chai.expect(line.translateToString(true, 0, 3)).equal('a a');

    });
    it('surrogate', function(): void {
      const line = new TestBufferLine(10, [DEFAULT_ATTR, NULL_CELL_CHAR, NULL_CELL_WIDTH, NULL_CELL_CODE], false);
      line.set(0, [1, 'a', 1, 'a'.charCodeAt(0)]);
      line.set(2, [1, '𝄞', 1, '𝄞'.charCodeAt(0)]);
      line.set(4, [1, '𝄞', 1, '𝄞'.charCodeAt(0)]);
      line.set(5, [1, '𝄞', 1, '𝄞'.charCodeAt(0)]);
      chai.expect(line.translateToString(false)).equal('a 𝄞 𝄞𝄞    ');
      chai.expect(line.translateToString(true)).equal('a 𝄞 𝄞𝄞');
      chai.expect(line.translateToString(false, 0, 5)).equal('a 𝄞 𝄞');
      chai.expect(line.translateToString(false, 0, 4)).equal('a 𝄞 ');
      chai.expect(line.translateToString(false, 0, 3)).equal('a 𝄞');
      chai.expect(line.translateToString(true, 0, 5)).equal('a 𝄞 𝄞');
      chai.expect(line.translateToString(true, 0, 4)).equal('a 𝄞 ');
      chai.expect(line.translateToString(true, 0, 3)).equal('a 𝄞');
    });
    it('combining', function(): void {
      const line = new TestBufferLine(10, [DEFAULT_ATTR, NULL_CELL_CHAR, NULL_CELL_WIDTH, NULL_CELL_CODE], false);
      line.set(0, [1, 'a', 1, 'a'.charCodeAt(0)]);
      line.set(2, [1, 'e\u0301', 1, '\u0301'.charCodeAt(0)]);
      line.set(4, [1, 'e\u0301', 1, '\u0301'.charCodeAt(0)]);
      line.set(5, [1, 'e\u0301', 1, '\u0301'.charCodeAt(0)]);
      chai.expect(line.translateToString(false)).equal('a e\u0301 e\u0301e\u0301    ');
      chai.expect(line.translateToString(true)).equal('a e\u0301 e\u0301e\u0301');
      chai.expect(line.translateToString(false, 0, 5)).equal('a e\u0301 e\u0301');
      chai.expect(line.translateToString(false, 0, 4)).equal('a e\u0301 ');
      chai.expect(line.translateToString(false, 0, 3)).equal('a e\u0301');
      chai.expect(line.translateToString(true, 0, 5)).equal('a e\u0301 e\u0301');
      chai.expect(line.translateToString(true, 0, 4)).equal('a e\u0301 ');
      chai.expect(line.translateToString(true, 0, 3)).equal('a e\u0301');
    });
    it('fullwidth', function(): void {
      const line = new TestBufferLine(10, [DEFAULT_ATTR, NULL_CELL_CHAR, NULL_CELL_WIDTH, NULL_CELL_CODE], false);
      line.set(0, [1, 'a', 1, 'a'.charCodeAt(0)]);
      line.set(2, [1, '１', 2, '１'.charCodeAt(0)]);
      line.set(3, [0, '', 0, undefined]);
      line.set(5, [1, '１', 2, '１'.charCodeAt(0)]);
      line.set(6, [0, '', 0, undefined]);
      line.set(7, [1, '１', 2, '１'.charCodeAt(0)]);
      line.set(8, [0, '', 0, undefined]);
      chai.expect(line.translateToString(false)).equal('a １ １１ ');
      chai.expect(line.translateToString(true)).equal('a １ １１');
      chai.expect(line.translateToString(false, 0, 7)).equal('a １ １');
      chai.expect(line.translateToString(false, 0, 6)).equal('a １ １');
      chai.expect(line.translateToString(false, 0, 5)).equal('a １ ');
      chai.expect(line.translateToString(false, 0, 4)).equal('a １');
      chai.expect(line.translateToString(false, 0, 3)).equal('a １');
      chai.expect(line.translateToString(false, 0, 2)).equal('a ');
      chai.expect(line.translateToString(true, 0, 7)).equal('a １ １');
      chai.expect(line.translateToString(true, 0, 6)).equal('a １ １');
      chai.expect(line.translateToString(true, 0, 5)).equal('a １ ');
      chai.expect(line.translateToString(true, 0, 4)).equal('a １');
      chai.expect(line.translateToString(true, 0, 3)).equal('a １');
      chai.expect(line.translateToString(true, 0, 2)).equal('a ');
    });
    it('space at end', function(): void {
      const line = new TestBufferLine(10, [DEFAULT_ATTR, NULL_CELL_CHAR, NULL_CELL_WIDTH, NULL_CELL_CODE], false);
      line.set(0, [1, 'a', 1, 'a'.charCodeAt(0)]);
      line.set(2, [1, 'a', 1, 'a'.charCodeAt(0)]);
      line.set(4, [1, 'a', 1, 'a'.charCodeAt(0)]);
      line.set(5, [1, 'a', 1, 'a'.charCodeAt(0)]);
      line.set(6, [1, ' ', 1, ' '.charCodeAt(0)]);
      chai.expect(line.translateToString(false)).equal('a a aa    ');
      chai.expect(line.translateToString(true)).equal('a a aa ');
    });
    it('should always return some sane value', function(): void {
      // sanity check - broken line with invalid out of bound null width cells
      // this can atm happen with deleting/inserting chars in inputhandler by "breaking"
      // fullwidth pairs --> needs to be fixed after settling BufferLine impl
      const line = new TestBufferLine(10, [DEFAULT_ATTR, NULL_CELL_CHAR, 0, NULL_CELL_CODE], false);
      chai.expect(line.translateToString(false)).equal('          ');
      chai.expect(line.translateToString(true)).equal('');
    });
    it('should work with endCol=0', () => {
      const line = new TestBufferLine(10, [DEFAULT_ATTR, NULL_CELL_CHAR, 0, NULL_CELL_CODE], false);
      line.set(0, [1, 'a', 1, 'a'.charCodeAt(0)]);
      chai.expect(line.translateToString(true, 0, 0)).equal('');
    });
  });
});
