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
    return this._data;
  }
}

describe('BufferLine', function(): void {
  it('ctor', function(): void {
    let line: IBufferLine = new TestBufferLine();
    chai.expect(line.length).equals(0);
    chai.expect(line.pop()).equals(undefined);
    chai.expect(line.isWrapped).equals(false);
    line = new TestBufferLine(10);
    chai.expect(line.length).equals(10);
    chai.expect(line.pop()).eql([0, NULL_CELL_CHAR, NULL_CELL_WIDTH, NULL_CELL_CODE]);
    chai.expect(line.isWrapped).equals(false);
    line = new TestBufferLine(10, null, true);
    chai.expect(line.length).equals(10);
    chai.expect(line.pop()).eql([0, NULL_CELL_CHAR, NULL_CELL_WIDTH, NULL_CELL_CODE]);
    chai.expect(line.isWrapped).equals(true);
    line = new TestBufferLine(10, [123, 'a', 456, 789], true);
    chai.expect(line.length).equals(10);
    chai.expect(line.pop()).eql([123, 'a', 456, 789]);
    chai.expect(line.isWrapped).equals(true);
  });
  it('splice', function(): void {
    const line = new TestBufferLine();
    const data: CharData[] = [
      [1, 'a', 0, 0],
      [2, 'b', 0, 0],
      [3, 'c', 0, 0]
    ];
    for (let i = 0; i < data.length; ++i) line.push(data[i]);
    chai.expect(line.length).equals(data.length);
    const removed1 = line.splice(1, 1, [4, 'd', 0, 0]);
    const removed2 = data.splice(1, 1, [4, 'd', 0, 0]);
    chai.expect(removed1).eql(removed2);
    chai.expect(line.toArray()).eql(data);
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
    const line = new TestBufferLine();
    const data: CharData[] = [
      [1, 'a', 0, 0],
      [2, 'b', 0, 0],
      [3, 'c', 0, 0]
    ];
    for (let i = 0; i < data.length; ++i) line.push(data[i]);
    line.insertCells(1, 3, [4, 'd', 0, 0]);
    chai.expect(line.toArray()).eql([[1, 'a', 0, 0], [4, 'd', 0, 0], [4, 'd', 0, 0]]);
  });
  it('deleteCells', function(): void {
    const line = new TestBufferLine();
    const data: CharData[] = [
      [1, 'a', 0, 0],
      [2, 'b', 0, 0],
      [3, 'c', 0, 0],
      [4, 'd', 0, 0],
      [5, 'e', 0, 0]
    ];
    for (let i = 0; i < data.length; ++i) line.push(data[i]);
    line.deleteCells(1, 2, [6, 'f', 0, 0]);
    chai.expect(line.toArray()).eql([[1, 'a', 0, 0], [4, 'd', 0, 0], [5, 'e', 0, 0], [6, 'f', 0, 0], [6, 'f', 0, 0]]);
  });
  it('replaceCells', function(): void {
    const line = new TestBufferLine();
    const data: CharData[] = [
      [1, 'a', 0, 0],
      [2, 'b', 0, 0],
      [3, 'c', 0, 0],
      [4, 'd', 0, 0],
      [5, 'e', 0, 0]
    ];
    for (let i = 0; i < data.length; ++i) line.push(data[i]);
    line.replaceCells(2, 4, [6, 'f', 0, 0]);
    chai.expect(line.toArray()).eql([[1, 'a', 0, 0], [2, 'b', 0, 0], [6, 'f', 0, 0], [6, 'f', 0, 0], [5, 'e', 0, 0]]);
  });
});
