import { assert } from 'chai';
import * as Terminal from '../xterm';
import * as Clipboard from './Clipboard';


describe('evaluateCopiedTextProcessing', function () {
  it('should replace non-breaking spaces with regular spaces', () => {
    const nbsp = String.fromCharCode(160);
    const result = Clipboard.prepareTextForClipboard(`foo${nbsp}bar\ntest${nbsp}${nbsp}`);
    assert.equal(result, 'foo bar\ntest  ');
  });
});

describe('evaluatePastedTextProcessing', function () {
  it('should replace carriage return + line feed with line feed on windows', function () {
    const pastedText = 'foo\r\nbar\r\n',
          processedText = Clipboard.prepareTextForTerminal(pastedText, false),
          windowsProcessedText = Clipboard.prepareTextForTerminal(pastedText, true);

    assert.equal(processedText, 'foo\r\nbar\r\n');
    assert.equal(windowsProcessedText, 'foo\nbar\n');
  });
});
