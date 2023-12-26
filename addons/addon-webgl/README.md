## @xterm/addon-webgl

An addon for [xterm.js](https://github.com/xtermjs/xterm.js) that enables a WebGL2-based renderer. This addon requires xterm.js v4+.

### Install

```bash
npm install --save @xterm/addon-webgl
```

### Usage

```ts
import { Terminal } from '@xterm/xterm';
import { WebglAddon } from '@xterm/addon-webgl';

const terminal = new Terminal();
terminal.open(element);
terminal.loadAddon(new WebglAddon());
```

See the full [API](https://github.com/xtermjs/xterm.js/blob/master/addons/addon-webgl/typings/addon-webgl.d.ts) for more advanced usage.

### Handling Context Loss

The browser may drop WebGL contexts for various reasons like OOM or after the system has been suspended. There is an API exposed that fires the `webglcontextlost` event fired on the canvas so embedders can handle it however they wish. An easy, but suboptimal way, to handle this is by disposing of WebglAddon when the event fires:

```ts
const terminal = new Terminal();
const addon = new WebglAddon();
addon.onContextLoss(e => {
  addon.dispose();
});
terminal.loadAddon(addon);
```

Read more about handling WebGL context losses on the [Khronos wiki](https://www.khronos.org/webgl/wiki/HandlingContextLost).

### See also

- [@xterm/addon-canvas](https://www.npmjs.com/package/@xterm/addon-canvas) A renderer for xterm.js that uses a 2d canvas that can be used as a fallback when WebGL is not available
