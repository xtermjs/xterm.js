var assert = require('chai').assert;
var Terminal = require('../src/xterm');

describe('xterm.js', function() {
  var xterm;

  beforeEach(function () {
    xterm = new Terminal();
  });

  describe('evaluateKeyEscapeSequence', function() {
    it('should return the correct escape sequence for unmodified keys', function() {
      // Backspace
      assert.equal(xterm.evaluateKeyEscapeSequence({ keyCode: 8 }).key, '\x7f'); // ^?
      // Tab
      assert.equal(xterm.evaluateKeyEscapeSequence({ keyCode: 9 }).key, '\t');
      // Return/enter
      assert.equal(xterm.evaluateKeyEscapeSequence({ keyCode: 13 }).key, '\r'); // CR
      // Escape
      assert.equal(xterm.evaluateKeyEscapeSequence({ keyCode: 27 }).key, '\x1b');
      // Page up, page down
      assert.equal(xterm.evaluateKeyEscapeSequence({ keyCode: 33 }).key, '\x1b[5~'); // CSI 5 ~
      assert.equal(xterm.evaluateKeyEscapeSequence({ keyCode: 34 }).key, '\x1b[6~'); // CSI 6 ~
      // End, Home
      assert.equal(xterm.evaluateKeyEscapeSequence({ keyCode: 35 }).key, '\x1bOF'); // SS3 F
      assert.equal(xterm.evaluateKeyEscapeSequence({ keyCode: 36 }).key, '\x1bOH'); // SS3 H
      // Left, up, right, down arrows
      assert.equal(xterm.evaluateKeyEscapeSequence({ keyCode: 37 }).key, '\x1b[D'); // CSI D
      assert.equal(xterm.evaluateKeyEscapeSequence({ keyCode: 38 }).key, '\x1b[A'); // CSI A
      assert.equal(xterm.evaluateKeyEscapeSequence({ keyCode: 39 }).key, '\x1b[C'); // CSI C
      assert.equal(xterm.evaluateKeyEscapeSequence({ keyCode: 40 }).key, '\x1b[B'); // CSI B
      // Insert
      assert.equal(xterm.evaluateKeyEscapeSequence({ keyCode: 45 }).key, '\x1b[2~'); // CSI 2 ~
      // Delete
      assert.equal(xterm.evaluateKeyEscapeSequence({ keyCode: 46 }).key, '\x1b[3~'); // CSI 3 ~
      // F1-F12
      assert.equal(xterm.evaluateKeyEscapeSequence({ keyCode: 112 }).key, '\x1bOP'); // SS3 P
      assert.equal(xterm.evaluateKeyEscapeSequence({ keyCode: 113 }).key, '\x1bOQ'); // SS3 Q
      assert.equal(xterm.evaluateKeyEscapeSequence({ keyCode: 114 }).key, '\x1bOR'); // SS3 R
      assert.equal(xterm.evaluateKeyEscapeSequence({ keyCode: 115 }).key, '\x1bOS'); // SS3 S
      assert.equal(xterm.evaluateKeyEscapeSequence({ keyCode: 116 }).key, '\x1b[15~'); // CSI 1 5 ~
      assert.equal(xterm.evaluateKeyEscapeSequence({ keyCode: 117 }).key, '\x1b[17~'); // CSI 1 7 ~
      assert.equal(xterm.evaluateKeyEscapeSequence({ keyCode: 118 }).key, '\x1b[18~'); // CSI 1 8 ~
      assert.equal(xterm.evaluateKeyEscapeSequence({ keyCode: 119 }).key, '\x1b[19~'); // CSI 1 9 ~
      assert.equal(xterm.evaluateKeyEscapeSequence({ keyCode: 120 }).key, '\x1b[20~'); // CSI 2 0 ~
      assert.equal(xterm.evaluateKeyEscapeSequence({ keyCode: 121 }).key, '\x1b[21~'); // CSI 2 1 ~
      assert.equal(xterm.evaluateKeyEscapeSequence({ keyCode: 122 }).key, '\x1b[23~'); // CSI 2 3 ~
      assert.equal(xterm.evaluateKeyEscapeSequence({ keyCode: 123 }).key, '\x1b[24~'); // CSI 2 4 ~
    });
    it('should return \\x1b[5D for ctrl+left', function() {
      assert.equal(xterm.evaluateKeyEscapeSequence({ ctrlKey: true, keyCode: 37 }).key, '\x1b[5D'); // CSI 5 D
    });
    it('should return \\x1b[5C for ctrl+right', function() {
      assert.equal(xterm.evaluateKeyEscapeSequence({ ctrlKey: true, keyCode: 39 }).key, '\x1b[5C'); // CSI 5 C
    });
  });
});
