## @xterm/addon-webgpu

An addon for [xterm.js](https://github.com/xtermjs/xterm.js) that enables a WebGPU-based renderer. This addon requires xterm.js v4+.

```
npm install --save @xterm/addon-webgpu
```

```
import { WebgpuAddon } from '@xterm/addon-webgpu';

const terminal = new Terminal();
const addon = new WebgpuAddon();
terminal.loadAddon(addon);
```

See the full [API](https://github.com/xtermjs/xterm.js/blob/master/addons/addon-webgpu/typings/addon-webgpu.d.ts) for more advanced usage.

The browser may drop WebGPU devices for various reasons like OOM or after the system has been suspended. There is an API exposed that fires a context loss event so embedders can handle it however they wish. An easy, but suboptimal way, to handle this is by disposing of WebgpuAddon when the event fires:

```
const addon = new WebgpuAddon();
addon.onContextLoss(() => addon.dispose());
```
