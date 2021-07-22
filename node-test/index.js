import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const Terminal = require('../lib-headless/xterm.js').Terminal;

console.log('Creating xterm-core terminal...');
const terminal = new Terminal();
console.log('Writing to terminal...')
terminal.write('foo \x1b[1;31mbar\x1b[0m baz', () => {
  const bufferLine = terminal.buffer.normal.getLine(terminal.buffer.normal.cursorY);
  const contents = bufferLine.translateToString(true);
  console.log(`Contents of terminal active buffer are: ${contents}`); // foo bar baz
});
