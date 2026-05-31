/**
 * Copyright (c) 2026 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import { assert } from 'chai';
import { StringToUtf32 } from '../input/TextDecoder';
import { Op } from './ScanTypes';
import { WasmEscapeScanner } from './WasmEscapeScanner';

describe('WasmEscapeScanner', () => {
  before(() => {
    WasmEscapeScanner.initSync();
  });

  beforeEach(() => {
    WasmEscapeScanner.reset();
  });

  it('scans hello with SGR sequences', () => {
    const input = 'hello\x1b[31mred\x1b[0m';
    const data = new Uint32Array(input.length);
    const len = new StringToUtf32().decode(input, data);
    const scan = WasmEscapeScanner.scan(data, len);

    assert.equal(scan.opCount, 4);
    assert.deepEqual(Array.from(scan.kinds), [Op.Print, Op.Csi, Op.Print, Op.Csi]);
    assert.deepEqual(Array.from(scan.starts), [0, 0, 10, 1]);
    // CSI/ESC: lengths hold final-byte index; print ops use run length
    assert.deepEqual(Array.from(scan.lengths), [5, 9, 3, 16]);
    assert.deepEqual(Array.from(scan.aux), [0, 'm'.charCodeAt(0), 0, 'm'.charCodeAt(0)]);
    assert.deepEqual(Array.from(scan.paramStarts), [0, 0, 0, 1]);
    assert.deepEqual(Array.from(scan.paramCounts), [0, 1, 0, 1]);
    assert.deepEqual(Array.from(scan.params), [31, 0]);
  });
});
