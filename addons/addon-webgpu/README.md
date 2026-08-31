## @xterm/addon-webgpu

An addon for [xterm.js](https://github.com/xtermjs/xterm.js) that enables a WebGPU-based renderer.

WebGPU is available only in a [secure context](https://developer.mozilla.org/docs/Web/API/Navigator/gpu) and is not supported by every browser. The terminal keeps its existing renderer until WebGPU initialization succeeds.

### Install

```bash
npm install --save @xterm/addon-webgpu
```

### Usage

```ts
import { Terminal } from '@xterm/xterm';
import { WebgpuAddon } from '@xterm/addon-webgpu';

const terminal = new Terminal();
terminal.open(element);

const addon = new WebgpuAddon();
addon.onRendererError(error => console.error(error));
terminal.loadAddon(addon);
await addon.ready;
```

See the full [API](https://github.com/xtermjs/xterm.js/blob/master/addons/addon-webgpu/typings/addon-webgpu.d.ts) for more advanced usage.

### Handling Device Loss

WebGPU devices can be lost after suspension, driver resets, or GPU failures. The addon restores xterm.js's default renderer and emits `onDeviceLoss`. Create and load a new addon instance to retry.

```ts
addon.onDeviceLoss(event => {
  console.warn(`WebGPU device lost: ${event.reason}: ${event.message}`);
});
```
