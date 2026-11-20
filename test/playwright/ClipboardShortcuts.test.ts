/**
 * Copyright (c) 2026 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import { test } from '@playwright/test';
import { deepStrictEqual, strictEqual } from 'assert';
import { createTestContext, openTerminal } from './TestUtils';

for (const platform of ['MacIntel', 'Linux x86_64']) {
  test.describe(`Kitty clipboard shortcuts (${platform})`, () => {
    for (const flags of [0, 1, 3, 31]) {
      test(`preserves browser shortcuts with flags ${flags}`, async ({ browser }) => {
        const ctx = await createTestContext(browser);
        try {
          await ctx.page.addInitScript(platform => {
            Object.defineProperty(navigator, 'platform', { get: () => platform });
          }, platform);
          await ctx.page.reload();
          await openTerminal(ctx, { vtExtensions: { kittyKeyboard: true } });
          await ctx.proxy.write(`\x1b[>${flags}u`);
          const result = await ctx.page.evaluate(() => {
            const term = (window as any).term;
            const data: string[] = [];
            const listener = term.onData((value: string) => data.push(value));
            const cancelled: boolean[] = [];
            for (const key of ['c', 'v', 'C', 'V']) {
              for (const [type, repeat] of [['keydown', false], ['keydown', true], ['keyup', false]] as const) {
                const event = new KeyboardEvent(type, {
                  key, code: `Key${key.toUpperCase()}`, keyCode: key.toUpperCase().charCodeAt(0),
                  metaKey: true, shiftKey: key === key.toUpperCase(), repeat,
                  bubbles: true, cancelable: true
                });
                term.textarea.dispatchEvent(event);
                cancelled.push(event.defaultPrevented);
              }
            }
            listener.dispose();
            return { data, cancelled };
          });
          if (platform === 'MacIntel' || flags === 0) {
            deepStrictEqual(result, { data: [], cancelled: Array(12).fill(false) });
          } else {
            // SUPER remains available to applications on other platforms.
            deepStrictEqual(result.cancelled, [true, true, false, true, true, false, true, true, false, true, true, false]);
            strictEqual(result.data.length, flags & 2 ? 12 : 8);
            strictEqual(result.data[0], flags === 31 ? '\x1b[99;9;99u' : '\x1b[99;9u');
          }
        } finally {
          await ctx.page.close();
        }
      });
    }

    test('continues reporting other SUPER combinations', async ({ browser }) => {
      const ctx = await createTestContext(browser);
      try {
        await ctx.page.addInitScript(platform => {
          Object.defineProperty(navigator, 'platform', { get: () => platform });
        }, platform);
        await ctx.page.reload();
        await openTerminal(ctx, { vtExtensions: { kittyKeyboard: true } });
        await ctx.proxy.write('\x1b[>1u');
        const data = await ctx.page.evaluate(() => {
          const term = (window as any).term;
          const data: string[] = [];
          const listener = term.onData((value: string) => data.push(value));
          for (const modifiers of [{}, { ctrlKey: true }, { altKey: true }]) {
            term.textarea.dispatchEvent(new KeyboardEvent('keydown', {
              key: Object.keys(modifiers).length ? 'c' : 'x', metaKey: true,
              bubbles: true, cancelable: true, ...modifiers
            }));
          }
          listener.dispose();
          return data;
        });
        deepStrictEqual(data, ['\x1b[120;9u', '\x1b[99;13u', '\x1b[99;11u']);
      } finally {
        await ctx.page.close();
      }
    });
  });
}

test('keeps clipboard releases paired when modifiers change', async ({ browser }) => {
  const ctx = await createTestContext(browser);
  try {
    await ctx.page.addInitScript(() => {
      Object.defineProperty(navigator, 'platform', { get: () => 'MacIntel' });
    });
    await ctx.page.reload();
    await openTerminal(ctx, { vtExtensions: { kittyKeyboard: true } });
    await ctx.proxy.write('\x1b[>3u');
    const data = await ctx.page.evaluate(() => {
      const term = (window as any).term;
      const data: string[] = [];
      const listener = term.onData((value: string) => data.push(value));
      const dispatch = (type: string, key: string, modifiers: KeyboardEventInit = {}) => {
        term.textarea.dispatchEvent(new KeyboardEvent(type, {
          key, code: `Key${key.toUpperCase()}`, bubbles: true, cancelable: true, ...modifiers
        }));
      };
      for (const key of ['c', 'v']) {
        dispatch('keydown', key, { metaKey: true });
        // Cmd is released first; the letter release must still be suppressed.
        dispatch('keyup', key);
        dispatch('keydown', key, { metaKey: true, shiftKey: true });
        dispatch('keyup', key, { ctrlKey: true });
        // A lost release must not suppress the next ordinary press of this key.
        dispatch('keydown', key, { metaKey: true });
        dispatch('keydown', key);
        dispatch('keyup', key);
      }
      listener.dispose();
      return data;
    });
    deepStrictEqual(data, ['c', '\x1b[99;1:3u', 'v', '\x1b[118;1:3u']);
  } finally {
    await ctx.page.close();
  }
});

for (const flags of [1, 3]) {
  test(`native macOS copy and paste with Kitty flags ${flags}`, async ({ browser, browserName }) => {
    test.skip(process.platform !== 'darwin' || browserName !== 'chromium', 'Requires macOS and Chromium clipboard permissions');
    const ctx = await createTestContext(browser);
    try {
      await ctx.page.context().grantPermissions(['clipboard-read', 'clipboard-write']);
      await openTerminal(ctx, { vtExtensions: { kittyKeyboard: true } });
      await ctx.proxy.write(`copy me\x1b[>${flags}u`);
      await ctx.page.evaluate(() => {
        const term = (window as any).term;
        (window as any).clipboardInput = [];
        term.onData((data: string) => (window as any).clipboardInput.push(data));
        term.select(0, 0, 7);
        term.focus();
      });
      await ctx.page.evaluate(() => navigator.clipboard.writeText('clipboard sentinel'));
      await ctx.page.keyboard.press('Meta+c');
      deepStrictEqual(await ctx.page.evaluate(() => navigator.clipboard.readText()), 'copy me');
      deepStrictEqual(await ctx.page.evaluate(() => (window as any).clipboardInput), []);
      await ctx.page.evaluate(() => navigator.clipboard.writeText('paste me'));
      await ctx.page.keyboard.press('Meta+v');
      await ctx.page.waitForFunction(() => (window as any).clipboardInput.length > 0);
      deepStrictEqual(await ctx.page.evaluate(() => (window as any).clipboardInput), ['paste me']);
    } finally {
      await ctx.page.close();
    }
  });
}
