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

test.describe('WebGPU addon lifecycle', () => {
  test('rejects ready and preserves the current renderer when adapter initialization fails', async () => {
    const result = await ctx.page.evaluate(async () => {
      const gpu = navigator.gpu!;
      const originalRequestAdapter = gpu.requestAdapter.bind(gpu);
      Object.defineProperty(gpu, 'requestAdapter', { configurable: true, value: async () => null });
      const terminal = window.term as any;
      const initialRenderer = terminal._core._renderService._renderer.value;
      const addon = new window.WebgpuAddon();
      let rendererError = '';
      addon.onRendererError((error: Error) => rendererError = error.message);
      terminal.loadAddon(addon);
      let readyError = '';
      try {
        await addon.ready;
      } catch (error) {
        readyError = (error as Error).message;
      } finally {
        Object.defineProperty(gpu, 'requestAdapter', { configurable: true, value: originalRequestAdapter });
      }
      return {
        rendererPreserved: terminal._core._renderService._renderer.value === initialRenderer,
        rendererError,
        readyError
      };
    });

    expect(result.rendererPreserved).toBe(true);
    expect(result.rendererError).toContain('compatible GPU adapter');
    expect(result.readyError).toBe(result.rendererError);
  });

  test('does not install a renderer after dispose wins an initialization race', async () => {
    const result = await ctx.page.evaluate(async () => {
      const gpu = navigator.gpu!;
      const originalRequestAdapter = gpu.requestAdapter.bind(gpu);
      let resolveAdapter!: (adapter: GPUAdapter | null) => void;
      const pendingAdapter = new Promise<GPUAdapter | null>(resolve => resolveAdapter = resolve);
      Object.defineProperty(gpu, 'requestAdapter', { configurable: true, value: () => pendingAdapter });
      const terminal = window.term as any;
      const initialRenderer = terminal._core._renderService._renderer.value;
      const addon = new window.WebgpuAddon();
      terminal.loadAddon(addon);
      addon.dispose();
      const readyRejected = await addon.ready.then(() => false, () => true);
      resolveAdapter(null);
      await new Promise(resolve => setTimeout(resolve, 0));
      Object.defineProperty(gpu, 'requestAdapter', { configurable: true, value: originalRequestAdapter });
      return {
        readyRejected,
        rendererPreserved: terminal._core._renderService._renderer.value === initialRenderer
      };
    });

    expect(result.readyRejected).toBe(true);
    expect(result.rendererPreserved).toBe(true);
  });

  test('restores the default renderer and releases the canvas on device loss', async () => {
    const result = await ctx.page.evaluate(async () => {
      const terminal = window.term as any;
      const addon = new window.WebgpuAddon();
      terminal.loadAddon(addon);
      await addon.ready;
      let loss: { reason: string, message: string } | undefined;
      addon.onDeviceLoss((event: { reason: string, message: string }) => loss = event);
      const renderer = (addon as any)._renderer;
      renderer._onDeviceLoss.fire({ reason: 'unknown', message: 'test loss' });
      return {
        restored: terminal._core._renderService._renderer.value !== renderer,
        canvasReleased: !renderer._canvas.isConnected,
        loss
      };
    });

    expect(result.restored).toBe(true);
    expect(result.canvasReleased).toBe(true);
    expect(result.loss).toEqual({ reason: 'unknown', message: 'test loss' });
  });
});
