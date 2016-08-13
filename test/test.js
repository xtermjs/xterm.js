var assert = require('chai').assert;
var expect = require('chai').expect;
var Terminal = require('../src/xterm');

describe('xterm.js', function() {
  var xterm;

  beforeEach(function () {
    xterm = new Terminal();
    xterm.refresh = function(){};
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
      assert.equal(xterm.evaluateKeyEscapeSequence({ keyCode: 35 }).key, '\x1b[F'); // SS3 F
      assert.equal(xterm.evaluateKeyEscapeSequence({ keyCode: 36 }).key, '\x1b[H'); // SS3 H
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
      assert.equal(xterm.evaluateKeyEscapeSequence({ ctrlKey: true, keyCode: 37 }).key, '\x1b[1;5D'); // CSI 5 D
    });
    it('should return \\x1b[5C for ctrl+right', function() {
      assert.equal(xterm.evaluateKeyEscapeSequence({ ctrlKey: true, keyCode: 39 }).key, '\x1b[1;5C'); // CSI 5 C
    });
  });

  describe('attachCustomEventHandler', function () {
    var evKeyDown = {
      preventDefault: function() {},
      stopPropagation: function() {},
      type: 'keydown'
    }

    beforeEach(function() {
      xterm.handler = function() {};
      xterm.showCursor = function() {};
      xterm.clearSelection = function() {};
      xterm.compositionHelper = {
        keydown: {
          bind: function() {
            return function () { return true; }
          }
        }
      }
    });

    it('should process the keydown event based on what the handler returns', function () {
      assert.equal(xterm.keyDown(Object.assign({}, evKeyDown, { keyCode: 77 })), true);
      xterm.attachCustomKeydownHandler(function (ev) {
        return ev.keyCode === 77;
      });
      assert.equal(xterm.keyDown(Object.assign({}, evKeyDown, { keyCode: 77 })), true);
      xterm.attachCustomKeydownHandler(function (ev) {
        return ev.keyCode !== 77;
      });
      assert.equal(xterm.keyDown(Object.assign({}, evKeyDown, { keyCode: 77 })), false);
    });
    
    it('should alive after reset(ESC c Full Reset (RIS))', function () {
      xterm.attachCustomKeydownHandler(function (ev) {
        return ev.keyCode !== 77;
      });
      assert.equal(xterm.keyDown(Object.assign({}, evKeyDown, { keyCode: 77 })), false);
      xterm.reset();
      assert.equal(xterm.keyDown(Object.assign({}, evKeyDown, { keyCode: 77 })), false);
    });
  });

  describe('evaluateCopiedTextProcessing', function () {
    it('should strip trailing whitespaces and replace nbsps with spaces', function () {
			var nonBreakingSpace = String.fromCharCode(160),
          copiedText = 'echo' + nonBreakingSpace + 'hello' + nonBreakingSpace,
          processedText = Terminal.prepareCopiedTextForClipboard(copiedText);

      // No trailing spaces
      assert.equal(processedText.match(/\s+$/), null);

      // No non-breaking space
      assert.equal(processedText.indexOf(nonBreakingSpace), -1);
    });
  });

  describe('Third level shift', function() {
    var evKeyDown = {
          preventDefault: function() {},
          stopPropagation: function() {},
      		type: 'keydown'
        },
        evKeyPress = {
          preventDefault: function() {},
          stopPropagation: function() {},
      		type: 'keypress'
        };

    beforeEach(function() {
      xterm.handler = function() {};
      xterm.showCursor = function() {};
      xterm.clearSelection = function() {};
      xterm.compositionHelper = {
        isComposing: false,
        keydown: {
          bind: function() {
            return function() { return true; };
          }
        }
      };
    });

    describe('On Mac OS', function() {
      beforeEach(function() {
        xterm.isMac = true;
      });

      it('should not interfere with the alt key on keyDown', function() {
        assert.equal(
          xterm.keyDown(Object.assign({}, evKeyDown, { altKey: true, keyCode: 81 })),
          true
        );
        assert.equal(
          xterm.keyDown(Object.assign({}, evKeyDown, { altKey: true, keyCode: 192 })),
          true
        );
      });

      it('should interefere with the alt + arrow keys', function() {
        assert.equal(
          xterm.keyDown(Object.assign({}, evKeyDown, { altKey: true, keyCode: 37 })),
          false
        );
        assert.equal(
          xterm.keyDown(Object.assign({}, evKeyDown, { altKey: true, keyCode: 39 })),
          false
        );
      });

      it('should emit key with alt + key on keyPress', function(done) {
        var keys = ['@', '@', '\\', '\\', '|', '|'];

        xterm.on('keypress', function(key) {
          if (key) {
            var index = keys.indexOf(key);
            assert(index !== -1, "Emitted wrong key: " + key);
            keys.splice(index, 1);
          }
          if (keys.length === 0) done();
        });

        xterm.keyPress(Object.assign({}, evKeyPress, { altKey: true, keyCode: 64 })); // @
        // Firefox
        xterm.keyPress(Object.assign({}, evKeyPress, { altKey: true, charCode: 64, keyCode: 0 }));
        xterm.keyPress(Object.assign({}, evKeyPress, { altKey: true, keyCode: 92 })); // \
        xterm.keyPress(Object.assign({}, evKeyPress, { altKey: true, charCode: 92, keyCode: 0 }));
        xterm.keyPress(Object.assign({}, evKeyPress, { altKey: true, keyCode: 124 })); // |
        xterm.keyPress(Object.assign({}, evKeyPress, { altKey: true, charCode: 124, keyCode: 0 }));
      });
    });

    describe('On MS Windows', function() {
      beforeEach(function() {
        xterm.isMSWindows = true;
      });

      it('should not interfere with the alt + ctrl key on keyDown', function() {
        assert.equal(
          xterm.keyDown(Object.assign({}, evKeyDown, { altKey: true, ctrlKey: true, keyCode: 81 })),
          true
        );
        assert.equal(
          xterm.keyDown(Object.assign({}, evKeyDown, { altKey: true, ctrlKey: true, keyCode: 192 })),
          true
        );
      });

      it('should interefere with the alt + ctrl + arrow keys', function() {
        assert.equal(
          xterm.keyDown(Object.assign({}, evKeyDown, { altKey: true, ctrlKey: true, keyCode: 37 })),
          false
        );
        assert.equal(
          xterm.keyDown(Object.assign({}, evKeyDown, { altKey: true, ctrlKey: true, keyCode: 39 })),
          false
        );
      });

      it('should emit key with alt + ctrl + key on keyPress', function(done) {
        var keys = ['@', '@', '\\', '\\', '|', '|'];

        xterm.on('keypress', function(key) {
          if (key) {
            var index = keys.indexOf(key);
            assert(index !== -1, "Emitted wrong key: " + key);
            keys.splice(index, 1);
          }
          if (keys.length === 0) done();
        });

        xterm.keyPress(
          Object.assign({}, evKeyPress, { altKey: true, ctrlKey: true, keyCode: 64 })
        ); // @
        xterm.keyPress(
          Object.assign({}, evKeyPress, { altKey: true, ctrlKey: true, charCode: 64, keyCode: 0 })
        );
        xterm.keyPress(
          Object.assign({}, evKeyPress, { altKey: true, ctrlKey: true, keyCode: 92 })
        ); // \
        xterm.keyPress(
          Object.assign({}, evKeyPress, { altKey: true, ctrlKey: true, charCode: 92, keyCode: 0 })
        );
        xterm.keyPress(
          Object.assign({}, evKeyPress, { altKey: true, ctrlKey: true, keyCode: 124 })
        ); // |
        xterm.keyPress(
          Object.assign({}, evKeyPress, { altKey: true, ctrlKey: true, charCode: 124, keyCode: 0 })
        );
      });
    });
  });

  describe('unicode - surrogates', function() {
    it('2 characters per cell', function () {
      var high = '\uD800';
      for (var i=0xDC00; i<=0xDCFF; ++i) {
        xterm.write(high + String.fromCharCode(i));
        var tchar = xterm.lines[0][0];
        expect(tchar[1]).eql(high + String.fromCharCode(i));
        expect(tchar[1].length).eql(2);
        expect(tchar[2]).eql(1);
        expect(xterm.lines[0][1][1]).eql(' ');
        xterm.reset();
      }
    });
    it('2 characters at last cell', function() {
      var high = '\uD800';
      for (var i=0xDC00; i<=0xDCFF; ++i) {
        xterm.x = xterm.cols - 1;
        xterm.write(high + String.fromCharCode(i));
        expect(xterm.lines[0][xterm.x-1][1]).eql(high + String.fromCharCode(i));
        expect(xterm.lines[0][xterm.x-1][1].length).eql(2);
        expect(xterm.lines[1][0][1]).eql(' ');
        xterm.reset();
      }
    });
    it('2 characters per cell over line end with autowrap', function() {
      var high = '\uD800';
      for (var i=0xDC00; i<=0xDCFF; ++i) {
        xterm.x = xterm.cols - 1;
        xterm.wraparoundMode = true;
        xterm.write('a' + high + String.fromCharCode(i));
        expect(xterm.lines[0][xterm.cols-1][1]).eql('a');
        expect(xterm.lines[1][0][1]).eql(high + String.fromCharCode(i));
        expect(xterm.lines[1][0][1].length).eql(2);
        expect(xterm.lines[1][1][1]).eql(' ');
        xterm.reset();
      }
    });
    it('2 characters per cell over line end without autowrap', function() {
      var high = '\uD800';
      for (var i=0xDC00; i<=0xDCFF; ++i) {
        xterm.x = xterm.cols - 1;
        xterm.wraparoundMode = false;
        xterm.write('a' + high + String.fromCharCode(i));
        expect(xterm.lines[0][xterm.cols-1][1]).eql(high + String.fromCharCode(i));
        expect(xterm.lines[0][xterm.cols-1][1].length).eql(2);
        expect(xterm.lines[1][1][1]).eql(' ');
        xterm.reset();
      }
    });
    it('splitted surrogates', function() {
      var high = '\uD800';
      for (var i=0xDC00; i<=0xDCFF; ++i) {
        xterm.write(high);
        xterm.write(String.fromCharCode(i));
        var tchar = xterm.lines[0][0];
        expect(tchar[1]).eql(high + String.fromCharCode(i));
        expect(tchar[1].length).eql(2);
        expect(tchar[2]).eql(1);
        expect(xterm.lines[0][1][1]).eql(' ');
        xterm.reset();
      }
    });
  });

  describe('unicode - combining characters', function() {
    it('café', function () {
      xterm.write('cafe\u0301');
      expect(xterm.lines[0][3][1]).eql('e\u0301');
      expect(xterm.lines[0][3][1].length).eql(2);
      expect(xterm.lines[0][3][2]).eql(1);
    });
    it('café - end of line', function() {
      xterm.x = xterm.cols - 1 - 3;
      xterm.write('cafe\u0301');
      expect(xterm.lines[0][xterm.cols-1][1]).eql('e\u0301');
      expect(xterm.lines[0][xterm.cols-1][1].length).eql(2);
      expect(xterm.lines[0][xterm.cols-1][2]).eql(1);
      expect(xterm.lines[0][1][1]).eql(' ');
      expect(xterm.lines[0][1][1].length).eql(1);
      expect(xterm.lines[0][1][2]).eql(1);
    });
    it('multiple combined é', function() {
      xterm.wraparoundMode = true;
      xterm.write(Array(100).join('e\u0301'));
      for (var i=0; i<xterm.cols; ++i) {
        var tchar = xterm.lines[0][i];
        expect(tchar[1]).eql('e\u0301');
        expect(tchar[1].length).eql(2);
        expect(tchar[2]).eql(1);
      }
      tchar = xterm.lines[1][0];
      expect(tchar[1]).eql('e\u0301');
      expect(tchar[1].length).eql(2);
      expect(tchar[2]).eql(1);
    });
    it('multiple surrogate with combined', function() {
      xterm.wraparoundMode = true;
      xterm.write(Array(100).join('\uD800\uDC00\u0301'));
      for (var i=0; i<xterm.cols; ++i) {
        var tchar = xterm.lines[0][i];
        expect(tchar[1]).eql('\uD800\uDC00\u0301');
        expect(tchar[1].length).eql(3);
        expect(tchar[2]).eql(1);
      }
      tchar = xterm.lines[1][0];
      expect(tchar[1]).eql('\uD800\uDC00\u0301');
      expect(tchar[1].length).eql(3);
      expect(tchar[2]).eql(1);
    });
  });

  describe('unicode - fullwidth characters', function() {
    it('cursor movement even', function() {
      expect(xterm.x).eql(0);
      xterm.write('￥');
      expect(xterm.x).eql(2);
    });
    it('cursor movement odd', function() {
      xterm.x = 1;
      expect(xterm.x).eql(1);
      xterm.write('￥');
      expect(xterm.x).eql(3);
    });
    it('line of ￥ even', function() {
      xterm.wraparoundMode = true;
      xterm.write(Array(50).join('￥'));
      for (var i=0; i<xterm.cols; ++i) {
        var tchar = xterm.lines[0][i];
        if (i % 2) {
          expect(tchar[1]).eql('');
          expect(tchar[1].length).eql(0);
          expect(tchar[2]).eql(0);
        } else {
          expect(tchar[1]).eql('￥');
          expect(tchar[1].length).eql(1);
          expect(tchar[2]).eql(2);
        }
      }
      tchar = xterm.lines[1][0];
      expect(tchar[1]).eql('￥');
      expect(tchar[1].length).eql(1);
      expect(tchar[2]).eql(2);
    });
    it('line of ￥ odd', function() {
      xterm.wraparoundMode = true;
      xterm.x = 1;
      xterm.write(Array(50).join('￥'));
      for (var i=1; i<xterm.cols-1; ++i) {
        var tchar = xterm.lines[0][i];
        if (!(i % 2)) {
          expect(tchar[1]).eql('');
          expect(tchar[1].length).eql(0);
          expect(tchar[2]).eql(0);
        } else {
          expect(tchar[1]).eql('￥');
          expect(tchar[1].length).eql(1);
          expect(tchar[2]).eql(2);
        }
      }
      tchar = xterm.lines[0][xterm.cols-1];
      expect(tchar[1]).eql(' ');
      expect(tchar[1].length).eql(1);
      expect(tchar[2]).eql(1);
      tchar = xterm.lines[1][0];
      expect(tchar[1]).eql('￥');
      expect(tchar[1].length).eql(1);
      expect(tchar[2]).eql(2);
    });
    it('line of ￥ with combining odd', function() {
      xterm.wraparoundMode = true;
      xterm.x = 1;
      xterm.write(Array(50).join('￥\u0301'));
      for (var i=1; i<xterm.cols-1; ++i) {
        var tchar = xterm.lines[0][i];
        if (!(i % 2)) {
          expect(tchar[1]).eql('');
          expect(tchar[1].length).eql(0);
          expect(tchar[2]).eql(0);
        } else {
          expect(tchar[1]).eql('￥\u0301');
          expect(tchar[1].length).eql(2);
          expect(tchar[2]).eql(2);
        }
      }
      tchar = xterm.lines[0][xterm.cols-1];
      expect(tchar[1]).eql(' ');
      expect(tchar[1].length).eql(1);
      expect(tchar[2]).eql(1);
      tchar = xterm.lines[1][0];
      expect(tchar[1]).eql('￥\u0301');
      expect(tchar[1].length).eql(2);
      expect(tchar[2]).eql(2);
    });
    it('line of ￥ with combining even', function() {
      xterm.wraparoundMode = true;
      xterm.write(Array(50).join('￥\u0301'));
      for (var i=0; i<xterm.cols; ++i) {
        var tchar = xterm.lines[0][i];
        if (i % 2) {
          expect(tchar[1]).eql('');
          expect(tchar[1].length).eql(0);
          expect(tchar[2]).eql(0);
        } else {
          expect(tchar[1]).eql('￥\u0301');
          expect(tchar[1].length).eql(2);
          expect(tchar[2]).eql(2);
        }
      }
      tchar = xterm.lines[1][0];
      expect(tchar[1]).eql('￥\u0301');
      expect(tchar[1].length).eql(2);
      expect(tchar[2]).eql(2);
    });
    it('line of surrogate fullwidth with combining odd', function() {
      xterm.wraparoundMode = true;
      xterm.x = 1;
      xterm.write(Array(50).join('\ud843\ude6d\u0301'));
      for (var i=1; i<xterm.cols-1; ++i) {
        var tchar = xterm.lines[0][i];
        if (!(i % 2)) {
          expect(tchar[1]).eql('');
          expect(tchar[1].length).eql(0);
          expect(tchar[2]).eql(0);
        } else {
          expect(tchar[1]).eql('\ud843\ude6d\u0301');
          expect(tchar[1].length).eql(3);
          expect(tchar[2]).eql(2);
        }
      }
      tchar = xterm.lines[0][xterm.cols-1];
      expect(tchar[1]).eql(' ');
      expect(tchar[1].length).eql(1);
      expect(tchar[2]).eql(1);
      tchar = xterm.lines[1][0];
      expect(tchar[1]).eql('\ud843\ude6d\u0301');
      expect(tchar[1].length).eql(3);
      expect(tchar[2]).eql(2);
    });
    it('line of surrogate fullwidth with combining even', function() {
      xterm.wraparoundMode = true;
      xterm.write(Array(50).join('\ud843\ude6d\u0301'));
      for (var i=0; i<xterm.cols; ++i) {
        var tchar = xterm.lines[0][i];
        if (i % 2) {
          expect(tchar[1]).eql('');
          expect(tchar[1].length).eql(0);
          expect(tchar[2]).eql(0);
        } else {
          expect(tchar[1]).eql('\ud843\ude6d\u0301');
          expect(tchar[1].length).eql(3);
          expect(tchar[2]).eql(2);
        }
      }
      tchar = xterm.lines[1][0];
      expect(tchar[1]).eql('\ud843\ude6d\u0301');
      expect(tchar[1].length).eql(3);
      expect(tchar[2]).eql(2);
    });
  });

  describe('insert mode', function() {
    it('halfwidth - all', function () {
      xterm.write(Array(9).join('0123456789').slice(-80));
      xterm.x = 10;
      xterm.y = 0;
      xterm.insertMode = true;
      xterm.write('abcde');
      expect(xterm.lines[0].length).eql(xterm.cols);
      expect(xterm.lines[0][10][1]).eql('a');
      expect(xterm.lines[0][14][1]).eql('e');
      expect(xterm.lines[0][15][1]).eql('0');
      expect(xterm.lines[0][79][1]).eql('4');
    });
    it('fullwidth - insert', function() {
      xterm.write(Array(9).join('0123456789').slice(-80));
      xterm.x = 10;
      xterm.y = 0;
      xterm.insertMode = true;
      xterm.write('￥￥￥');
      expect(xterm.lines[0].length).eql(xterm.cols);
      expect(xterm.lines[0][10][1]).eql('￥');
      expect(xterm.lines[0][11][1]).eql('');
      expect(xterm.lines[0][14][1]).eql('￥');
      expect(xterm.lines[0][15][1]).eql('');
      expect(xterm.lines[0][79][1]).eql('3');
    });
    it('fullwidth - right border', function() {
      xterm.write(Array(41).join('￥'));
      xterm.x = 10;
      xterm.y = 0;
      xterm.insertMode = true;
      xterm.write('a');
      expect(xterm.lines[0].length).eql(xterm.cols);
      expect(xterm.lines[0][10][1]).eql('a');
      expect(xterm.lines[0][11][1]).eql('￥');
      expect(xterm.lines[0][79][1]).eql(' ');  // fullwidth char got replaced
      xterm.write('b');
      expect(xterm.lines[0].length).eql(xterm.cols);
      expect(xterm.lines[0][11][1]).eql('b');
      expect(xterm.lines[0][12][1]).eql('￥');
      expect(xterm.lines[0][79][1]).eql('');  // empty cell after fullwidth
    });
  });
});
