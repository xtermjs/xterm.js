var assert = require('chai').assert;
var Terminal = require('../../src/xterm');
var distTerminal = require('../../dist/xterm');

describe('xterm.js addons', function() {
  it('should load addons with Terminal.loadAddon', function () {
    Terminal.loadAddon('attach');
    // Test that addon was loaded successfully
    assert.equal(typeof distTerminal.prototype.attach, 'function');
  });
});
