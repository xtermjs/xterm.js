/**
 * Copyright (c) 2026 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import { decodePng } from '@lunapaint/png-codec';
import test, { expect } from '@playwright/test';
import { createTestContext, ITestContext, openTerminal } from '../../../test/playwright/TestUtils';

let ctx: ITestContext;

test.beforeEach(async ({ browser }) => {
  ctx = await createTestContext(browser);
  await openTerminal(ctx, { cols: 48, rows: 12, scrollback: 30, cursorBlink: false });
  await ctx.page.evaluate(`(async () => {
    window.renderErrors = [];
    window.addon = new window.WebgpuAddon();
    window.term.loadAddon(window.addon);
    await window.addon.ready;
    window.renderer = window.term._core._renderService._renderer.value;
    window.addon.onRendererError(error => window.renderErrors.push(error.message));
    window.addon.onDeviceLoss(info => window.renderErrors.push(info.message));
    window.frame = () => new Promise(resolve => requestAnimationFrame(resolve));
    window.writeFrame = async data => {
      await new Promise(resolve => window.term.write(data, resolve));
      await window.frame();
      await window.frame();
      await window.renderer.whenIdle();
    };
    await window.writeFrame('\\x1b[?25l');
  })()`);
});

test.afterEach(async () => {
  try {
    expect(await ctx.page.evaluate('window.renderErrors')).toEqual([]);
  } finally {
    await ctx.page.close();
  }
});

/** Compare optimized pixels against the general cell path with a complete model/GPU rebuild. */
async function expectFullRedrawEquivalent(): Promise<void> {
  const screen = ctx.page.locator('#terminal-container .xterm-screen');
  const actual = (await decodePng(new Uint8Array(await screen.screenshot()), { force32: true })).image;
  await ctx.page.evaluate(`(async () => {
    const renderer = window.renderer;
    const service = renderer._decorationService;
    // Only the eligibility check sees this sentinel. CellColorResolver retains the
    // real service, so the reference uses exactly the actual decorations and selection.
    renderer._decorationService = { get decorations() { return [undefined].values(); } };
    try {
      renderer._clearModel(true);
      renderer.renderRows(0, window.term.rows - 1);
      await renderer.whenIdle();
      await window.frame();
    } finally { renderer._decorationService = service; }
  })()`);
  const expected = (await decodePng(new Uint8Array(await screen.screenshot()), { force32: true })).image;
  expect(actual.width).toBe(expected.width);
  expect(actual.height).toBe(expected.height);
  expect(Buffer.compare(Buffer.from(actual.data), Buffer.from(expected.data)), 'optimized pixels must equal a general-path full rebuild').toBe(0);
}

test('plain cells retain ANSI colors and styling and restore complex cells', async () => {
  for (const data of [
    '\x1b[31mred\x1b[1;32mbold\x1b[0m plain\r\n\x1b[3;44mitalic\x1b[0m NEXT',
    '\x1b[3;1H\x1b[7mInverse\x1b[0m \x1b[2mdim\x1b[0m \x1b[4munder\x1b[9mstrike\x1b[0m',
    '\x1b[4;1H\x1b[38;2;90;180;220mRGB\x1b[48;5;120m background\x1b[0m',
    '\x1b[5;1H漢字 é 👩‍💻 ░▒▓ ┌──┐\x1b[6;1H\x1b[4:4mDotted\x1b[0m',
    '\x1b[5;1H\x1b[2Kplain cells replacing wide and combined glyphs',
    '\x1b[2;2H\x1b[41m \x1b[0m'
  ]) {
    await ctx.page.evaluate('window.writeFrame(' + JSON.stringify(data) + ')');
    await expectFullRedrawEquivalent();
  }
  expect(await ctx.page.evaluate('window.renderer.diagnostics.fastPathCells')).toBeGreaterThan(0);
});

test('small progress redraws erase old complex glyphs and preserve colored empty tails', async () => {
  await ctx.page.evaluate(`window.term.resize(160, 50)`);
  await ctx.page.evaluate(`window.writeFrame('\\x1b[31;44m漢é🚀\\x1b[4:4m old progress\\x1b[0m')`);
  for (const percent of [0, 9, 10, 99, 100]) {
    const bar = '='.repeat(Math.floor(percent / 5)).padEnd(20, ' ');
    const data = `\x1b[1;1H\x1b[42m\x1b[2K\x1b[0mjob [${bar}] ${percent}%`;
    await ctx.page.evaluate('window.writeFrame(' + JSON.stringify(data) + ')');
    await expectFullRedrawEquivalent();
  }
});

