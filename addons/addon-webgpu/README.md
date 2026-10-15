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

Terminal instances using the same navigator's WebGPU entry point share one adapter/device acquisition, including concurrent initialization. Shader modules, pipelines, layouts and samplers are cached per device and compatible configuration. Each renderer retains its own canvas context, buffers, bind groups and GPU atlas textures, so terminal contents and sizing remain independent.

Disposing one terminal releases only its reference and renderer resources. The device is destroyed when the last reference is released. Independent windows with different WebGPU entry points use separate devices.

WebGPU devices can be lost after suspension, driver resets, or GPU failures. Device loss restores xterm.js's default renderer and emits `onDeviceLoss` for every terminal sharing that device. The lost device is removed from the cache before notification. Create and load new addon instances to retry; they will share a newly acquired device. Uncaptured device errors are also reported to all attached renderers because the shared device cannot attribute them to a specific terminal.

```ts
addon.onDeviceLoss(event => {
  console.warn(`WebGPU device lost: ${event.reason}: ${event.message}`);
});
```
