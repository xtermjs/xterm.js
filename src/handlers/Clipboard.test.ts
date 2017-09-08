/**
 * Copyright (c) 2016 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import { assert } from 'chai';
import * as Terminal from '../Terminal';
import * as Clipboard from './Clipboard';

describe('evaluatePastedTextProcessing', () => {
  it('should replace carriage return + line feed with line feed on windows', () => {
    const pastedText = 'foo\r\nbar\r\n';
    const processedText = Clipboard.prepareTextForTerminal(pastedText, false);
    const windowsProcessedText = Clipboard.prepareTextForTerminal(pastedText, true);

    assert.equal(processedText, 'foo\r\nbar\r\n');
    assert.equal(windowsProcessedText, 'foo\rbar\r');
  });
});
