/**
 * Copyright (c) 2018 The xterm.js authors. All rights reserved.
 * @license MIT
 */
import * as chai from 'chai';
import { BufferLine } from './BufferLine';
import { CharData, IBufferLine } from './Types';
import { NULL_CELL_CHAR, NULL_CELL_WIDTH, NULL_CELL_CODE, CHAR_DATA_ATTR_INDEX, CHAR_DATA_CHAR_INDEX, CHAR_DATA_WIDTH_INDEX, CHAR_DATA_CODE_INDEX } from './Buffer';


class TestBufferLine extends BufferLine {
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
  it('TerminalLine.blankLine', function(): void {
    const line = TestBufferLine.blankLine(5, 123);
    chai.expect(line.length).equals(5);
    chai.expect(line.isWrapped).equals(false);
    const ch = line.get(0);
    chai.expect(ch[CHAR_DATA_ATTR_INDEX]).equals(123);
    chai.expect(ch[CHAR_DATA_CHAR_INDEX]).equals(NULL_CELL_CHAR);
    chai.expect(ch[CHAR_DATA_WIDTH_INDEX]).equals(NULL_CELL_WIDTH);
    chai.expect(ch[CHAR_DATA_CODE_INDEX]).equals(NULL_CELL_CODE);
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
  it('makeCopyOf', function(): void {
    const line = new TestBufferLine(5);
    line.set(0, [1, 'a', 0, 'a'.charCodeAt(0)]);
    line.set(1, [2, 'b', 0, 'b'.charCodeAt(0)]);
    line.set(2, [3, 'c', 0, 'c'.charCodeAt(0)]);
    line.set(3, [4, 'd', 0, 'd'.charCodeAt(0)]);
    line.set(4, [5, 'e', 0, 'e'.charCodeAt(0)]);
    const line2 = new TestBufferLine(5, [1, 'a', 0, 'a'.charCodeAt(0)], true);
    line2.makeCopyOf(line);
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
    line2.makeCopyOf(line);
    chai.expect(line2.toArray()).eql(line.toArray());
    const line3 = line.clone();
    chai.expect(TestBufferLine.prototype.toArray.apply(line3)).eql(line.toArray());
  });
});
