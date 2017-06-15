import { assert } from 'chai';
import * as Terminal from '../xterm';
import * as Clipboard from './Clipboard';

describe('evaluatePastedTextProcessing', function () {
  it('should replace carriage return + line feed with line feed on windows', function () {
    const pastedText = 'foo\r\nbar\r\n',
          processedText = Clipboard.prepareTextForTerminal(pastedText, false),
          windowsProcessedText = Clipboard.prepareTextForTerminal(pastedText, true);

    assert.equal(processedText, 'foo\r\nbar\r\n');
    assert.equal(windowsProcessedText, 'foo\rbar\r');
  });
});
