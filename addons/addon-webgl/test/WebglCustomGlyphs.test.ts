/**
 * Copyright (c) 2026 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import test, { expect } from '@playwright/test';
import { decodePng } from '@lunapaint/png-codec';
import { platform } from 'os';
import { ITestContext, createTestContext, openTerminal } from '../../../test/playwright/TestUtils';

interface ITestRendererWithAtlasCanvas {
  readonly _charAtlas?: {
    readonly _tmpCanvas?: HTMLCanvasElement;
  };
}

async function writeAndWaitForRender(ctx: ITestContext, data: string): Promise<void> {
  const renderPromise = new Promise<void>(resolve => {
    const disposable = ctx.proxy.onRender(() => {
      disposable.dispose();
      resolve();
    });
  });
  await ctx.proxy.write(data);
  await renderPromise;
}

test.describe('WebGL custom glyphs', () => {
  if (platform() === 'linux') {
    test.skip(({ browserName }) => browserName === 'firefox' || browserName === 'webkit');
  }

  for (const deviceScaleFactor of [1, 1.5]) {
    for (const config of [
      { name: '1:2 cells', fontFamily: 'monospace', lineHeight: 1, letterSpacing: 0 },
      { name: 'tall cells', fontFamily: 'monospace', lineHeight: 2, letterSpacing: 0 },
      { name: 'different font metrics', fontFamily: 'serif', lineHeight: 1.25, letterSpacing: 0 },
      { name: 'wide cells', fontFamily: 'monospace', lineHeight: 1, letterSpacing: 32 }
    ]) {
      test(`Git nodes stay circular and connected in ${config.name} at DPR ${deviceScaleFactor}`, async ({ browser, browserName }) => {
        // Device-pixel ResizeObserver boxes use the native browser scale, not context emulation.
        const scaledBrowser = deviceScaleFactor !== 1 && browserName !== 'webkit'
          ? await browser.browserType().launch({
            args: browserName === 'chromium' ? ['--enable-unsafe-swiftshader', `--force-device-scale-factor=${deviceScaleFactor}`] : undefined,
            // eslint-disable-next-line @typescript-eslint/naming-convention -- Firefox's native preference name.
            firefoxUserPrefs: { 'layout.css.devPixelsPerPx': String(deviceScaleFactor) }
          })
          : undefined;
        const ctx = await createTestContext(scaledBrowser ?? browser, { deviceScaleFactor });
        try {
          await openTerminal(ctx, {
            cols: 8, rows: 6, fontSize: 32, fontFamily: config.fontFamily,
            lineHeight: config.lineHeight, letterSpacing: config.letterSpacing,
            theme: { foreground: '#ffffff', background: '#000000' }
          });
          await ctx.page.evaluate(`
            window.addon = new window.WebglAddon({ customGlyphs: true });
            window.term.loadAddon(window.addon);
          `);
          const dimensions = await ctx.proxy.dimensions;
          if (!dimensions) {
            throw new Error('Render dimensions must be available');
          }
          expect(dimensions.device.cell.width / dimensions.css.cell.width).toBeCloseTo(deviceScaleFactor);
          if (config.name === '1:2 cells') {
            const letterSpacing = Math.max(0, Math.ceil(dimensions.device.char.height / 2) - dimensions.device.char.width);
            await ctx.proxy.setOption('letterSpacing', letterSpacing);
            await ctx.proxy.setOption('lineHeight', (2 * (dimensions.device.char.width + letterSpacing) + 0.01) / dimensions.device.char.height);
          }
          const glyphs = Array.from({ length: 32 }, (_, i) => String.fromCodePoint(0xF5EE + i));
          const lines = ['\uF5EE \uF5EF'];
          for (let i = 0; i < glyphs.length; i += 8) {
            lines.push(glyphs.slice(i, i + 8).join(''));
          }
          await writeAndWaitForRender(ctx, '\x1b[?25l' + lines.join('\r\n'));
          const screenshot = await ctx.page.locator('#terminal-container .xterm-screen').screenshot({ path: test.info().outputPath('git-nodes.png') });
          await test.info().attach('git-nodes', { body: screenshot, contentType: 'image/png' });
          const image = (await decodePng(new Uint8Array(screenshot), { force32: true })).image;
          const width = image.width / 8;
          const height = image.height / 6;
          const hasInk = (x: number, y: number): boolean => image.data[(y * image.width + x) * 4] > 64;
          if (config.name === '1:2 cells') {
            expect(Math.abs(height - 2 * width)).toBeLessThanOrEqual(1);
          }
          for (const col of [0, 2]) {
            const xs: number[] = [];
            const ys: number[] = [];
            for (let y = 0; y < Math.floor(height); y++) {
              for (let x = Math.ceil(col * width); x < Math.floor((col + 1) * width); x++) {
                if (hasInk(x, y)) {
                  xs.push(x);
                  ys.push(y);
                }
              }
            }
            expect(xs.length).toBeGreaterThan(0);
            const diameterX = Math.max(...xs) - Math.min(...xs) + 1;
            const diameterY = Math.max(...ys) - Math.min(...ys) + 1;
            expect(Math.abs(diameterX - diameterY), `node at column ${col} must be circular`).toBeLessThanOrEqual(2);
            expect(Math.abs(diameterX - (0.7 * Math.min(width, height) + deviceScaleFactor))).toBeLessThanOrEqual(2);
            expect(hasInk(Math.floor((col + 0.5) * width), Math.floor(height / 2))).toBe(col === 0);
          }
          const up = [0xF5F8, 0xF5F9, 0xF5FA, 0xF5FB, 0xF600, 0xF601, 0xF602, 0xF603, 0xF604, 0xF605, 0xF606, 0xF607, 0xF60A, 0xF60B, 0xF60C, 0xF60D];
          const down = [0xF5F6, 0xF5F7, 0xF5FA, 0xF5FB, 0xF5FC, 0xF5FD, 0xF5FE, 0xF5FF, 0xF604, 0xF605, 0xF606, 0xF607, 0xF608, 0xF609, 0xF60C, 0xF60D];
          for (const [codes, direction] of [[up, -1], [down, 1]] as const) {
            for (const code of codes) {
              const index = code - 0xF5EE;
              const cx = (index % 8 + 0.5) * width;
              const y0 = (1 + Math.floor(index / 8)) * height;
              const radius = 0.35 * Math.min(width, height);
              const start = direction === -1 ? Math.ceil(y0) : Math.ceil(y0 + height / 2 + radius);
              const end = direction === -1 ? Math.floor(y0 + height / 2 - radius) : Math.floor(y0 + height) - 1;
              for (let y = start; y <= end; y++) {
                let connected = false;
                for (let x = Math.floor(cx) - 1; x <= Math.ceil(cx) + 1; x++) {
                  connected ||= hasInk(x, y);
                }
                expect(connected, `U+${code.toString(16)} must connect at row ${y - y0}`).toBe(true);
              }
            }
          }
          const cx = 7.5 * width;
          const cy = 4.5 * height;
          const radius = 0.35 * Math.min(width, height);
          for (const [start, end] of [[Math.ceil(7 * width), Math.floor(cx - radius)], [Math.ceil(cx + radius), Math.floor(8 * width) - 1]]) {
            for (let x = start; x <= end; x++) {
              let connected = false;
              for (let y = Math.floor(cy) - 1; y <= Math.ceil(cy) + 1; y++) {
                connected ||= hasInk(x, y);
              }
              expect(connected, `U+F60D must connect horizontally at column ${x}`).toBe(true);
            }
          }
        } finally {
          await ctx.page.close();
          await scaledBrowser?.close();
        }
      });
    }
  }

  test('pattern glyphs render after the terminal is adopted into another document', async ({ browser }) => {
    const ctx = await createTestContext(browser);
    const errors: string[] = [];
    const onError = (error: Error): void => { errors.push(error.message); };
    ctx.page.on('pageerror', onError);
    try {
      await openTerminal(ctx);
      await ctx.page.evaluate(`
        window.addon = new window.WebglAddon({ customGlyphs: true });
        window.term.loadAddon(window.addon);
      `);
      await ctx.page.evaluate(() => {
        const frame = document.createElement('iframe');
        document.body.appendChild(frame);
        const auxiliaryDocument = frame.contentDocument;
        if (!auxiliaryDocument?.body || !window.term.element) {
          throw new Error('Auxiliary document and terminal element must be available');
        }
        const renderer = window.term._core?._renderService?._renderer?.value as ITestRendererWithAtlasCanvas | undefined;
        const atlasCanvas = renderer?._charAtlas?._tmpCanvas;
        if (!atlasCanvas) {
          throw new Error('Texture atlas canvas must be available');
        }
        // Model the atlas state after an uncached glyph has attached the measurement canvas.
        window.term.element.appendChild(atlasCanvas);
        auxiliaryDocument.body.appendChild(window.term.element);
        if (atlasCanvas.ownerDocument !== auxiliaryDocument) {
          throw new Error('Texture atlas canvas must be adopted into the auxiliary document');
        }
        auxiliaryDocument.createElement = () => {
          throw new Error('Not allowed to create elements in the auxiliary document');
        };
      });

      await writeAndWaitForRender(ctx, '\u2591');
      await writeAndWaitForRender(ctx, 'X');

      const line = await ctx.page.evaluate(() => window.term.buffer.active.getLine(0)?.translateToString(true));
      expect(errors, `renderer must not create pattern canvases in the auxiliary document: ${errors[0] ?? ''}`).toEqual([]);
      expect(line).toBe('\u2591X');
    } finally {
      ctx.page.off('pageerror', onError);
      await ctx.page.close();
    }
  });
});
