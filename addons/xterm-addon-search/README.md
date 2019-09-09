## xterm-addon-search

An addon for [xterm.js](https://github.com/xtermjs/xterm.js) that enables searching the buffer. This addon requires xterm.js v4+.

### Install

```bash
npm install --save xterm-addon-search
```

### Usage

```ts
import { Terminal } from 'xterm';
import { SearchAddon } from 'xterm-addon-search';

const terminal = new Terminal();
const searchAddon = new SearchAddon();
terminal.loadAddon(searchAddon);
searchAddon.findNext('foo');
```

See the full [API](https://github.com/xtermjs/xterm.js/blob/master/addons/xterm-addon-search/typings/xterm-addon-search.d.ts) for more advanced usage.
