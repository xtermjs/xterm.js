## xterm-addon-web-links

An addon for [xterm.js](https://github.com/xtermjs/xterm.js) that enables web links. This addon requires xterm.js v4+.

### Install

```bash
npm install --save xterm-addon-web-links
```

### Usage

```ts
import { Terminal } from 'xterm';
import { WebLinksAddon } from 'xterm-addon-web-links';

const terminal = new Terminal();
terminal.loadAddon(new WebLinksAddon());
```

See the full [API](https://github.com/xtermjs/xterm.js/blob/master/addons/xterm-addon-web-links/typings/xterm-addon-web-links.d.ts) for more advanced usage.