test('reuses ring rows through scrollback trimming and both viewport directions', async () => {
  const result = await ctx.page.evaluate<{ reused: number, bytes: number, bundles: number }>(`(async () => {
    for (let i = 0; i < 12; i++) await window.writeFrame('row ' + i + '\\r\\n');
    const before = { ...window.renderer.diagnostics };
    for (let i = 0; i < 49; i++) await window.writeFrame('\\x1b[3' + i % 7 + 'mrow ' + i + ' retained text\\x1b[0m\\r\\n');
    const after = window.renderer.diagnostics;
    return { reused: after.reusedRows - before.reusedRows, bytes: after.cellUploadBytes - before.cellUploadBytes,
      bundles: after.bundleRebuilds - before.bundleRebuilds };
  })()`);
  expect(result.reused).toBeGreaterThan(300);
  expect(result.bytes).toBeLessThan(49 * 48 * 12 * 20 / 2);
  expect(result.bundles).toBe(0);
  await expectFullRedrawEquivalent();
  for (const amount of [-3, -4, 2, 1, 4]) {
    await ctx.page.evaluate(`(async () => { window.term.scrollLines(${amount}); await window.frame(); await window.frame(); await window.renderer.whenIdle(); })()`);
    await expectFullRedrawEquivalent();
  }
});

test('validates a retained line mutated in the same write as a scroll', async () => {
  await ctx.page.evaluate(`(async () => {
    await window.writeFrame(Array.from({ length: 12 }, (_, i) => 'original ' + i).join('\\r\\n'));
    await window.writeFrame('\\x1b[3;1H\\x1b[45mMODIFIED\\x1b[0m\\x1b[12;1H\\r\\nnew bottom');
  })()`);
  expect(await ctx.page.evaluate('window.renderer.diagnostics.reusedRows')).toBeGreaterThan(0);
  await expectFullRedrawEquivalent();
});

test('partial scroll regions, insert/delete lines and reverse index remain correct', async () => {
  await ctx.page.evaluate(`window.writeFrame(Array.from({ length: 12 }, (_, i) => 'line ' + i).join('\\r\\n'))`);
  for (const data of ['\x1b[3;10r\x1b[10;1H\nBOTTOM', '\x1b[3;1H\x1bMREVERSE', '\x1b[5;1H\x1b[2LINSERT', '\x1b[4;1H\x1b[2MDELETE', '\x1b[r\x1b[2T']) {
    await ctx.page.evaluate('window.writeFrame(' + JSON.stringify(data) + ')');
    await expectFullRedrawEquivalent();
  }
});

test('selection, decoration disposal, cursor and focus invalidate plain cells', async () => {
  await ctx.page.evaluate(`(async () => {
    await window.writeFrame('first row\\r\\nsecond row\\r\\nthird row');
    window.term.select(1, 0, 15);
    await window.frame(); await window.frame();
  })()`);
  await expectFullRedrawEquivalent();
  await ctx.page.evaluate(`(async () => {
    window.term.clearSelection();
    const marker = window.term.registerMarker(-1);
    window.decoration = window.term.registerDecoration({ marker, x: 1, width: 8, backgroundColor: '#ff0000', foregroundColor: '#00ff00' });
    await window.frame(); await window.frame();
  })()`);
  await expectFullRedrawEquivalent();
  await ctx.page.evaluate(`(async () => {
    window.decoration.dispose();
    window.term.focus();
    await window.writeFrame('\\x1b[?25h\\x1b[2;4H');
  })()`);
  await expectFullRedrawEquivalent();
  for (const style of ['block', 'bar', 'underline']) {
    await ctx.page.evaluate(`(async () => { window.term.options.cursorStyle = '${style}'; await window.writeFrame('\\x1b[2;8H'); window.term.blur(); await window.frame(); await window.frame(); })()`);
    await expectFullRedrawEquivalent();
  }
});

test('Unicode rows, ligatures and blink fall back correctly while scrolling', async () => {
  await ctx.page.evaluate(`(async () => {
    window.term.registerCharacterJoiner(text => text.startsWith('==') ? [[0, 2]] : []);
    for (let i = 0; i < 17; i++) await window.writeFrame('== 漢字 é 👨‍👩‍👧 ░▒▓ \\x1b[4:4munder\\x1b[0m ' + i + '\\r\\n');
    await window.writeFrame('\\x1b[3;1H\\x1b[5mblink\\x1b[0m');
    // Freeze the blink phase for deterministic reference captures.
    window.renderer._textBlinkStateManager.setViewportVisible(false);
  })()`);
  await expectFullRedrawEquivalent();
});

