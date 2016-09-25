var assert = require('chai').assert;
var Terminal = require('../src/xterm');

describe('Viewport', function () {
  var terminal;
  var viewportElement;
  var charMeasureElement;
  var viewport;
  var scrollAreaElement;

  var CHARACTER_HEIGHT = 10;

  beforeEach(function () {
    terminal = {
      lines: [],
      rows: 0,
      ydisp: 0,
      on: function () {},
      rowContainer: {
        style: {
          lineHeight: 0
        }
      }
    };
    viewportElement = {
      addEventListener: function () {},
      style: {
        height: 0,
        lineHeight: 0
      }
    };
    scrollAreaElement = {
      style: {
        height: 0
      }
    };
    charMeasureElement = {
      getBoundingClientRect: function () {
        return { width: null, height: CHARACTER_HEIGHT };
      }
    };
    viewport = new Terminal.Viewport(terminal, viewportElement, scrollAreaElement, charMeasureElement);
  });

  describe('Public API', function () {
    it('should define Viewport.prototype.onWheel', function () {
      assert.isDefined(Terminal.Viewport.prototype.onWheel);
    });
  });

  describe('refresh', function () {
    it('should set the line-height of the terminal', function () {
      assert.equal(viewportElement.style.lineHeight, CHARACTER_HEIGHT + 'px');
      assert.equal(terminal.rowContainer.style.lineHeight, CHARACTER_HEIGHT + 'px');
      charMeasureElement.getBoundingClientRect = function () {
        return { width: null, height: 1 };
      };
      viewport.refresh();
      assert.equal(viewportElement.style.lineHeight, '1px');
      assert.equal(terminal.rowContainer.style.lineHeight, '1px');
    });
    it('should set the height of the viewport when the line-height changed', function () {
      terminal.lines.push('');
      terminal.lines.push('');
      terminal.rows = 1;
      viewport.refresh();
      assert.equal(viewportElement.style.height, 1 * CHARACTER_HEIGHT + 'px');
      charMeasureElement.getBoundingClientRect = function () {
        return { width: null, height: 20 };
      };
      viewport.refresh();
      assert.equal(viewportElement.style.height, 20 + 'px');
    });
  });

  describe('syncScrollArea', function () {
    it('should sync the scroll area', function () {
      terminal.lines.push('');
      terminal.rows = 1;
      assert.equal(scrollAreaElement.style.height, 0 * CHARACTER_HEIGHT + 'px');
      viewport.syncScrollArea();
      assert.equal(viewportElement.style.height, 1 * CHARACTER_HEIGHT + 'px');
      assert.equal(scrollAreaElement.style.height, 1 * CHARACTER_HEIGHT + 'px');
      terminal.lines.push('');
      viewport.syncScrollArea();
      assert.equal(viewportElement.style.height, 1 * CHARACTER_HEIGHT + 'px');
      assert.equal(scrollAreaElement.style.height, 2 * CHARACTER_HEIGHT + 'px');
    });
  });
});
