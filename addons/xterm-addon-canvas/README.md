## xterm-addon-canvas

An addon for [xterm.js](https://github.com/xtermjs/xterm.js) that enables a canvas-based renderer using a 2d context to draw. This addon requires xterm.js v5+.


### Install

```bash
npm install --save xterm-addon-canvas
```

### Usage

```ts
import { Terminal } from 'xterm';
import { CanvasAddon } from 'xterm-addon-canvas';

const terminal = new Terminal();
terminal.open(element);
terminal.loadAddon(new CanvasAddon());
```

See the full [API](https://github.com/xtermjs/xterm.js/blob/master/addons/xterm-addon-canvas/typings/xterm-addon-canvas.d.ts) for more advanced usage.
