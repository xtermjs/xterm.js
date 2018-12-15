/**
 * Copyright (c) 2017 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import { assert } from 'chai';
import { IMouseZoneManager, IMouseZone } from './ui/Types';
import { ILinkMatcher, ITerminal } from './Types';
import { Linkifier } from './Linkifier';
import { getStringCellWidth } from './CharWidth';
import { TestTerminal } from './ui/TestUtils.test';

class TestLinkifier extends Linkifier {
  constructor(terminal: ITerminal) {
    super(terminal);
    (<any>Linkifier).TIME_BEFORE_LINKIFY = 0;
  }

  public get linkMatchers(): ILinkMatcher[] { return this._linkMatchers; }
  public linkifyRows(): void { super.linkifyRows(0, this._terminal.buffer.lines.length - 1); }
}

class TestMouseZoneManager implements IMouseZoneManager {
  dispose(): void {
  }
  public clears: number = 0;
  public zones: IMouseZone[] = [];
  add(zone: IMouseZone): void {
    this.zones.push(zone);
  }
  clearAll(): void {
    this.clears++;
  }
}

describe('Linkifier', () => {
  let terminal: TestTerminal;
  let linkifier: TestLinkifier;
  let mouseZoneManager: TestMouseZoneManager;

  beforeEach(() => {
    terminal = new TestTerminal({cols: 100, rows: 10});
    linkifier = new TestLinkifier(terminal);
    mouseZoneManager = new TestMouseZoneManager();
    linkifier.attachToDom(mouseZoneManager);
  });

  function assertLinkifiesInTerminalRow(terminal: TestTerminal, rowText: string, linkMatcherRegex: RegExp, links: {x: number, length: number}[], done: MochaDone): void {
    terminal.writeSync(rowText);
    linkifier.registerLinkMatcher(linkMatcherRegex, () => {});
    linkifier.linkifyRows();
    // Allow linkify to happen
    setTimeout(() => {
      assert.equal(mouseZoneManager.zones.length, links.length);
      links.forEach((l, i) => {
        assert.equal(mouseZoneManager.zones[i].x1, l.x + 1);
        assert.equal(mouseZoneManager.zones[i].x2, l.x + l.length + 1);
        assert.equal(mouseZoneManager.zones[i].y1, 1);
        assert.equal(mouseZoneManager.zones[i].y2, 1);
      });
      done();
    }, 0);
  }

  function assertLinkifiesInTerminal(terminal: TestTerminal, rowText: string, linkMatcherRegex: RegExp, links: {x1: number, y1: number, x2: number, y2: number}[], done: MochaDone): void {
    terminal.writeSync(rowText);
    linkifier.registerLinkMatcher(linkMatcherRegex, () => {});
    linkifier.linkifyRows();
    // Allow linkify to happen
    setTimeout(() => {
      assert.equal(mouseZoneManager.zones.length, links.length);
      links.forEach((l, i) => {
        assert.equal(mouseZoneManager.zones[i].x1, l.x1 + 1);
        assert.equal(mouseZoneManager.zones[i].x2, l.x2 + 1);
        assert.equal(mouseZoneManager.zones[i].y1, l.y1 + 1);
        assert.equal(mouseZoneManager.zones[i].y2, l.y2 + 1);
      });
      done();
    }, 0);
  }

  describe('before attachToDom', () => {
    it('should allow link matcher registration', done => {
      assert.doesNotThrow(() => {
        const linkMatcherId = linkifier.registerLinkMatcher(/foo/, () => {});
        assert.isTrue(linkifier.deregisterLinkMatcher(linkMatcherId));
        done();
      });
    });
  });

  describe('after attachToDom', () => {
    beforeEach(() => {
      linkifier.attachToDom(mouseZoneManager);
    });

    describe('link matcher', () => {
      it('should match a single link', done => {
        assertLinkifiesInTerminalRow(terminal, 'foo', /foo/, [{x: 0, length: 3}], done);
      });
      it('should match a single link at the start of a text node', done => {
        assertLinkifiesInTerminalRow(terminal, 'foo bar', /foo/, [{x: 0, length: 3}], done);
      });
      it('should match a single link in the middle of a text node', done => {
        assertLinkifiesInTerminalRow(terminal, 'foo bar baz', /bar/, [{x: 4, length: 3}], done);
      });
      it('should match a single link at the end of a text node', done => {
        assertLinkifiesInTerminalRow(terminal, 'foo bar', /bar/, [{x: 4, length: 3}], done);
      });
      it('should match a link after a link at the start of a text node', done => {
        assertLinkifiesInTerminalRow(terminal, 'foo bar', /foo|bar/, [{x: 0, length: 3}, {x: 4, length: 3}], done);
      });
      it('should match a link after a link in the middle of a text node', done => {
        assertLinkifiesInTerminalRow(terminal, 'foo bar baz', /bar|baz/, [{x: 4, length: 3}, {x: 8, length: 3}], done);
      });
      it('should match a link immediately after a link at the end of a text node', done => {
        assertLinkifiesInTerminalRow(terminal, 'foo barbaz', /bar|baz/, [{x: 4, length: 3}, {x: 7, length: 3}], done);
      });
      it('should not duplicate text after a unicode character (wrapped in a span)', done => {
        // This is a regression test for an issue that came about when using
        // an oh-my-zsh theme that added the large blue diamond unicode
        // character (U+1F537) which caused the path to be duplicated. See #642.
        const charWidth = getStringCellWidth('🔷'); // FIXME: make unicode version dependent
        assertLinkifiesInTerminalRow(terminal, 'echo \'🔷foo\'', /foo/, [{x: 6 + charWidth, length: 3}], done);
      });
      describe('multi-line links', () => {
        let terminal: TestTerminal;
        beforeEach(() => {
          terminal = new TestTerminal({cols: 4, rows: 10});
          linkifier = new TestLinkifier(terminal);
          mouseZoneManager = new TestMouseZoneManager();
          linkifier.attachToDom(mouseZoneManager);
        });

        it('should match links that start on line 1/2 of a wrapped line and end on the last character of line 1/2', done => {
          assertLinkifiesInTerminal(terminal, '12345', /1234/, [{x1: 0, x2: 4, y1: 0, y2: 0}], done);
        });
        it('should match links that start on line 1/2 of a wrapped line and wrap to line 2/2', done => {
          assertLinkifiesInTerminal(terminal, '12345', /12345/, [{x1: 0, x2: 1, y1: 0, y2: 1}], done);
        });
        it('should match links that start and end on line 2/2 of a wrapped line', done => {
          assertLinkifiesInTerminal(terminal, '12345678', /5678/, [{x1: 0, x2: 4, y1: 1, y2: 1}], done);
        });
        it('should match links that start on line 2/3 of a wrapped line and wrap to line 3/3', done => {
          assertLinkifiesInTerminal(terminal, '123456789', /56789/, [{x1: 0, x2: 1, y1: 1, y2: 2}], done);
        });
      });
    });

    describe('validationCallback', () => {
      it('should enable link if true', done => {
        terminal.writeSync('test');
        linkifier.registerLinkMatcher(/test/, () => done(), {
          validationCallback: (url, cb) => {
            assert.equal(mouseZoneManager.zones.length, 0);
            cb(true);
            assert.equal(mouseZoneManager.zones.length, 1);
            assert.equal(mouseZoneManager.zones[0].x1, 1);
            assert.equal(mouseZoneManager.zones[0].x2, 5);
            assert.equal(mouseZoneManager.zones[0].y1, 1);
            assert.equal(mouseZoneManager.zones[0].y2, 1);
            // Fires done()
            mouseZoneManager.zones[0].clickCallback(<any>{});
          }
        });
        linkifier.linkifyRows();
      });

      it('should validate the uri, not the row', done => {
        terminal.writeSync('abc test abc');
        linkifier.registerLinkMatcher(/test/, () => done(), {
          validationCallback: (uri, cb) => {
            assert.equal(uri, 'test');
            done();
          }
        });
        linkifier.linkifyRows();
      });

      it('should disable link if false', done => {
        terminal.writeSync('test');
        linkifier.registerLinkMatcher(/test/, () => assert.fail(), {
          validationCallback: (url, cb) => {
            assert.equal(mouseZoneManager.zones.length, 0);
            cb(false);
            assert.equal(mouseZoneManager.zones.length, 0);
          }
        });
        linkifier.linkifyRows();
        // Allow time for the validation callback to be performed
        setTimeout(() => done(), 10);
      });

      it('should trigger for multiple link matches on one row', done => {
        terminal.writeSync('test test');
        let count = 0;
        linkifier.registerLinkMatcher(/test/, () => assert.fail(), {
          validationCallback: (url, cb) => {
            count += 1;
            if (count === 2) {
              done();
            }
            cb(false);
          }
        });
        linkifier.linkifyRows();
      });
    });

    describe('priority', () => {
      it('should order the list from highest priority to lowest #1', () => {
        const aId = linkifier.registerLinkMatcher(/a/, () => {}, { priority: 1 });
        const bId = linkifier.registerLinkMatcher(/b/, () => {}, { priority: -1 });
        assert.deepEqual(linkifier.linkMatchers.map(lm => lm.id), [aId, bId]);
      });

      it('should order the list from highest priority to lowest #2', () => {
        const aId = linkifier.registerLinkMatcher(/a/, () => {}, { priority: -1 });
        const bId = linkifier.registerLinkMatcher(/b/, () => {}, { priority: 1 });
        assert.deepEqual(linkifier.linkMatchers.map(lm => lm.id), [bId, aId]);
      });

      it('should order items of equal priority in the order they are added', () => {
        const aId = linkifier.registerLinkMatcher(/a/, () => {}, { priority: 0 });
        const bId = linkifier.registerLinkMatcher(/b/, () => {}, { priority: 0 });
        assert.deepEqual(linkifier.linkMatchers.map(lm => lm.id), [aId, bId]);
      });
    });
  });
  describe('unicode handling', () => {
    let terminal: TestTerminal;

    beforeEach(() => {
      terminal = new TestTerminal({cols: 10, rows: 5});
      linkifier = new TestLinkifier(terminal);
      mouseZoneManager = new TestMouseZoneManager();
      linkifier.attachToDom(mouseZoneManager);
    });

    describe('unicode before the match', () => {
      it('combining - match within one line', function(done: () => void): void {
        assertLinkifiesInTerminal(terminal, 'e\u0301e\u0301e\u0301 foo', /foo/, [{x1: 4, x2: 7, y1: 0, y2: 0}], done);
      });
      it('combining - match over two lines', function(done: () => void): void {
        assertLinkifiesInTerminal(terminal, 'e\u0301e\u0301e\u0301     foo', /foo/, [{x1: 8, x2: 1, y1: 0, y2: 1}], done);
      });
      it('surrogate - match within one line', function(done: () => void): void {
        assertLinkifiesInTerminal(terminal, '𝄞𝄞𝄞 foo', /foo/, [{x1: 4, x2: 7, y1: 0, y2: 0}], done);
      });
      it('surrogate - match over two lines', function(done: () => void): void {
        assertLinkifiesInTerminal(terminal, '𝄞𝄞𝄞     foo', /foo/, [{x1: 8, x2: 1, y1: 0, y2: 1}], done);
      });
      it('combining surrogate - match within one line', function(done: () => void): void {
        assertLinkifiesInTerminal(terminal, '𓂀\u0301𓂀\u0301𓂀\u0301 foo', /foo/, [{x1: 4, x2: 7, y1: 0, y2: 0}], done);
      });
      it('combining surrogate - match over two lines', function(done: () => void): void {
        assertLinkifiesInTerminal(terminal, '𓂀\u0301𓂀\u0301𓂀\u0301     foo', /foo/, [{x1: 8, x2: 1, y1: 0, y2: 1}], done);
      });
      it('fullwidth - match within one line', function(done: () => void): void {
        assertLinkifiesInTerminal(terminal, '１２ foo', /foo/, [{x1: 5, x2: 8, y1: 0, y2: 0}], done);
      });
      it('fullwidth - match over two lines', function(done: () => void): void {
        assertLinkifiesInTerminal(terminal, '１２    foo', /foo/, [{x1: 8, x2: 1, y1: 0, y2: 1}], done);
      });
      it('combining fullwidth - match within one line', function(done: () => void): void {
        assertLinkifiesInTerminal(terminal, '￥\u0301￥\u0301 foo', /foo/, [{x1: 5, x2: 8, y1: 0, y2: 0}], done);
      });
      it('combining fullwidth - match over two lines', function(done: () => void): void {
        assertLinkifiesInTerminal(terminal, '￥\u0301￥\u0301    foo', /foo/, [{x1: 8, x2: 1, y1: 0, y2: 1}], done);
      });
    });
    describe('unicode within the match', () => {
      it('combining - match within one line', function(done: () => void): void {
        assertLinkifiesInTerminal(terminal, 'test cafe\u0301', /cafe\u0301/, [{x1: 5, x2: 9, y1: 0, y2: 0}], done);
      });
      it('combining - match over two lines', function(done: () => void): void {
        assertLinkifiesInTerminal(terminal, 'testtest cafe\u0301', /cafe\u0301/, [{x1: 9, x2: 3, y1: 0, y2: 1}], done);
      });
      it('surrogate - match within one line', function(done: () => void): void {
        assertLinkifiesInTerminal(terminal, 'test a𝄞b', /a𝄞b/, [{x1: 5, x2: 8, y1: 0, y2: 0}], done);
      });
      it('surrogate - match over two lines', function(done: () => void): void {
        assertLinkifiesInTerminal(terminal, 'testtest a𝄞b', /a𝄞b/, [{x1: 9, x2: 2, y1: 0, y2: 1}], done);
      });
      it('combining surrogate - match within one line', function(done: () => void): void {
        assertLinkifiesInTerminal(terminal, 'test a𓂀\u0301b', /a𓂀\u0301b/, [{x1: 5, x2: 8, y1: 0, y2: 0}], done);
      });
      it('combining surrogate - match over two lines', function(done: () => void): void {
        assertLinkifiesInTerminal(terminal, 'testtest a𓂀\u0301b', /a𓂀\u0301b/, [{x1: 9, x2: 2, y1: 0, y2: 1}], done);
      });
      it('fullwidth - match within one line', function(done: () => void): void {
        assertLinkifiesInTerminal(terminal, 'test a１b', /a１b/, [{x1: 5, x2: 9, y1: 0, y2: 0}], done);
      });
      it('fullwidth - match over two lines', function(done: () => void): void {
        assertLinkifiesInTerminal(terminal, 'testtest a１b', /a１b/, [{x1: 9, x2: 3, y1: 0, y2: 1}], done);
      });
      it('combining fullwidth - match within one line', function(done: () => void): void {
        assertLinkifiesInTerminal(terminal, 'test a￥\u0301b', /a￥\u0301b/, [{x1: 5, x2: 9, y1: 0, y2: 0}], done);
      });
      it('combining fullwidth - match over two lines', function(done: () => void): void {
        assertLinkifiesInTerminal(terminal, 'testtest a￥\u0301b', /a￥\u0301b/, [{x1: 9, x2: 3, y1: 0, y2: 1}], done);
      });
    });
  });
});
