/**
 * Copyright (c) 2016 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import { assert } from 'chai';
import * as Clipboard from './Clipboard';

describe('evaluatePastedTextProcessing', () => {
  it('should replace carriage return and/or line feed with carriage return', () => {
    const pastedText = {
      unix: 'foo\nbar\n',
      windows: 'foo\r\nbar\r\n'
    };

    const processedText = {
      unix: Clipboard.prepareTextForTerminal(pastedText.unix),
      windows: Clipboard.prepareTextForTerminal(pastedText.windows)
    };

    assert.equal(processedText.unix, 'foo\rbar\r');
    assert.equal(processedText.windows, 'foo\rbar\r');
  });
  it('should bracket pasted text in bracketedPasteMode', () => {
    const pastedText = 'foo bar';
    const unbracketedText = Clipboard.bracketTextForPaste(pastedText, false);
    const bracketedText = Clipboard.bracketTextForPaste(pastedText, true);

    assert.equal(unbracketedText, 'foo bar');
    assert.equal(bracketedText, '\x1b[200~foo bar\x1b[201~');
  });

  it('should escape embedded escape sequences in pasted text only when bracketed', () => {
    const ESC_SYMBOL = '\u241b';
    const pastedText = '\x1b[201~foo\x1b[200~bar';
    const unbracketedText = Clipboard.bracketTextForPaste(pastedText, false);
    const bracketedText = Clipboard.bracketTextForPaste(pastedText, true);

    assert.equal(unbracketedText, pastedText, 'non bracketed paste should remain unchanged');
    assert.equal(bracketedText, `\x1b[200~${ESC_SYMBOL}[201~foo${ESC_SYMBOL}[200~bar\x1b[201~`);
  });
});

describe('handlePasteEvent', () => {
  it('should prevent default browser insertion into the textarea and dispatch clipboard text', () => {
    let defaultPrevented = false;
    let propagationStopped = false;
    let triggeredData: string | undefined;
    const textarea = { value: 'stale' } as HTMLTextAreaElement;
    const ev = {
      clipboardData: {
        getData: (type: string) => type === 'text/plain' ? 'hello' : ''
      },
      preventDefault: () => { defaultPrevented = true; },
      stopPropagation: () => { propagationStopped = true; }
    } as unknown as ClipboardEvent;
    const coreService = {
      decPrivateModes: { bracketedPasteMode: false },
      triggerDataEvent: (data: string) => { triggeredData = data; }
    } as any;
    const optionsService = {
      rawOptions: { ignoreBracketedPasteMode: false }
    } as any;

    Clipboard.handlePasteEvent(ev, textarea, coreService, optionsService);

    assert.isTrue(propagationStopped);
    assert.isTrue(defaultPrevented);
    assert.equal(triggeredData, 'hello');
    assert.equal(textarea.value, '');
  });
});
