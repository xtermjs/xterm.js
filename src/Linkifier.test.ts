/**
 * Copyright (c) 2017 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import { assert } from 'chai';
import { IMouseZoneManager, IMouseZone } from './input/Types';
import { ILinkMatcher, LineData, ITerminal } from './Types';
import { Linkifier } from './Linkifier';
import { MockBuffer, MockTerminal } from './utils/TestUtils.test';
import { CircularList } from './utils/CircularList';

class TestLinkifier extends Linkifier {
  constructor(_terminal: ITerminal) {
    super(_terminal);
    Linkifier.TIME_BEFORE_LINKIFY = 0;
  }

  public get linkMatchers(): ILinkMatcher[] { return this._linkMatchers; }
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
  let terminal: ITerminal;
  let linkifier: TestLinkifier;
  let mouseZoneManager: TestMouseZoneManager;

  beforeEach(() => {
    terminal = new MockTerminal();
    terminal.cols = 100;
    terminal.buffer = new MockBuffer();
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
        assert.equal(mouseZoneManager.zones[i].y1, terminal.buffer.lines.length);
        assert.equal(mouseZoneManager.zones[i].y2, terminal.buffer.lines.length);
      });
      done();
    }, 0);
  }

  function assertLinkifiesMultiLineLink(rowText: string, linkMatcherRegex: RegExp, links: {x1: number, y1: number, x2: number, y2: number}[], done: MochaDone): void {
    addRow(rowText);
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
      describe('multi-line links', () => {
        it('should match links that start on line 1/2 of a wrapped line and end on the last character of line 1/2', done => {
          terminal.cols = 4;
          assertLinkifiesMultiLineLink('12345', /1234/, [{x1: 0, x2: 4, y1: 0, y2: 0}], done);
        });
        it('should match links that start on line 1/2 of a wrapped line and wrap to line 2/2', done => {
          terminal.cols = 4;
          assertLinkifiesMultiLineLink('12345', /12345/, [{x1: 0, x2: 1, y1: 0, y2: 1}], done);
        });
        it('should match links that start and end on line 2/2 of a wrapped line', done => {
          terminal.cols = 4;
          assertLinkifiesMultiLineLink('12345678', /5678/, [{x1: 0, x2: 4, y1: 1, y2: 1}], done);
        });
        it('should match links that start on line 2/3 of a wrapped line and wrap to line 3/3', done => {
          terminal.cols = 4;
          assertLinkifiesMultiLineLink('123456789', /56789/, [{x1: 0, x2: 1, y1: 1, y2: 2}], done);
        });
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
            assert.equal(mouseZoneManager.zones[0].y1, 1);
            assert.equal(mouseZoneManager.zones[0].y2, 1);
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
});
