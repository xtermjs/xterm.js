/**
 * Copyright (c) 2017 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import { TestTerminal } from './utils/TestUtils.test';
import { assert } from 'chai';
import { getStringCellWidth } from './CharWidth';
import { IBuffer } from './Types';
import { CHAR_DATA_WIDTH_INDEX, CHAR_DATA_CHAR_INDEX } from './Buffer';


describe('getStringCellWidth', function(): void {
  let terminal: TestTerminal;

  beforeEach(() => {
    terminal = new TestTerminal({rows: 5, cols: 30});
  });

  function sumWidths(buffer: IBuffer, start: number, end: number, sentinel: string): number {
    let result = 0;
    for (let i = start; i < end; ++i) {
      const line = buffer.lines.get(i);
      for (let j = 0; j < line.length; ++j) { // TODO: change to trimBorder with multiline
        const ch = line.get(j);
        result += ch[CHAR_DATA_WIDTH_INDEX];
        // return on sentinel
        if (ch[CHAR_DATA_CHAR_INDEX] === sentinel) {
          return result;
        }
      }
    }
    return result;
  }

  it('ASCII chars', function(): void {
    const input = 'This is just ASCII text.#';
    terminal.writeSync(input);
    const s = terminal.buffer.iterator(true).next().content;
    assert.equal(input, s);
    assert.equal(getStringCellWidth(s), sumWidths(terminal.buffer, 0, 1, '#'));
  });
  it('combining chars', function(): void {
    const input = 'e\u0301e\u0301e\u0301e\u0301e\u0301e\u0301e\u0301e\u0301e\u0301#';
    terminal.writeSync(input);
    const s = terminal.buffer.iterator(true).next().content;
    assert.equal(input, s);
    assert.equal(getStringCellWidth(s), sumWidths(terminal.buffer, 0, 1, '#'));
  });
  it('surrogate chars', function(): void {
    const input = '𝄞𝄞𝄞𝄞𝄞𝄞𝄞𝄞𝄞𝄞𝄞𝄞𝄞𝄞𝄞𝄞𝄞𝄞𝄞𝄞𝄞𝄞𝄞𝄞𝄞𝄞𝄞#';
    terminal.writeSync(input);
    const s = terminal.buffer.iterator(true).next().content;
    assert.equal(input, s);
    assert.equal(getStringCellWidth(s), sumWidths(terminal.buffer, 0, 1, '#'));
  });
  it('surrogate combining chars', function(): void {
    const input = '𓂀\u0301𓂀\u0301𓂀\u0301𓂀\u0301𓂀\u0301𓂀\u0301𓂀\u0301𓂀\u0301𓂀\u0301𓂀\u0301𓂀\u0301#';
    terminal.writeSync(input);
    const s = terminal.buffer.iterator(true).next().content;
    assert.equal(input, s);
    assert.equal(getStringCellWidth(s), sumWidths(terminal.buffer, 0, 1, '#'));
  });
  it('fullwidth chars', function(): void {
    const input = '１２３４５６７８９０#';
    terminal.writeSync(input);
    const s = terminal.buffer.iterator(true).next().content;
    assert.equal(input, s);
    assert.equal(getStringCellWidth(s), sumWidths(terminal.buffer, 0, 1, '#'));
  });
  it('fullwidth chars offset 1', function(): void {
    const input = 'a１２３４５６７８９０#';
    terminal.writeSync(input);
    const s = terminal.buffer.iterator(true).next().content;
    assert.equal(input, s);
    assert.equal(getStringCellWidth(s), sumWidths(terminal.buffer, 0, 1, '#'));
  });
  // TODO: multiline tests once #1685 is resolved
});
