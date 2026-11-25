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
 * compositionstart/compositionupdate events and `Input.insertText` makes it produce the real
 * compositionend, so the ordering exercised here is the ordering an OS IME produces. This needs
 * CDP and so is Chromium only, which is the point: without an input method installed a developer
 * cannot otherwise reproduce these bugs.
 */

const CJK = '你';
/** Long enough for the deferred setTimeout(0) send in CompositionHelper to have run. */
const SETTLE_MS = 250;

let ctx: ITestContext;
test.beforeAll(async ({ browser }) => {
  ctx = await createTestContext(browser);
});
test.afterAll(async () => await ctx.page.close());

test.describe('IME composition', () => {
  test.skip(({ browserName }) => browserName !== 'chromium', 'Input.imeSetComposition is a CDP method');

  /** Opens a terminal, records onData, and runs `fn` with a CDP session attached. */
  async function withComposition(kitty: boolean, fn: (cdp: CDPSession) => Promise<void>): Promise<string[]> {
    await openTerminal(ctx, { allowProposedApi: true, vtExtensions: { kittyKeyboard: true } });
    const cdp = await ctx.page.context().newCDPSession(ctx.page);
    const data: string[] = [];
    const sub = ctx.proxy.onData(e => { data.push(e); });
    try {
      if (kitty) {
        await ctx.proxy.write('\x1b[>1u');
      }
      await ctx.page.locator('.xterm-helper-textarea').focus();
      await fn(cdp);
      await timeout(SETTLE_MS);
      return data;
    } finally {
      sub.dispose();
      await cdp.detach();
    }
  }

  /** Starts a preedit and waits until the helper textarea actually holds it. */
  async function compose(cdp: CDPSession, text: string): Promise<void> {
    await cdp.send('Input.imeSetComposition', { text, selectionStart: text.length, selectionEnd: text.length });
    await pollFor(ctx.page, `document.querySelector('.xterm-helper-textarea').value`, text);
  }

  /**
   * The key the IME consumes to pick a candidate. Chromium reports it as an ordinary keydown with
   * `isComposing: true` and suppresses the matching keypress, which is what keeps the legacy path
   * silent; `rawKeyDown` reproduces that pairing (no keypress, no text insertion).
   */
  async function candidateSelectionKey(cdp: CDPSession, key: string, code: string, keyCode: number): Promise<void> {
    await cdp.send('Input.dispatchKeyEvent', {
      type: 'rawKeyDown',
      key,
      code,
      windowsVirtualKeyCode: keyCode,
      nativeVirtualKeyCode: keyCode
    });
  }

  for (const candidate of [
    { name: 'space', key: ' ', code: 'Space', keyCode: 32 },
    { name: 'digit', key: '1', code: 'Digit1', keyCode: 49 }
  ]) {
    test(`candidate selection with ${candidate.name} must not send the key itself to the PTY (#6112)`, async () => {
      const run = (kitty: boolean): Promise<string[]> => withComposition(kitty, async cdp => {
        await compose(cdp, CJK);
        await candidateSelectionKey(cdp, candidate.key, candidate.code, candidate.keyCode);
        await cdp.send('Input.insertText', { text: CJK });
      });
      const legacy = await run(false);
      const kitty = await run(true);
      deepStrictEqual(kitty, legacy, 'the kitty keyboard protocol must not change what a candidate selection key sends');
      if (kitty.includes(candidate.key)) {
        throw new Error(`the raw "${candidate.key}" key must not be sent, got ${JSON.stringify(kitty)}`);
      }
    });
  }

  test('with the kitty keyboard protocol, keys are unaffected while no composition is active', async () => {
    const data = await withComposition(true, async () => {
      await ctx.page.keyboard.type('ab ');
      await ctx.page.keyboard.press('ArrowUp');
    });
    deepStrictEqual(data, ['a', 'b', ' ', '\x1b[A']);
  });
});
