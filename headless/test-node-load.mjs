/**
 * Smoke test: @xterm/headless loads and runs in Node.js (ESM + CJS).
 */
import { createRequire } from 'node:module';
import { strictEqual } from 'node:assert';

const require = createRequire(import.meta.url);

function writeSync(term, data) {
  return new Promise(resolve => term.write(data, resolve));
}

function lineEquals(term, index, text) {
  strictEqual(term.buffer.active.getLine(index).translateToString(true), text);
}

const { Terminal: TerminalEsm } = await import('./lib-headless/xterm-headless.mjs');
const termEsm = new TerminalEsm({ cols: 80, rows: 24 });
await writeSync(termEsm, 'esm ok');
lineEquals(termEsm, 0, 'esm ok');
termEsm.dispose();

const { Terminal: TerminalCjs } = require('./lib-headless/xterm-headless.js');
const termCjs = new TerminalCjs({ cols: 40, rows: 10 });
await writeSync(termCjs, 'cjs ok');
lineEquals(termCjs, 0, 'cjs ok');
termCjs.dispose();

console.log('headless package: ESM and CJS load, write, and buffer read OK');
