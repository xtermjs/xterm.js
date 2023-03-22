## xterm-addon-attach

An addon for [xterm.js](https://github.com/xtermjs/xterm.js) that enables attaching to a web socket. This addon requires xterm.js v4+.

### Install

```bash
npm install --save xterm-addon-attach
```

### Usage

```ts
import { Terminal } from 'xterm';
import { AttachAddon } from 'xterm-addon-attach';

const terminal = new Terminal();
const attachAddon = new AttachAddon(webSocket);
terminal.loadAddon(attachAddon);
```

See the full [API](https://github.com/xtermjs/xterm.js/blob/master/addons/xterm-addon-attach/typings/xterm-addon-attach.d.ts) for more advanced usage.
