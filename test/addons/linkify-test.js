var assert = require('chai').assert;
var Terminal = require('../../dist/xterm');
var linkify = require('../../addons/linkify/linkify');

describe('linkify addon', function () {
  var xterm;

  describe('API', function () {
    it('should define Terminal.prototype.linkify', function () {
      assert.isDefined(Terminal.prototype.linkify);
    });
    it('should define Terminal.prototype.linkifyTerminalLine', function () {
      assert.isDefined(Terminal.prototype.linkifyTerminalLine);
    });
  });

  describe('findUrlMatchOnLine', function () {
    describe('strict regex', function () {
      it('should match when the entire text is a match', function () {
        assert.equal(linkify.findLinkMatch('http://github.com', false), 'http://github.com');
        assert.equal(linkify.findLinkMatch('http://127.0.0.1', false), 'http://127.0.0.1');
      });
      it('should match simple domains', function () {
        assert.equal(linkify.findLinkMatch('foo http://github.com bar', false), 'http://github.com');
        assert.equal(linkify.findLinkMatch('foo http://www.github.com bar', false), 'http://www.github.com');
        assert.equal(linkify.findLinkMatch('foo https://github.com bar', false), 'https://github.com');
        assert.equal(linkify.findLinkMatch('foo https://www.github.com bar', false), 'https://www.github.com');
      });
      it('should match web addresses with alpha paths', function () {
        assert.equal(linkify.findLinkMatch('foo http://github.com/a/b/c bar', false), 'http://github.com/a/b/c');
        assert.equal(linkify.findLinkMatch('foo http://www.github.com/a/b/c bar', false), 'http://www.github.com/a/b/c');
      });
      it('should not include whitespace surrounding a match', function () {
        assert.equal(linkify.findLinkMatch(' http://github.com', false), 'http://github.com');
        assert.equal(linkify.findLinkMatch('http://github.com ', false), 'http://github.com');
        assert.equal(linkify.findLinkMatch('  http://github.com  ', false), 'http://github.com');
      });
      it('should match IP addresses', function () {
        assert.equal(linkify.findLinkMatch('foo http://127.0.0.1 bar', false), 'http://127.0.0.1');
        assert.equal(linkify.findLinkMatch('foo https://127.0.0.1 bar', false), 'https://127.0.0.1');
      });
      it('should match ports on both domains and IP addresses', function () {
        assert.equal(linkify.findLinkMatch('foo http://127.0.0.1:8080 bar', false), 'http://127.0.0.1:8080');
        assert.equal(linkify.findLinkMatch('foo http://www.github.com:8080 bar', false), 'http://www.github.com:8080');
      });
    });
  });
});
