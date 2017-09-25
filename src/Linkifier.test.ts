/**
 * Copyright (c) 2017 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import { assert } from 'chai';
import { ITerminal, ILinkifier, IBuffer, IBufferAccessor, IElementAccessor } from './Interfaces';
import { Linkifier } from './Linkifier';
import { LinkMatcher, LineData } from './Types';
import { IMouseZoneManager, IMouseZone } from './input/Interfaces';
import { MockBuffer } from './utils/TestUtils.test';
import { CircularList } from './utils/CircularList';

class TestLinkifier extends Linkifier {
  constructor(_terminal: IBufferAccessor & IElementAccessor) {
    super(_terminal);
    Linkifier.TIME_BEFORE_LINKIFY = 0;
  }

  public get linkMatchers(): LinkMatcher[] { return this._linkMatchers; }
  public linkifyRows(): void { super.linkifyRows(0, this._terminal.buffer.lines.length - 1); }
}

class TestMouseZoneManager implements IMouseZoneManager {
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
  let terminal: IBufferAccessor & IElementAccessor;
  let linkifier: TestLinkifier;
  let mouseZoneManager: TestMouseZoneManager;

  beforeEach(() => {
    terminal = {
      buffer: new MockBuffer(),
      element: <HTMLElement>{}
    };
    terminal.buffer.lines = new CircularList<LineData>(20);
    terminal.buffer.ydisp = 0;
    linkifier = new TestLinkifier(terminal);
    mouseZoneManager = new TestMouseZoneManager();
  });

  function stringToRow(text: string): LineData {
    let result: LineData = [];
    for (let i = 0; i < text.length; i++) {
      result.push([0, text.charAt(i), 1, text.charCodeAt(i)]);
    }
    return result;
  }

  function addRow(text: string): void {
    terminal.buffer.lines.push(stringToRow(text));
  }

  function assertLinkifiesEntireRow(uri: string, done: MochaDone): void {
    addRow(uri);
    linkifier.linkifyRows();
    setTimeout(() => {
      assert.equal(mouseZoneManager.zones[0].x1, 1);
      assert.equal(mouseZoneManager.zones[0].x2, uri.length + 1);
      assert.equal(mouseZoneManager.zones[0].y, terminal.buffer.lines.length);
      done();
    }, 0);
  }

  function assertLinkifiesRow(rowText: string, linkMatcherRegex: RegExp, links: {x: number, length: number}[], done: MochaDone): void {
    addRow(rowText);
    linkifier.registerLinkMatcher(linkMatcherRegex, () => {});
    linkifier.linkifyRows();
    // Allow linkify to happen
    setTimeout(() => {
      assert.equal(mouseZoneManager.zones.length, links.length);
      links.forEach((l, i) => {
        assert.equal(mouseZoneManager.zones[i].x1, l.x + 1);
        assert.equal(mouseZoneManager.zones[i].x2, l.x + l.length + 1);
        assert.equal(mouseZoneManager.zones[i].y, terminal.buffer.lines.length);
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

    describe('http links', () => {
      it('should allow ~ character in URI path', (done) => {
        assertLinkifiesEntireRow('http://foo.com/a~b#c~d?e~f', done);
      });
    });

    describe('link matcher', () => {
      it('should match a single link', done => {
        assertLinkifiesRow('foo', /foo/, [{x: 0, length: 3}], done);
      });
      it('should match a single link at the start of a text node', done => {
        assertLinkifiesRow('foo bar', /foo/, [{x: 0, length: 3}], done);
      });
      it('should match a single link in the middle of a text node', done => {
        assertLinkifiesRow('foo bar baz', /bar/, [{x: 4, length: 3}], done);
      });
      it('should match a single link at the end of a text node', done => {
        assertLinkifiesRow('foo bar', /bar/, [{x: 4, length: 3}], done);
      });
      it('should match a link after a link at the start of a text node', done => {
        assertLinkifiesRow('foo bar', /foo|bar/, [{x: 0, length: 3}, {x: 4, length: 3}], done);
      });
      it('should match a link after a link in the middle of a text node', done => {
        assertLinkifiesRow('foo bar baz', /bar|baz/, [{x: 4, length: 3}, {x: 8, length: 3}], done);
      });
      it('should match a link immediately after a link at the end of a text node', done => {
        assertLinkifiesRow('foo barbaz', /bar|baz/, [{x: 4, length: 3}, {x: 7, length: 3}], done);
      });
      it('should not duplicate text after a unicode character (wrapped in a span)', done => {
        // This is a regression test for an issue that came about when using
        // an oh-my-zsh theme that added the large blue diamond unicode
        // character (U+1F537) which caused the path to be duplicated. See #642.
        assertLinkifiesRow('echo \'🔷foo\'', /foo/, [{x: 8, length: 3}], done);
      });
    });

    describe('validationCallback', () => {
      it('should enable link if true', done => {
        addRow('test');
        linkifier.registerLinkMatcher(/test/, () => done(), {
          validationCallback: (url, cb) => {
            assert.equal(mouseZoneManager.zones.length, 0);
            cb(true);
            assert.equal(mouseZoneManager.zones.length, 1);
            assert.equal(mouseZoneManager.zones[0].x1, 1);
            assert.equal(mouseZoneManager.zones[0].x2, 5);
            assert.equal(mouseZoneManager.zones[0].y, 1);
            // Fires done()
            mouseZoneManager.zones[0].clickCallback(<any>{});
          }
        });
        linkifier.linkifyRows();
      });

      it('should validate the uri, not the row', done => {
        addRow('abc test abc');
        linkifier.registerLinkMatcher(/test/, () => done(), {
          validationCallback: (uri, cb) => {
            assert.equal(uri, 'test');
            done();
          }
        });
        linkifier.linkifyRows();
      });

      it('should disable link if false', done => {
        addRow('test');
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
        addRow('test test');
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
        assert.deepEqual(linkifier.linkMatchers.map(lm => lm.id), [aId, 0, bId]);
      });

      it('should order the list from highest priority to lowest #2', () => {
        const aId = linkifier.registerLinkMatcher(/a/, () => {}, { priority: -1 });
        const bId = linkifier.registerLinkMatcher(/b/, () => {}, { priority: 1 });
        assert.deepEqual(linkifier.linkMatchers.map(lm => lm.id), [bId, 0, aId]);
      });

      it('should order items of equal priority in the order they are added', () => {
        const aId = linkifier.registerLinkMatcher(/a/, () => {}, { priority: 0 });
        const bId = linkifier.registerLinkMatcher(/b/, () => {}, { priority: 0 });
        assert.deepEqual(linkifier.linkMatchers.map(lm => lm.id), [0, aId, bId]);
      });
    });
  });
});
