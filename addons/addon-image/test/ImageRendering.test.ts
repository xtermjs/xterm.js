/**
 * Copyright (c) 2024 The xterm.js authors. All rights reserved.
 * @license MIT
 *
 * Image rendering matrix: protocol x sizing mode x devicePixelRatio.
 *
 * Purpose
 * -------
 * Prove inline images rasterize at DEVICE resolution (crisp on HiDPI) rather
 * than CSS resolution (browser-upscaled, blurry), and document exactly which
 * situations the device-resolution approach helps in.
 *
 * The load-bearing, cross-browser-robust assertion is the image layer's
 * backing-store resolution*: on a display with devicePixelRatio = N the layer
 * canvas must have N device pixels per CSS pixel. That is the mechanism of the
 * fix and fails on CSS-resolution code at DPR > 1, independent of any resampler
 * differences between Chromium/Firefox/WebKit.
 *
 * Alongside the gate we measure a total-variation "sharpness" number over the
 * drawn region and dump a PNG of every cell to `out-snapshots/` (gitignored).
 * These are not asserted — they are the human-eyeball artifacts that show the
 * payoff is large for downscaled high-frequency content and negligible for
 * native/upscaled content.
 */

import test from '@playwright/test';
import { ok } from 'assert';
import { mkdirSync, writeFileSync } from 'fs';
import { ITestContext, createTestContext, openTerminal, timeout } from '../../../test/playwright/TestUtils';
import { iipSeq, iipSeqPx, iipFromFile, kittySeq, sixelSeq, makeRGBA, Pattern } from './ImageRenderingUtils';

const OUT_DIR = 'addons/addon-image/out-snapshots';

interface ICase {
  mode: string;
  pattern?: Pattern;   // synthetic source
  srcSize?: number;    // synthetic source size
  fixture?: string;    // committed image file (fixture/hidpi/), IIP only
  cells?: number;      // undefined => native size
}

const FIXTURE_DIR = 'addons/addon-image/fixture/hidpi/';

// Sizing modes across a range of content. Device resolution recovers real
// detail when downscaling content that has detail to spare; it only preserves
// size (not detail) for low-frequency, native or upscaled content. The cases
// span both ends so the suite documents the honest spread, not just the best
// case.
const CASES: ICase[] = [
  // Real committed lens/resolution chart (multi-frequency checkerboard)
  // downscaled: fine panels recovered at device resolution, coarse panels
  // identical - the textbook demonstration. Real encoded file => IIP only.
  { mode: 'downscale-chart-file', fixture: 'resolution-chart.png', cells: 20 },
  // Real committed broadband photograph downscaled to fit: the canonical
  // `imgcat photo.jpg` case. Real encoded file => IIP only.
  { mode: 'downscale-photo-file', fixture: 'photo.jpg', cells: 20 },
  // Raw-pixel sibling of the chart, so the flagship demonstration content is
  // also exercised on kitty (downscale) and sixel (native size below), not just
  // imgcat/IIP.
  { mode: 'downscale-chart', pattern: 'chart', srcSize: 480, cells: 20 },
  // Chart at native size: the only high-frequency case that also runs on sixel
  // (which has no in-band cell sizing), so sixel is not limited to rings.
  { mode: 'native-chart', pattern: 'chart', srcSize: 200 },
  // Downscaling a 2px checker ~2.8x: sub-pixel features collapse toward gray at
  // CSS resolution but are recovered at device resolution (faithful recovery,
  // not moire) - the clear win.
  { mode: 'downscale-highfreq', pattern: 'checker', srcSize: 256, cells: 10 },
  // Low-frequency source downscaled: nothing to recover, so ~no benefit even
  // though it is a downscale - proves the payoff is content-dependent.
  { mode: 'downscale-lowfreq', pattern: 'gradient', srcSize: 256, cells: 10 },
  // Shown at intrinsic size (source px == CSS px): no new detail, edges flat.
  { mode: 'native', pattern: 'rings', srcSize: 96 },
  // Upscaled: no new detail, but device resolution avoids a second resampling
  // pass (source is scaled up once, not once into CSS then again to the screen),
  // so edges are modestly cleaner.
  { mode: 'upscale', pattern: 'rings', srcSize: 24, cells: 12 }
];

