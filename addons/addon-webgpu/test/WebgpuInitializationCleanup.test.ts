/**
 * Copyright (c) 2026 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import { expect, test } from '@playwright/test';
import { createTestContext, openTerminal } from '../../../test/playwright/TestUtils';

test('a constructor failure releases its overlay, resources and device reference', async ({ browser }) => {
  const ctx = await createTestContext(browser);
  try {
    await openTerminal(ctx);
    const result = await ctx.page.evaluate(async () => {
      const first = new window.WebgpuAddon();
      window.term.loadAddon(first);
      await first.ready;
      const renderer = (first as any)._renderer;
      const device: GPUDevice = renderer._device;
      const terminal = new window.Terminal();
      const host = document.createElement('div');
      document.body.appendChild(host);
      terminal.open(host);
      const canvasesBefore = host.querySelectorAll('canvas').length;
      const createBuffer = device.createBuffer.bind(device);
      let cursorBufferDestroyed = false;
      Object.defineProperty(device, 'createBuffer', { configurable: true, value: (descriptor: GPUBufferDescriptor) => {
        if (descriptor.label === 'xterm grid uniforms') {
          throw new Error('test initialization failure');
        }
        const buffer = createBuffer(descriptor);
        if (descriptor.label === 'xterm cursor uniforms') {
          const destroy = buffer.destroy.bind(buffer);
          Object.defineProperty(buffer, 'destroy', { value: () => {
            cursorBufferDestroyed = true;
            destroy();
          } });
        }
        return buffer;
      } });
      const addon = new window.WebgpuAddon();
      terminal.loadAddon(addon);
      const error = await addon.ready.then(() => '', (e: Error) => e.message);
      Object.defineProperty(device, 'createBuffer', { configurable: true, value: createBuffer });
      const canvasesAfter = host.querySelectorAll('canvas').length;
      device.pushErrorScope('validation');
      await new Promise<void>(resolve => window.term.write('still alive', resolve));
      renderer.renderRows(0, window.term.rows - 1);
      await device.queue.onSubmittedWorkDone();
      const validationError = (await device.popErrorScope())?.message;
      terminal.dispose();
      window.term.dispose();
      const loss = await device.lost;
      return { error, canvasesBefore, canvasesAfter, cursorBufferDestroyed, validationError, lossReason: loss.reason };
    });
    expect(result.error).toBe('test initialization failure');
    expect(result.canvasesAfter).toBe(result.canvasesBefore);
    expect(result.cursorBufferDestroyed).toBe(true);
    expect(result.validationError).toBeUndefined();
    expect(result.lossReason).toBe('destroyed');
  } finally {
    await ctx.page.close();
  }
});
