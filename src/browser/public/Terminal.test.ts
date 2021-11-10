/**
 * Copyright (c) 2016 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import { Terminal } from 'browser/public/Terminal';
import { assert } from 'chai';
import { ITerminalOptions } from 'common/Types';

const INIT_COLS = 80;
const INIT_ROWS = 24;

describe('Public Terminal', () => {
  let term: Terminal;
  const termOptions = {
    cols: INIT_COLS,
    rows: INIT_ROWS
  };

  describe('options', () => {
    beforeEach(async () => {
      term = new Terminal(termOptions);
    });
    it('get options', () => {
      const options: ITerminalOptions = term.options;
      assert.equal(options.cols, 80);
      assert.equal(options.rows, 24);
    });
    it('set options', async () => {
      const options: ITerminalOptions = term.options;
      assert.throws(() => options.cols = 40);
      assert.throws(() => options.rows = 20);
      term.options.scrollback = 1;
      assert.equal(term.options.scrollback, 1);
      term.options= {
        fontSize: 12,
        fontFamily: 'Arial'
      };
      assert.equal(term.options.fontSize, 12);
      assert.equal(term.options.fontFamily, 'Arial');
    });
  });
});
