var assert = require('chai').assert;
var expect = require('chai').expect;


var escapeSequence = require('../src/lib/escapeSequence');


describe('xterm.js', function() {

  describe('unit testing evaluateKeyEscapeSequence', function() {
    it('should return the correct escape sequence for unmodified keys', function() {
      // Backspace
      assert.equal(escapeSequence({ keyCode: 8 }).key, '\x7f'); // ^?
      // Tab
      assert.equal(escapeSequence({ keyCode: 9 }).key, '\t');
      // Return/enter
      assert.equal(escapeSequence({ keyCode: 13 }).key, '\r'); // CR
      // Escape
      assert.equal(escapeSequence({ keyCode: 27 }).key, '\x1b');
      // Page up, page down
      assert.equal(escapeSequence({ keyCode: 33 }).key, '\x1b[5~'); // CSI 5 ~
      assert.equal(escapeSequence({ keyCode: 34 }).key, '\x1b[6~'); // CSI 6 ~
      // End, Home
      assert.equal(escapeSequence({ keyCode: 35 }).key, '\x1b[F'); // SS3 F
      assert.equal(escapeSequence({ keyCode: 36 }).key, '\x1b[H'); // SS3 H
      // Left, up, right, down arrows
      assert.equal(escapeSequence({ keyCode: 37 }).key, '\x1b[D'); // CSI D
      assert.equal(escapeSequence({ keyCode: 38 }).key, '\x1b[A'); // CSI A
      assert.equal(escapeSequence({ keyCode: 39 }).key, '\x1b[C'); // CSI C
      assert.equal(escapeSequence({ keyCode: 40 }).key, '\x1b[B'); // CSI B
      // Insert
      assert.equal(escapeSequence({ keyCode: 45 }).key, '\x1b[2~'); // CSI 2 ~
      // Delete
      assert.equal(escapeSequence({ keyCode: 46 }).key, '\x1b[3~'); // CSI 3 ~
      // F1-F12
      assert.equal(escapeSequence({ keyCode: 112 }).key, '\x1bOP'); // SS3 P
      assert.equal(escapeSequence({ keyCode: 113 }).key, '\x1bOQ'); // SS3 Q
      assert.equal(escapeSequence({ keyCode: 114 }).key, '\x1bOR'); // SS3 R
      assert.equal(escapeSequence({ keyCode: 115 }).key, '\x1bOS'); // SS3 S
      assert.equal(escapeSequence({ keyCode: 116 }).key, '\x1b[15~'); // CSI 1 5 ~
      assert.equal(escapeSequence({ keyCode: 117 }).key, '\x1b[17~'); // CSI 1 7 ~
      assert.equal(escapeSequence({ keyCode: 118 }).key, '\x1b[18~'); // CSI 1 8 ~
      assert.equal(escapeSequence({ keyCode: 119 }).key, '\x1b[19~'); // CSI 1 9 ~
      assert.equal(escapeSequence({ keyCode: 120 }).key, '\x1b[20~'); // CSI 2 0 ~
      assert.equal(escapeSequence({ keyCode: 121 }).key, '\x1b[21~'); // CSI 2 1 ~
      assert.equal(escapeSequence({ keyCode: 122 }).key, '\x1b[23~'); // CSI 2 3 ~
      assert.equal(escapeSequence({ keyCode: 123 }).key, '\x1b[24~'); // CSI 2 4 ~
    });
    it('should return \\x1b[5D for ctrl+left', function() {
      assert.equal(escapeSequence({ ctrlKey: true, keyCode: 37 }).key, '\x1b[1;5D'); // CSI 5 D
    });
    it('should return \\x1b[5C for ctrl+right', function() {
      assert.equal(escapeSequence({ ctrlKey: true, keyCode: 39 }).key, '\x1b[1;5C'); // CSI 5 C
    });
    it('should return \\x1b[5A for ctrl+up', function() {
      assert.equal(escapeSequence({ ctrlKey: true, keyCode: 38 }).key, '\x1b[1;5A'); // CSI 5 A
    });
    it('should return \\x1b[5B for ctrl+down', function() {
      assert.equal(escapeSequence({ ctrlKey: true, keyCode: 40 }).key, '\x1b[1;5B'); // CSI 5 B
    });
    // Evalueate alt + arrow key movement, which is a feature of terminal emulators but not VT100
    // http://unix.stackexchange.com/a/108106
    it('should return \\x1b[5D for alt+left', function() {
      assert.equal(escapeSequence({ altKey: true, keyCode: 37 }).key, '\x1b[1;5D'); // CSI 5 D
    });
    it('should return \\x1b[5C for alt+right', function() {
      assert.equal(escapeSequence({ altKey: true, keyCode: 39 }).key, '\x1b[1;5C'); // CSI 5 C
    });
    it('should return \\x1b[5A for alt+up', function() {
      assert.equal(escapeSequence({ altKey: true, keyCode: 38 }).key, '\x1b[1;5A'); // CSI 5 A
    });
    it('should return \\x1b[5B for alt+down', function() {
      assert.equal(escapeSequence({ altKey: true, keyCode: 40 }).key, '\x1b[1;5B'); // CSI 5 B
    });
  });
});
