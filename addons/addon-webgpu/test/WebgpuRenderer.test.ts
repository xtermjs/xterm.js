/**
 * Copyright (c) 2019 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import test from '@playwright/test';
import { ISharedRendererTestContext, injectSharedRendererTests, injectSharedRendererTestsStandalone } from '../../../test/playwright/SharedRendererTests';
import { ITestContext, createTestContext, openTerminal } from '../../../test/playwright/TestUtils';
import { platform } from 'os';

let ctx: ITestContext;
const ctxWrapper: ISharedRendererTestContext = { value: undefined } as any;
test.beforeAll(async ({ browser }) => {
  ctx = await createTestContext(browser);
  await openTerminal(ctx);
  ctxWrapper.value = ctx;
  await ctx.page.evaluate(`(async () => {
    window.addon = new window.WebgpuAddon();
    window.term.loadAddon(window.addon);
    await window.addon.ready;
  })()`);
});
test.afterAll(async () => await ctx.page.close());

test.describe('WebGPU Renderer Integration Tests', async () => {
  // HACK: WebGPU is often not supported in headless Firefox on Linux
  // https://github.com/microsoft/playwright/issues/11566
  // also disable safari due to #5852
  if (platform() === 'linux') {
    test.skip(({ browserName }) => browserName === 'firefox' || browserName === 'webkit');
  }

  injectSharedRendererTests(ctxWrapper);
  injectSharedRendererTestsStandalone(ctxWrapper, async () => {
    await ctx.page.evaluate(`(async () => {
      window.addon = new window.WebgpuAddon();
      window.term.loadAddon(window.addon);
      await window.addon.ready;
    })()`);
  });

  test('uses dirty-cell uploads and planned partial atlas uploads', async () => {
    const result = await ctx.page.evaluate<{
      cellBytes: number;
      dirtyCells: number;
      uploadRanges: number;
      sourceRanges: number;
      plannedRanges: number;
      overfetchBytes: number;
      unchangedBytes: number;
      unchangedCombinedBytes: number;
      partialUploads: number;
      fullUploads: number;
      sourceRects: number;
      plannedRects: number;
    }>(`(async () => {
      const nextFrame = () => new Promise(resolve => requestAnimationFrame(resolve));
      const write = data => new Promise(resolve => window.term.write(data, resolve));
      await write('\\x1b[?25l\\x1b[2J\\x1b[Hwarm');
      await nextFrame();
      await nextFrame();
      const renderer = window.term._core._renderService._renderer.value;

      const beforeRow = { ...renderer.diagnostics };
      await write('\\x1b[1;1HZ');
      await nextFrame();
      await renderer.whenIdle();
      const afterRow = { ...renderer.diagnostics };

      const beforeSame = { ...renderer.diagnostics };
      await write('\\x1b[1;1HZ');
      await nextFrame();
      await renderer.whenIdle();
      const afterSame = { ...renderer.diagnostics };

      await write('\\x1b[2;1Hé');
      for (let i = 0; i < 5; i++) await nextFrame();
      await renderer.whenIdle();
      // A newly rasterized combined glyph can change atlas layout after its
      // first model update. Flush that atlas-driven redraw before measuring
      // the unchanged-model fast path.
      renderer.renderRows(1, 1);
      await renderer.whenIdle();
      const beforeSameCombined = { ...renderer.diagnostics };
      renderer.renderRows(1, 1);
      await renderer.whenIdle();
      const afterSameCombined = { ...renderer.diagnostics };

      const beforeAtlas = { ...renderer.diagnostics };
      await write('\\x1b[3;2H漢');
      await nextFrame();
      await renderer.whenIdle();
      const afterAtlas = { ...renderer.diagnostics };
      return {
        cellBytes: afterRow.cellUploadBytes - beforeRow.cellUploadBytes,
        dirtyCells: afterRow.cellDirtyCells - beforeRow.cellDirtyCells,
        uploadRanges: afterRow.cellUploadRanges - beforeRow.cellUploadRanges,
        sourceRanges: afterRow.cellSourceRanges - beforeRow.cellSourceRanges,
        plannedRanges: afterRow.cellPlannedRanges - beforeRow.cellPlannedRanges,
        overfetchBytes: afterRow.cellOverfetchBytes - beforeRow.cellOverfetchBytes,
        unchangedBytes: afterSame.cellUploadBytes - beforeSame.cellUploadBytes,
        unchangedCombinedBytes: afterSameCombined.cellUploadBytes - beforeSameCombined.cellUploadBytes,
        partialUploads: afterAtlas.atlasPartialUploads - beforeAtlas.atlasPartialUploads,
        fullUploads: afterAtlas.atlasFullUploads - beforeAtlas.atlasFullUploads,
        sourceRects: afterAtlas.atlasSourceRects - beforeAtlas.atlasSourceRects,
        plannedRects: afterAtlas.atlasPlannedRects - beforeAtlas.atlasPlannedRects
      };
    })()`);
    test.expect(result.cellBytes).toBe(20);
    test.expect(result.dirtyCells).toBe(1);
    test.expect(result.uploadRanges).toBe(1);
    test.expect(result.sourceRanges).toBe(1);
    test.expect(result.plannedRanges).toBe(1);
    test.expect(result.overfetchBytes).toBe(0);
    test.expect(result.unchangedBytes).toBe(0);
    test.expect(result.unchangedCombinedBytes).toBe(0);
    test.expect(result.partialUploads).toBeGreaterThan(0);
    test.expect(result.fullUploads).toBe(0);
    test.expect(result.sourceRects).toBeGreaterThan(0);
    test.expect(result.plannedRects).toBeLessThanOrEqual(result.sourceRects);
  });

  test('uploads cursor uniforms only when cursor state changes', async () => {
    const result = await ctx.page.evaluate<{ unchangedBytes: number, movedBytes: number }>(`(async () => {
      const nextFrame = () => new Promise(resolve => requestAnimationFrame(resolve));
      const write = data => new Promise(resolve => window.term.write(data, resolve));
      window.term.options.cursorStyle = 'bar';
      window.term.options.cursorInactiveStyle = 'outline';
      window.term.focus();
      await write('\\x1b[?25h\\x1b[2;2H');
      await nextFrame();
      await nextFrame();
      const renderer = window.term._core._renderService._renderer.value;
      await renderer.whenIdle();

      const beforeSame = { ...renderer.diagnostics };
      renderer.renderRows(1, 1);
      await renderer.whenIdle();
      const afterSame = { ...renderer.diagnostics };

      await write('\\x1b[2;3H');
      renderer.renderRows(1, 1);
      await renderer.whenIdle();
      const afterMove = { ...renderer.diagnostics };
      return {
        unchangedBytes: afterSame.cursorUploadBytes - beforeSame.cursorUploadBytes,
        movedBytes: afterMove.cursorUploadBytes - afterSame.cursorUploadBytes
      };
    })()`);
    test.expect(result.unchangedBytes).toBe(0);
    test.expect(result.movedBytes).toBeGreaterThan(0);
  });
});
