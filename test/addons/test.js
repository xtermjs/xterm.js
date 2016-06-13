var assert = require('chai').assert;
var Terminal = require('../../src/xterm');

describe('xterm.js addons', function() {
  it('should load addons with Terminal.loadAddon', function () {
    Terminal.loadAddon('attach');
    // Test that function was loaded successfully
    assert.equal(typeof Terminal.prototype.attach, 'function');
  });
});