// Includes a fractional ratio (1.5, the common Windows/Linux HiDPI setting):
// the fix keys off the true fractional devicePixelRatio, so this exercises the
// ceil()/footprint-invariance paths that integer DPRs would hide.
const DPRS = [1, 1.5, 2];

// CSS footprint (drawn bbox / dpr) of each protocol+mode at the baseline DPR,
// used to assert the on-screen size is devicePixelRatio-invariant.
const cssFootprints = new Map<string, { w: number, h: number }>();

interface ILayerMetrics {
  backW: number;
  backH: number;
  cssW: number;
  cssH: number;
  ratio: number;      // backing px per css px (~= dpr on device-res code)
  bboxW: number;      // drawn bbox, backing px
  bboxH: number;
  tvSum: number;      // total variation of luminance over bbox
  tvPerPx: number;    // tvSum / bbox area
  dataUrl: string;
}

async function readLayer(ctx: ITestContext): Promise<ILayerMetrics | null> {
  return ctx.page.evaluate(() => {
    const el = document.querySelector('.xterm-image-layer-top') as HTMLCanvasElement | null;
    if (!el) return null;
    const c = el.getContext('2d');
    if (!c) return null;
    const backW = el.width; const backH = el.height;
    const rect = el.getBoundingClientRect();
    const cssW = rect.width; const cssH = rect.height;
    const img = c.getImageData(0, 0, backW, backH);
    const d = img.data;
    const lum = (i: number): number => 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
    // non-transparent bounding box
    let x0 = backW; let y0 = backH; let x1 = -1; let y1 = -1;
    for (let y = 0; y < backH; y++) {
      for (let x = 0; x < backW; x++) {
        if (d[(y * backW + x) * 4 + 3] > 8) {
          if (x < x0) x0 = x; if (x > x1) x1 = x;
          if (y < y0) y0 = y; if (y > y1) y1 = y;
        }
      }
    }
    let tvSum = 0; let count = 0;
    if (x1 >= x0 && y1 >= y0) {
      for (let y = y0; y <= y1; y++) {
        for (let x = x0; x <= x1; x++) {
          const i = (y * backW + x) * 4;
          if (x < x1) tvSum += Math.abs(lum(i) - lum(i + 4));
          if (y < y1) tvSum += Math.abs(lum(i) - lum(i + backW * 4));
          count++;
        }
      }
    }
    const bboxW = x1 >= x0 ? x1 - x0 + 1 : 0;
    const bboxH = y1 >= y0 ? y1 - y0 + 1 : 0;
    return {
      backW, backH, cssW, cssH,
      ratio: cssW ? backW / cssW : 0,
      bboxW, bboxH,
      tvSum, tvPerPx: count ? tvSum / count : 0,
      dataUrl: el.toDataURL('image/png')
    };
  });
}

