var assert = require('chai').assert;
var Terminal = require('../../Terminal');

describe('xterm.js addons', function() {
  it('should load addons with Terminal.loadAddon', function () {
    Terminal.loadAddon('attach');
    // Test that addon was loaded successfully
    assert.equal(typeof Terminal.prototype.attach, 'function');
  });
});
