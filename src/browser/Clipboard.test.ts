/**
 * Copyright (c) 2016 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import { assert } from 'chai';
import * as Clipboard from 'browser/Clipboard';
import { ICoreService, IOptionsService } from 'common/services/Services';

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

  it('should prevent native insertion when handling clipboard paste data', () => {
    let triggeredData = '';
    let didStopPropagation = false;
    let didPreventDefault = false;
    const textarea = { value: 'before' } as HTMLTextAreaElement;
    const coreService = {
      decPrivateModes: { bracketedPasteMode: false },
      triggerDataEvent: (data: string) => triggeredData = data
    } as unknown as ICoreService;
    const optionsService = {
      rawOptions: {}
    } as unknown as IOptionsService;
    const event = {
      clipboardData: { getData: () => 'foo' },
      preventDefault: () => didPreventDefault = true,
      stopPropagation: () => didStopPropagation = true
    } as unknown as ClipboardEvent;

    Clipboard.handlePasteEvent(event, textarea, coreService, optionsService);

    assert.equal(triggeredData, 'foo');
    assert.equal(textarea.value, '');
    assert.ok(didPreventDefault);
    assert.ok(didStopPropagation);
  });
});
