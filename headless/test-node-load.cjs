/**
 * Smoke test: @xterm/headless loads and runs in Node.js (require).
 */
const { strictEqual } = require('node:assert');
const { Terminal } = require('./lib-headless/xterm-headless.js');

function writeSync(term, data) {
  return new Promise(resolve => term.write(data, resolve));
}

function lineEquals(term, index, text) {
  strictEqual(term.buffer.active.getLine(index).translateToString(true), text);
}

(async () => {
  const term = new Terminal({ cols: 80, rows: 24, allowProposedApi: true });
  strictEqual(term.cols, 80);
  strictEqual(term.rows, 24);

  await writeSync(term, 'hello from node');
  lineEquals(term, 0, 'hello from node');

  await writeSync(term, 'foo');
  await writeSync(term, 'bar');
  await writeSync(term, '文');
  lineEquals(term, 0, 'hello from nodefoobar文');

  term.resize(60, 15);
  strictEqual(term.cols, 60);
  strictEqual(term.rows, 15);

  term.dispose();
  strictEqual(term._core._store.isDisposed, true);

  console.log('headless package (CJS): load, write, buffer, resize, dispose OK');
})().catch(err => {
  console.error(err);
  process.exit(1);
});