test('BMP fast cells match the general path for wide, patterned and astral replacements', async () => {
  await ctx.page.evaluate(`(async () => {
    // Odd dimensions exercise both horizontal and vertical pattern variants.
    const dimensions = window.renderer.dimensions.device;
    window.term.options.letterSpacing += dimensions.cell.width % 2 === 0 ? 1 : 0;
    window.term.options.lineHeight = (dimensions.char.height + (dimensions.char.height % 2 === 0 ? 1 : 0)) / dimensions.char.height;
    await window.writeFrame('');
  })()`);
  expect(await ctx.page.evaluate('window.renderer.dimensions.device.cell.width % 2')).toBe(1);
  expect(await ctx.page.evaluate('window.renderer.dimensions.device.cell.height % 2')).toBe(1);
  const fastBefore = await ctx.page.evaluate<number>('window.renderer.diagnostics.fastPathCells');
  for (const data of [
    '\x1b[1;1H漢字░▒▓█ ┌──┐ ᚠ Ελληνικά',
    '\x1b[2;1H\x1b[7;31m░▒▓ 漢字\x1b[0m\x1b[3;2H░▒▓',
    '\x1b[4;1H🮜 👩‍💻 é\x1b[5;1H漢字漢字',
    '\x1b[4;1H░▒▓ ABC\x1b[5;2HX\x1b[5;5H\x1b[K',
    '\x1b[6;1H\x1b[4:4m░▒▓ 漢字\x1b[0m\x1b[7;1H\x1b[5m░▒▓\x1b[0m'
  ]) {
    await ctx.page.evaluate('window.writeFrame(' + JSON.stringify(data) + ')');
    await ctx.page.evaluate('window.renderer._textBlinkStateManager.setViewportVisible(false)');
    await expectFullRedrawEquivalent();
  }
  expect(await ctx.page.evaluate<number>('window.renderer.diagnostics.fastPathCells')).toBeGreaterThan(fastBefore);
  for (let i = 0; i < 18; i++) {
    await ctx.page.evaluate(`window.writeFrame('\\x1b[12;1H\\r\\n░▒▓ 漢字 ${i}')`);
    if (i % 5 === 0) await expectFullRedrawEquivalent();
  }
  await expectFullRedrawEquivalent();
});

test('resumes the plain run after combined, astral and extended cells', async () => {
  await ctx.page.evaluate(`window.writeFrame('漢字░▒▓é🚀尾\\x1b[4:4mXY\\x1b[0mZ')`);
  const result = await ctx.page.evaluate<{ resolved: number, fast: number, cells: number }>(`(async () => {
    const renderer = window.renderer;
    const resolver = renderer._cellColorResolver;
    const original = resolver.resolve;
    let resolved = 0;
    resolver.resolve = function(...args) { resolved++; return original.apply(this, args); };
    const before = renderer.diagnostics.fastPathCells;
    try {
      renderer._clearModel(true);
      renderer.renderRows(0, window.term.rows - 1);
      await renderer.whenIdle();
      return { resolved, fast: renderer.diagnostics.fastPathCells - before, cells: window.term.cols * window.term.rows };
    } finally { resolver.resolve = original; }
  })()`);
  // Only e + combining acute, the astral rocket and dotted X/Y require full
  // resolution. Wide continuations and the trailing Z return to the fast loop.
  expect(result.resolved).toBe(4);
  expect(result.fast).toBe(result.cells - 4);
  await expectFullRedrawEquivalent();
});

test('resize, theme, alternate buffer and atlas clearing reset ring state', async () => {
  await ctx.page.evaluate(`(async () => {
    for (let i = 0; i < 16; i++) await window.writeFrame('scroll ' + i + '\\r\\n');
    window.term.resize(52, 13);
    window.term.options.theme = { background: '#123456', foreground: '#fedcba' };
    await window.frame(); await window.frame();
  })()`);
  await expectFullRedrawEquivalent();
  for (const data of ['\x1b[?1049hALTERNATE\r\n漢字', '\x1b[?1049l', '\x1b[2J\x1b[Hclear']) {
    await ctx.page.evaluate('window.writeFrame(' + JSON.stringify(data) + ')');
    await expectFullRedrawEquivalent();
  }
  await ctx.page.evaluate(`(async () => { window.renderer.clearTextureAtlas(); await window.frame(); await window.frame(); await window.renderer.whenIdle(); })()`);
  await expectFullRedrawEquivalent();
});
