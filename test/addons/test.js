var assert = require('chai').assert;
var Xterm = require('../../dist/xterm');

describe('xterm.js addons', function() {
  it('should load addons with Terminal.loadAddon', function () {
    Xterm.Terminal.loadAddon('attach');
    // Test that function was loaded successfully
    assert.equal(typeof Xterm.Terminal.prototype.attach, 'function');
  });
});
