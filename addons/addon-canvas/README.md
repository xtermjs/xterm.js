## @xterm/addon-canvas

An addon for [xterm.js](https://github.com/xtermjs/xterm.js) that enables a canvas-based renderer using a 2d context to draw. This addon requires xterm.js v5+.

The purpose of this addon is to be used as a fallback for the [webgl addon](https://www.npmjs.com/package/@xterm/addon-webgl) when better performance is desired over the default DOM renderer, but WebGL2 isn't supported or performant for some reason.

### Install

```bash
npm install --save @xterm/addon-canvas
```

### Usage

```ts
import { Terminal } from '@xterm/xterm';
import { CanvasAddon } from '@xterm/addon-canvas';

const terminal = new Terminal();
terminal.open(element);
terminal.loadAddon(new CanvasAddon());
```

See the full [API](https://github.com/xtermjs/xterm.js/blob/master/addons/addon-canvas/typings/addon-canvas.d.ts) for more advanced usage.

### See also

- [@xterm/addon-webgl](https://www.npmjs.com/package/@xterm/addon-webgl) A renderer for xterm.js that uses WebGL
