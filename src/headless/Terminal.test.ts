/**
 * Copyright (c) 2016 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import { deepStrictEqual, throws } from 'assert';
import { Terminal } from 'headless/public/Terminal';

const INIT_COLS = 80;
const INIT_ROWS = 24;

describe('Headless Terminal', () => {
  let term: Terminal;
  const termOptions = {
    cols: INIT_COLS,
    rows: INIT_ROWS
  };

  beforeEach(() => {
    term = new Terminal(termOptions);
  });

  it('should throw when trying to change cols or rows', () => {
    throws(() => term.setOption('cols', 1000));
    throws(() => term.setOption('rows', 1000));
  });
});
