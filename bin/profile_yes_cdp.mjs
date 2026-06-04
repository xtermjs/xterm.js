/**
 * Copyright (c) 2026 The xterm.js authors. All rights reserved.
 * @license MIT
 *
 * CPU profile `timeout 1s yes` on the demo terminal via CDP (Chromium).
 *
 * Usage:
 *   node bin/profile_yes_cdp.mjs [--out path.cpuprofile] [--label baseline]
 *
 * Requires demo server on port 3000 (npm start).
 */

import { chromium } from 'playwright';
import { writeFileSync, mkdirSync, readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

function parseArgs() {
  const args = process.argv.slice(2);
  let out = join(root, 'out-test', 'yes.cpuprofile');
  let label = 'profile';
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--out' && args[i + 1]) {
      out = args[++i];
      label = out.replace(/\.cpuprofile$/, '').split('/').pop() ?? label;
    } else if (args[i] === '--label' && args[i + 1]) {
      label = args[++i];
    }
  }
  return { out, label };
}

const INTEREST = [
  'copyFrom',
  '_copySparseMapsFrom',
  '_copyCellMapsFrom',
  'BufferService.scroll'
];

export function summarizeCpuProfileFromObject(profile, label = 'profile') {
  const nodes = profile.nodes ?? [];
  const samples = profile.samples ?? [];
  const timeDeltas = profile.timeDeltas ?? [];
  const idToNode = new Map(nodes.map(n => [n.id, n]));
  const stats = new Map(INTEREST.map(n => [n, { hitCount: 0, selfTimeUs: 0, totalTimeUs: 0 }]));
  let totalSampleUs = 0;

  for (let i = 0; i < samples.length; i++) {
    const deltaUs = timeDeltas[i] ?? 0;
    totalSampleUs += deltaUs;
    const stack = [];
    let nodeId = samples[i];
    while (nodeId !== undefined) {
      const node = idToNode.get(nodeId);
      if (!node) break;
      stack.push(node);
      nodeId = node.parent;
    }
    for (const s of INTEREST) {
      if (stack.some(n => (n.callFrame?.functionName ?? '').includes(s))) {
        const st = stats.get(s);
        st.hitCount++;
        st.totalTimeUs += deltaUs;
      }
    }
    const leaf = stack[0];
    const fn = leaf?.callFrame?.functionName ?? '';
    for (const s of INTEREST) {
      if (fn.includes(s)) {
        stats.get(s).selfTimeUs += deltaUs;
        break;
      }
    }
  }

  const rows = [...stats.entries()]
    .filter(([, v]) => v.hitCount > 0)
    .map(([name, v]) => ({
      name,
      hitCount: v.hitCount,
      selfMs: +(v.selfTimeUs / 1000).toFixed(2),
      totalMs: +(v.totalTimeUs / 1000).toFixed(2),
      pctTotal: totalSampleUs ? +((100 * v.totalTimeUs) / totalSampleUs).toFixed(2) : 0
    }));

  return { label, totalSampleMs: +(totalSampleUs / 1000).toFixed(2), rows };
}

export function summarizeCpuProfile(profilePath) {
  const profile = JSON.parse(readFileSync(profilePath, 'utf8'));
  return summarizeCpuProfileFromObject(profile, profilePath);
}

async function main() {
  const { out, label } = parseArgs();
  mkdirSync(dirname(out), { recursive: true });

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  await page.goto('http://localhost:3000/', { waitUntil: 'networkidle' });
  await page.waitForFunction(() => window.term && window.term.element, undefined, { timeout: 60000 });

  const termInfo = await page.evaluate(() => ({
    cols: window.term.cols,
    rows: window.term.rows,
    scrollback: window.term.options.scrollback
  }));
  console.log('Terminal:', JSON.stringify(termInfo));

  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Profiler.enable');
  await cdp.send('Profiler.setSamplingInterval', { interval: 100 });
  await cdp.send('Profiler.start');

  const textarea = page.locator('.xterm-helper-textarea');
  await textarea.click();
  await page.keyboard.type('timeout 1s yes', { delay: 5 });
  await page.keyboard.press('Enter');
  await page.waitForTimeout(2500);

  const { profile } = await cdp.send('Profiler.stop');
  writeFileSync(out, JSON.stringify(profile));

  const summary = summarizeCpuProfileFromObject(profile, label);
  const summaryPath = out.replace(/\.cpuprofile$/, '.summary.json');
  writeFileSync(summaryPath, JSON.stringify({ ...summary, termInfo }, null, 2));
  console.log('Wrote', out);
  console.log('Summary:', JSON.stringify(summary, null, 2));

  await browser.close();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
