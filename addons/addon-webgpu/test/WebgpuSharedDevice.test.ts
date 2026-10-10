/**
 * Copyright (c) 2026 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import { expect, test } from '@playwright/test';
import { createTestContext, ITestContext, openTerminal } from '../../../test/playwright/TestUtils';

let ctx: ITestContext;

test.beforeEach(async ({ browser }) => {
  ctx = await createTestContext(browser);
  await openTerminal(ctx);
});

test.afterEach(async () => await ctx.page.close());

test('shares one device and pipeline set across twenty independent terminal canvases', async () => {
  const result = await ctx.page.evaluate(async () => {
    let adapterRequests = 0;
    let deviceRequests = 0;
    let shaderModules = 0;
    let pipelines = 0;
    const gpu = navigator.gpu!;
    const requestAdapter = gpu.requestAdapter.bind(gpu);
    Object.defineProperty(gpu, 'requestAdapter', { configurable: true, value: async () => {
      adapterRequests++;
      const adapter = (await requestAdapter())!;
      const requestDevice = adapter.requestDevice.bind(adapter);
      Object.defineProperty(adapter, 'requestDevice', { configurable: true, value: async () => {
        deviceRequests++;
        const device = await requestDevice();
        const createShaderModule = device.createShaderModule.bind(device);
        const createRenderPipeline = device.createRenderPipeline.bind(device);
        Object.defineProperty(device, 'createShaderModule', { value: (descriptor: GPUShaderModuleDescriptor) => {
          shaderModules++;
          return createShaderModule(descriptor);
        } });
        Object.defineProperty(device, 'createRenderPipeline', { value: (descriptor: GPURenderPipelineDescriptor) => {
          pipelines++;
          return createRenderPipeline(descriptor);
        } });
        return device;
      } });
      return adapter;
    } });
    const terminals = Array.from({ length: 20 }, (_, i) => {
      const host = document.createElement('div');
      document.body.appendChild(host);
      const terminal = new window.Terminal({ cols: 10 + i, rows: 3, allowProposedApi: true });
      terminal.open(host);
      const addon = new window.WebgpuAddon();
      terminal.loadAddon(addon);
      return { terminal, addon };
    });
    await Promise.all(terminals.map(t => t.addon.ready));
    Object.defineProperty(gpu, 'requestAdapter', { configurable: true, value: requestAdapter });
    const renderers = terminals.map(t => (t.addon as any)._renderer);
    const device: GPUDevice = renderers[0]._device;
    device.pushErrorScope('validation');
    await Promise.all(terminals.map(({ terminal }, i) => new Promise<void>(resolve => terminal.write(`pane ${i}`, resolve))));
    renderers.forEach(renderer => renderer.renderRows(0, 2));
    await device.queue.onSubmittedWorkDone();
    const unique = (select: (renderer: any) => unknown): number => new Set(renderers.map(select)).size;
    const output = {
      adapterRequests, deviceRequests, shaderModules, pipelines,
      devices: unique(r => r._device),
      contexts: unique(r => r._context),
      cellBuffers: unique(r => r._glyphRenderer.value._cellBuffer),
      uniformBuffers: unique(r => r._glyphRenderer.value._uniformBuffer),
      atlasTextures: unique(r => r._glyphRenderer.value._atlasTextures[0].texture),
      validationError: (await device.popErrorScope())?.message,
      contents: terminals.map(({ terminal }) => terminal.buffer.active.getLine(0)!.translateToString(true))
    };
    terminals.forEach(({ terminal }) => terminal.dispose());
    const loss = await device.lost;
    return { ...output, finalLossReason: loss.reason };
  });
  expect(result.adapterRequests).toBe(1);
  expect(result.deviceRequests).toBe(1);
  expect(result.shaderModules).toBe(2);
  expect(result.pipelines).toBe(3);
  expect(result.devices).toBe(1);
  expect(result.contexts).toBe(20);
  expect(result.cellBuffers).toBe(20);
  expect(result.uniformBuffers).toBe(20);
  expect(result.atlasTextures).toBe(20);
  expect(result.validationError).toBeUndefined();
  expect(result.contents).toEqual(Array.from({ length: 20 }, (_, i) => `pane ${i}`));
  expect(result.finalLossReason).toBe('destroyed');
});

test('disposing one renderer leaves another drawing, and a later terminal reuses its device', async () => {
  const result = await ctx.page.evaluate(async () => {
    const create = async () => {
      const terminal = new window.Terminal({ cols: 20, rows: 3 });
      const host = document.createElement('div');
      document.body.appendChild(host);
      terminal.open(host);
      const addon = new window.WebgpuAddon();
      terminal.loadAddon(addon);
      await addon.ready;
      return { terminal, addon, renderer: (addon as any)._renderer };
    };
    const a = await create();
    const b = await create();
    const device: GPUDevice = b.renderer._device;
    let lost = false;
    void device.lost.then(() => lost = true);
    a.terminal.dispose();
    device.pushErrorScope('validation');
    b.terminal.resize(30, 4);
    await new Promise<void>(resolve => b.terminal.write('still rendering', resolve));
    b.renderer.renderRows(0, 3);
    await device.queue.onSubmittedWorkDone();
    const c = await create();
    const output = {
      lost,
      reused: c.renderer._device === device,
      connected: b.renderer._canvas.isConnected,
      validationError: (await device.popErrorScope())?.message,
      submissions: b.renderer.diagnostics.submissions
    };
    b.terminal.dispose();
    c.terminal.dispose();
    return output;
  });
  expect(result.lost).toBe(false);
  expect(result.reused).toBe(true);
  expect(result.connected).toBe(true);
  expect(result.validationError).toBeUndefined();
  expect(result.submissions).toBeGreaterThan(0);
});

test('device loss restores all terminals and retries share a fresh device', async () => {
  const result = await ctx.page.evaluate(async () => {
    const terminals = [window.term, new window.Terminal({ cols: 20, rows: 3 })];
    const host = document.createElement('div');
    document.body.appendChild(host);
    terminals[1].open(host);
    const addons = terminals.map(terminal => {
      const addon = new window.WebgpuAddon();
      terminal.loadAddon(addon);
      return addon;
    });
    await Promise.all(addons.map(a => a.ready));
    const renderers = addons.map(a => (a as any)._renderer);
    const lossPromises = addons.map(a => new Promise<string>(resolve => a.onDeviceLoss(event => resolve(event.reason))));
    renderers[0]._device.destroy();
    const reasons = await Promise.all(lossPromises);
    const restored = terminals.every((t, i) => (t as any)._core._renderService._renderer.value !== renderers[i]);
    const released = renderers.every(r => !r._canvas.isConnected);
    addons.forEach(a => a.dispose());
    const replacements = terminals.map(terminal => {
      const addon = new window.WebgpuAddon();
      terminal.loadAddon(addon);
      return addon;
    });
    await Promise.all(replacements.map(a => a.ready));
    const devices = replacements.map(a => (a as any)._renderer._device);
    const output = { reasons, restored, released, shared: devices[0] === devices[1], fresh: devices[0] !== renderers[0]._device };
    terminals.forEach(t => t.dispose());
    return output;
  });
  expect(result).toEqual({ reasons: ['destroyed', 'destroyed'], restored: true, released: true, shared: true, fresh: true });
});

test('a failed canvas initialization does not release another terminal device', async () => {
  const result = await ctx.page.evaluate(async () => {
    const first = new window.WebgpuAddon();
    window.term.loadAddon(first);
    await first.ready;
    const renderer = (first as any)._renderer;
    const terminal = new window.Terminal();
    const host = document.createElement('div');
    document.body.appendChild(host);
    terminal.open(host);
    const initialRenderer = (terminal as any)._core._renderService._renderer.value;
    const getContext = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function(this: HTMLCanvasElement, ...args: any[]): any {
      return args[0] === 'webgpu' ? null : (getContext as any).apply(this, args);
    };
    const addon = new window.WebgpuAddon();
    terminal.loadAddon(addon);
    const rejected = await addon.ready.then(() => false, () => true);
    HTMLCanvasElement.prototype.getContext = getContext;
    const device: GPUDevice = renderer._device;
    device.pushErrorScope('validation');
    await new Promise<void>(resolve => window.term.write('survived', resolve));
    renderer.renderRows(0, window.term.rows - 1);
    await device.queue.onSubmittedWorkDone();
    const output = {
      rejected,
      preserved: (terminal as any)._core._renderService._renderer.value === initialRenderer,
      validationError: (await device.popErrorScope())?.message
    };
    terminal.dispose();
    window.term.dispose();
    return output;
  });
  expect(result).toEqual({ rejected: true, preserved: true, validationError: undefined });
});

test('disposing during shared initialization releases only that caller reference', async () => {
  const result = await ctx.page.evaluate(async () => {
    const gpu = navigator.gpu!;
    const original = gpu.requestAdapter.bind(gpu);
    const adapter = await original();
    let resolve!: (adapter: GPUAdapter | null) => void;
    const pending = new Promise<GPUAdapter | null>(r => resolve = r);
    Object.defineProperty(gpu, 'requestAdapter', { configurable: true, value: () => pending });
    const terminal = new window.Terminal();
    const host = document.createElement('div');
    document.body.appendChild(host);
    terminal.open(host);
    const a = new window.WebgpuAddon();
    const b = new window.WebgpuAddon();
    window.term.loadAddon(a);
    terminal.loadAddon(b);
    a.dispose();
    const rejected = await a.ready.then(() => false, () => true);
    resolve(adapter);
    await b.ready;
    Object.defineProperty(gpu, 'requestAdapter', { configurable: true, value: original });
    const renderer = (b as any)._renderer;
    const device: GPUDevice = renderer._device;
    device.pushErrorScope('validation');
    await new Promise<void>(r => terminal.write('shared init survived', r));
    renderer.renderRows(0, terminal.rows - 1);
    await device.queue.onSubmittedWorkDone();
    const output = { rejected, active: (terminal as any)._core._renderService._renderer.value === renderer, validationError: (await device.popErrorScope())?.message };
    terminal.dispose();
    window.term.dispose();
    return output;
  });
  expect(result).toEqual({ rejected: true, active: true, validationError: undefined });
});
