/**
 * Copyright (c) 2026 The xterm.js authors. All rights reserved.
 * @license MIT
 */
import { test, type CDPSession } from '@playwright/test';
import { deepStrictEqual } from 'assert';
import { ITestContext, createTestContext, openTerminal, pollFor, timeout } from './TestUtils';

/**
 * IME composition driven through the browser's own input pipeline rather than through synthesised
 * CompositionEvent objects: `Input.imeSetComposition` makes Chromium's renderer produce real
 * compositionstart/compositionupdate, and `Input.insertText` makes it produce the real
 * compositionend, so the event ordering asserted here is the ordering an OS IME produces.
 *
 * This needs CDP and so is Chromium only, but that is the point: a maintainer with no Japanese or
 * Korean input method installed can still reproduce composition bugs.
 */

const COMPOSITION = 'こんにちは';
/** F7's own output. It is in the expected data because pressing F7 is part of the scenario. */
const F7 = '\x1b[18~';
/** Long enough for the deferred setTimeout(0) send in CompositionHelper to have run. */
const SETTLE_MS = 250;

let ctx: ITestContext;
test.beforeAll(async ({ browser }) => {
  ctx = await createTestContext(browser);
  await openTerminal(ctx);
});
test.afterAll(async () => await ctx.page.close());

/** Resolves once `fn` is true, so nothing here waits on a duration to make progress. */
async function until(fn: () => boolean, what: string, timeoutMs: number = 5000): Promise<void> {
  const start = Date.now();
  while (!fn()) {
    if (Date.now() - start > timeoutMs) {
      throw new Error(`timed out waiting for ${what}`);
    }
    await timeout(10);
  }
}

test.describe('Composition', () => {
  test.skip(({ browserName }) => browserName !== 'chromium', 'Input.imeSetComposition is a CDP method');

  /** Opens a terminal, records onData, and runs `fn` with a CDP session attached. */
  async function withComposition(fn: (cdp: CDPSession, data: string[]) => Promise<void>): Promise<void> {
    await openTerminal(ctx);
    const cdp = await ctx.page.context().newCDPSession(ctx.page);
    const data: string[] = [];
    const sub = ctx.proxy.onData(e => { data.push(e); });
    try {
      await ctx.page.locator('.xterm-helper-textarea').focus();
      await fn(cdp, data);
    } finally {
      sub.dispose();
      await cdp.detach();
    }
  }

  /** Starts a preedit and waits until the helper textarea actually holds it. */
  async function compose(cdp: CDPSession): Promise<void> {
    await cdp.send('Input.imeSetComposition', {
      text: COMPOSITION,
      selectionStart: COMPOSITION.length,
      selectionEnd: COMPOSITION.length
    });
    await pollFor(ctx.page, `document.querySelector('.xterm-helper-textarea').value`, COMPOSITION);
  }

  test('a keydown during composition must not send the composition twice (#5778)', async () => {
    await withComposition(async (cdp, data) => {
      await compose(cdp);

      // A key the IME does not consume arrives while composing. On macOS this is the eisuu (英数)
      // input source switch key, commonly bound to left Command with Karabiner-Elements; any
      // keyCode outside CompositionHelper's exclusion list takes the same branch, and F7 is one
      // CDP can dispatch on every platform. CompositionHelper.keydown() sends the composition
      // immediately here.
      await ctx.page.keyboard.press('F7');
      await until(() => data.length >= 2, 'the keydown to send the composition and F7');

      // The IME then commits, and the browser fires compositionend with the composed text still in
      // the helper textarea. Before this was fixed the composition was emitted a second time.
      await cdp.send('Input.insertText', { text: COMPOSITION });
      await timeout(SETTLE_MS);

      deepStrictEqual(data, [COMPOSITION, F7]);
    });
  });

  test('a composition withdrawn by the IME is still sent exactly once', async () => {
    await withComposition(async (cdp, data) => {
      await compose(cdp);
      await ctx.page.keyboard.press('F7');
      await until(() => data.length >= 2, 'the keydown to send the composition and F7');

      // An empty preedit: the IME withdraws the composition instead of committing it, which clears
      // the helper textarea. The keydown has already sent the text and nothing may follow it.
      await cdp.send('Input.imeSetComposition', { text: '', selectionStart: 0, selectionEnd: 0 });
      await timeout(SETTLE_MS);

      deepStrictEqual(data, [COMPOSITION, F7]);
    });
  });

  test('a composition committed with no keydown is sent exactly once', async () => {
    await withComposition(async (cdp, data) => {
      await compose(cdp);
      await cdp.send('Input.insertText', { text: COMPOSITION });
      await until(() => data.length >= 1, 'the committed composition');
      await timeout(SETTLE_MS);

      deepStrictEqual(data, [COMPOSITION]);
    });
  });
});
