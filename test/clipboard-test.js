var assert = require('chai').assert;
var Terminal = require('../src/xterm');
var Clipboard = require('../src/handlers/Clipboard');


describe('evaluateCopiedTextProcessing', function () {
  it('should strip trailing whitespaces and replace nbsps with spaces', function () {
    var nonBreakingSpace = String.fromCharCode(160),
        copiedText = 'echo' + nonBreakingSpace + 'hello' + nonBreakingSpace,
        processedText = Clipboard.prepareTextForClipboard(copiedText);

    // No trailing spaces
    assert.equal(processedText.match(/\s+$/), null);

    // No non-breaking space
    assert.equal(processedText.indexOf(nonBreakingSpace), -1);
  });
});