for (const dpr of DPRS) {
  test.describe(`dpr=${dpr}`, () => {
    let ctx: ITestContext;
    test.beforeAll(async ({ browser }) => {
      ctx = await createTestContext(browser, { deviceScaleFactor: dpr });
      await openTerminal(ctx, { cols: 80, rows: 24 });
    });
    test.afterAll(async () => await ctx.page.close());

    test.beforeEach(async () => {
      await ctx.page.evaluate(`
        window.term.reset();
        window.imageAddon?.dispose();
        window.imageAddon = new ImageAddon({ sixelPaletteLimit: 512 });
        window.term.loadAddon(window.imageAddon);
      `);
      await ctx.page.evaluate('window.term.write("\\x1b[H")');
    });

    const protocols: [string, (c: ICase) => string | null][] = [
      ['iip', c => c.fixture
        ? iipFromFile(FIXTURE_DIR + c.fixture, c.cells)
        : iipSeq(makeRGBA(c.pattern!, c.srcSize!), c.srcSize!, c.srcSize!, c.cells)],
      // kitty/sixel take raw pixels, not encoded files => synthetic cases only
      ['kitty', c => c.fixture ? null : kittySeq(makeRGBA(c.pattern!, c.srcSize!), c.srcSize!, c.srcSize!, c.cells)],
      // sixel has no in-band cell sizing => only the native synthetic case applies
      ['sixel', c => (c.fixture || c.cells) ? null : sixelSeq(makeRGBA(c.pattern!, c.srcSize!), c.srcSize!, c.srcSize!)]
    ];

    for (const [proto, build] of protocols) {
      test.describe(proto, () => {
        for (const c of CASES) {
          const seq = build(c);
          if (!seq) continue;
          test(c.mode, async ({}, info) => {
            await ctx.proxy.write(seq);
            await timeout(200);
            const m = await readLayer(ctx);
            ok(m, 'image layer should exist and be drawn');

            // dump PNG artifact for humans (not asserted)
            mkdirSync(OUT_DIR, { recursive: true });
            const name = `${proto}_${c.mode}_dpr${dpr}_${info.project.name}`;
            writeFileSync(`${OUT_DIR}/${name}.png`,
              Buffer.from(m!.dataUrl.split(',')[1], 'base64'));
            info.annotations.push({
              type: 'metrics',
              description: `ratio=${m!.ratio.toFixed(2)} backing=${m!.backW}x${m!.backH} ` +
                `bbox=${m!.bboxW}x${m!.bboxH} tvSum=${Math.round(m!.tvSum)} ` +
                `tvPerPx=${m!.tvPerPx.toFixed(3)}`
            });

            // GATE 1: layer backing store must be at device resolution.
            ok(Math.abs(m!.ratio - dpr) <= 0.1,
              `layer backing should be ${dpr}x css (device resolution), got ratio ${m!.ratio.toFixed(3)}`);
            ok(m!.bboxW > 0 && m!.bboxH > 0, 'image must actually be drawn');

            // GATE 2: the on-screen (CSS) footprint must be devicePixelRatio-
            // invariant. Catches the "half size on HiDPI" regression where a
            // decoder rasterizes at CSS resolution but the renderer places in
            // device cells (image ends up dpr-times too small).
            const key = `${proto}_${c.mode}`;
            const cssW = m!.bboxW / m!.ratio;
            const cssH = m!.bboxH / m!.ratio;
            if (dpr === DPRS[0]) {
              cssFootprints.set(key, { w: cssW, h: cssH });
            } else {
              const base = cssFootprints.get(key)!;
              ok(Math.abs(cssW - base.w) <= base.w * 0.06 + 2,
                `CSS width should be dpr-invariant: dpr1=${base.w.toFixed(1)} vs dpr${dpr}=${cssW.toFixed(1)}`);
              ok(Math.abs(cssH - base.h) <= base.h * 0.06 + 2,
                `CSS height should be dpr-invariant: dpr1=${base.h.toFixed(1)} vs dpr${dpr}=${cssH.toFixed(1)}`);
            }
          });
        }
      });
    }
  });
}

// IIP `px` params address DEVICE pixels (iTerm2 semantics, confirmed by
// gnachman in xtermjs/xterm.js#5861), unlike cell/auto/% sizing which is CSS-
// relative. So a `px`-sized image must render exactly that many device pixels
// regardless of devicePixelRatio (its CSS footprint shrinks as 1/dpr). This
// guards against double-scaling px by dpr.
for (const dpr of DPRS) {
  test.describe(`iip px sizing = device pixels (dpr=${dpr})`, () => {
    const PX = 100;
    let ctx: ITestContext;
    test.beforeAll(async ({ browser }) => {
      ctx = await createTestContext(browser, { deviceScaleFactor: dpr });
      await openTerminal(ctx, { cols: 80, rows: 24 });
    });
    test.afterAll(async () => await ctx.page.close());

    test(`width/height=${PX}px renders ${PX} device px`, async () => {
      await ctx.page.evaluate(`
        window.term.reset();
        window.imageAddon?.dispose();
        window.imageAddon = new ImageAddon({ sixelPaletteLimit: 512 });
        window.term.loadAddon(window.imageAddon);
      `);
      await ctx.page.evaluate('window.term.write("\\x1b[H")');
      await ctx.proxy.write(iipSeqPx(makeRGBA('checker', 256), 256, 256, PX));
      await timeout(200);
      const m = await readLayer(ctx);
      ok(m, 'image layer should exist and be drawn');
      ok(Math.abs(m!.bboxW - PX) <= 4,
        `width=${PX}px must render ${PX} device px at any dpr, got ${m!.bboxW}`);
      ok(Math.abs(m!.bboxH - PX) <= 4,
        `height=${PX}px must render ${PX} device px at any dpr, got ${m!.bboxH}`);
    });
  });
}
