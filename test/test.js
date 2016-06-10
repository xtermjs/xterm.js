var assert = require('chai').assert;
var Terminal = require('../src/xterm');

describe('xterm.js', function() {
  var xterm;

  beforeEach(function () {
    xterm = new Terminal();
  });

  describe('evaluateKeyEscapeSequence', function() {
    it('should return \\x1b[5D when ctrl+left is passed', function() {
      assert.equal(xterm.evaluateKeyEscapeSequence({ ctrlKey: true, keyCode: 37 }).key, '\x1b[5D');
    });
    it('should return \\x1b[5C when ctrl+right is passed', function() {
      assert.equal(xterm.evaluateKeyEscapeSequence({ ctrlKey: true, keyCode: 39 }).key, '\x1b[5C');
    });
    it('should return the correct escape sequence for the F-keys', function() {
      assert.equal(xterm.evaluateKeyEscapeSequence({ keyCode: 112 }).key, '\x1bOP');
      assert.equal(xterm.evaluateKeyEscapeSequence({ keyCode: 113 }).key, '\x1bOQ');
      assert.equal(xterm.evaluateKeyEscapeSequence({ keyCode: 114 }).key, '\x1bOR');
      assert.equal(xterm.evaluateKeyEscapeSequence({ keyCode: 115 }).key, '\x1bOS');
      assert.equal(xterm.evaluateKeyEscapeSequence({ keyCode: 116 }).key, '\x1b[15~');
      assert.equal(xterm.evaluateKeyEscapeSequence({ keyCode: 117 }).key, '\x1b[17~');
      assert.equal(xterm.evaluateKeyEscapeSequence({ keyCode: 118 }).key, '\x1b[18~');
      assert.equal(xterm.evaluateKeyEscapeSequence({ keyCode: 119 }).key, '\x1b[19~');
      assert.equal(xterm.evaluateKeyEscapeSequence({ keyCode: 120 }).key, '\x1b[20~');
      assert.equal(xterm.evaluateKeyEscapeSequence({ keyCode: 121 }).key, '\x1b[21~');
      assert.equal(xterm.evaluateKeyEscapeSequence({ keyCode: 122 }).key, '\x1b[23~');
      assert.equal(xterm.evaluateKeyEscapeSequence({ keyCode: 123 }).key, '\x1b[24~');
    });
  });
});
