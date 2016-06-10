var assert = require('chai').assert;
var Terminal = require('../src/xterm');

describe('xterm.js', function() {
  var xterm;

  beforeEach(function () {
    xterm = new Terminal();
  });

  describe('evaluateKeyEscapeSequence', function() {
    it('should return \\x1b[5D when ctrl+left is passed', function() {
      var event = { ctrlKey: true, keyCode: 37 };
      assert.equal(xterm.evaluateKeyEscapeSequence(event).key, '\x1b[5D');
    });
    it('should return \\x1b[5C when ctrl+right is passed', function() {
      var event = { ctrlKey: true, keyCode: 39 };
      assert.equal(xterm.evaluateKeyEscapeSequence(event).key, '\x1b[5C');
    });
  });
});
