import { assert } from 'chai';
import { GhosttyWasmBuffer } from 'common/buffer/GhosttyWasmBuffer';
import { GhosttyBufferLine } from 'common/buffer/GhosttyBufferLine';
import { DEFAULT_ATTR_DATA } from 'common/buffer/BufferLine';
import { CellData } from 'common/buffer/CellData';

const WASM_PATH = 'vendor/ghostty-wasm/ghostty-vt.wasm';

describe('GhosttyBufferLine', () => {
  before(() => {
    (globalThis as any).XTERM_GHOSTTY_WASM_URL = WASM_PATH;
  });

  it('writes and reads simple cells', () => {
    const buffer = new GhosttyWasmBuffer(5, 2, 5);
    const line = new GhosttyBufferLine(buffer, 0);

    line.setCellFromCodepoint(0, 'A'.charCodeAt(0), 1, DEFAULT_ATTR_DATA);
    line.setCellFromCodepoint(1, 'B'.charCodeAt(0), 1, DEFAULT_ATTR_DATA);

    assert.equal(line.translateToString(true), 'AB');
    assert.equal(line.getCodePoint(0), 'A'.charCodeAt(0));
    assert.equal(line.getCodePoint(1), 'B'.charCodeAt(0));

    buffer.dispose();
  });

  it('supports insert and delete', () => {
    const buffer = new GhosttyWasmBuffer(5, 1, 5);
    const line = new GhosttyBufferLine(buffer, 0);
    const fill = new CellData();

    line.setCellFromCodepoint(0, 'A'.charCodeAt(0), 1, DEFAULT_ATTR_DATA);
    line.setCellFromCodepoint(1, 'B'.charCodeAt(0), 1, DEFAULT_ATTR_DATA);

    line.insertCells(1, 1, fill);
    assert.equal(line.translateToString(true), 'A B');

    line.deleteCells(1, 1, fill);
    assert.equal(line.translateToString(true), 'AB');

    buffer.dispose();
  });
});
