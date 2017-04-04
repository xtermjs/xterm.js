/**
 * @license MIT
 */
import jsdom = require('jsdom');
import { assert } from 'chai';
import { ITerminal, ILinkifier } from './Interfaces';
import { Linkifier } from './Linkifier';
import { LinkMatcher } from './Types';

class TestLinkifier extends Linkifier {
  constructor() {
    Linkifier.TIME_BEFORE_LINKIFY = 0;
    super();
  }

  public get linkMatchers(): LinkMatcher[] { return this._linkMatchers; }
}

describe('Linkifier', () => {
  let window: Window;
  let document: Document;

  let container: HTMLElement;
  let rows: HTMLElement[];
  let linkifier: TestLinkifier;

  beforeEach(done => {
    jsdom.env('', (err, w) => {
      window = w;
      document = window.document;
      linkifier = new TestLinkifier();
      done();
    });
  });

  function addRow(html: string) {
    const element = document.createElement('div');
    element.innerHTML = html;
    container.appendChild(element);
    rows.push(element);
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
      rows = [];
      linkifier.attachToDom(document, rows);
      container = document.createElement('div');
      document.body.appendChild(container);
    });

    function clickElement(element: Node) {
      const event = document.createEvent('MouseEvent');
      event.initMouseEvent('click', true, true, window, 0, 0, 0, 0, 0, false, false, false, false, 0, null);
      element.dispatchEvent(event);
    }

    function assertLinkifiesEntireRow(uri: string, done: MochaDone) {
        addRow(uri);
        linkifier.linkifyRow(0);
        setTimeout(() => {
          assert.equal((<HTMLElement>rows[0].firstChild).tagName, 'A');
          assert.equal((<HTMLElement>rows[0].firstChild).textContent, uri);
          done();
        }, 0);
    }

    describe('http links', () => {
      function assertLinkifiesEntireRow(uri: string, done: MochaDone) {
        addRow(uri);
        linkifier.linkifyRow(0);
        setTimeout(() => {
          assert.equal((<HTMLElement>rows[0].firstChild).tagName, 'A');
          assert.equal((<HTMLElement>rows[0].firstChild).textContent, uri);
          done();
        }, 0);
      }
      it('should allow ~ character in URI path', done => assertLinkifiesEntireRow('http://foo.com/a~b#c~d?e~f', done));
    });

    describe('link matcher', () => {
      function assertLinkifiesRow(rowText: string, linkMatcherRegex: RegExp, expectedHtml: string, done: MochaDone) {
        addRow(rowText);
        linkifier.registerLinkMatcher(linkMatcherRegex, () => {});
        linkifier.linkifyRow(0);
        // Allow linkify to happen
        setTimeout(() => {
          assert.equal(rows[0].innerHTML, expectedHtml);
          done();
        }, 0);
      }
      it('should match a single link', done => {
        assertLinkifiesRow('foo', /foo/, '<a>foo</a>', done);
      });
      it('should match a single link at the start of a text node', done => {
        assertLinkifiesRow('foo bar', /foo/, '<a>foo</a> bar', done);
      });
      it('should match a single link in the middle of a text node', done => {
        assertLinkifiesRow('foo bar baz', /bar/, 'foo <a>bar</a> baz', done);
      });
      it('should match a single link at the end of a text node', done => {
        assertLinkifiesRow('foo bar', /bar/, 'foo <a>bar</a>', done);
      });
      it('should match a link after a link at the start of a text node', done => {
        assertLinkifiesRow('foo bar', /foo|bar/, '<a>foo</a> <a>bar</a>', done);
      });
      it('should match a link after a link in the middle of a text node', done => {
        assertLinkifiesRow('foo bar baz', /bar|baz/, 'foo <a>bar</a> <a>baz</a>', done);
      });
      it('should match a link immediately after a link at the end of a text node', done => {
        assertLinkifiesRow('<span>foo bar</span>baz', /bar|baz/, '<span>foo <a>bar</a></span><a>baz</a>', done);
      });
    });

    describe('validationCallback', () => {
      it('should enable link if true', done => {
        addRow('test');
        linkifier.registerLinkMatcher(/test/, () => done(), {
          validationCallback: (url, element, cb) => {
            cb(true);
            assert.equal((<HTMLElement>rows[0].firstChild).tagName, 'A');
            setTimeout(() => clickElement(rows[0].firstChild), 0);
          }
        });
        linkifier.linkifyRow(0);
      });

      it('should disable link if false', done => {
        addRow('test');
        linkifier.registerLinkMatcher(/test/, () => assert.fail(), {
          validationCallback: (url, element, cb) => {
            cb(false);
            assert.equal((<HTMLElement>rows[0].firstChild).tagName, 'A');
            setTimeout(() => clickElement(rows[0].firstChild), 0);
          }
        });
        linkifier.linkifyRow(0);
        // Allow time for the click to be performed
        setTimeout(() => done(), 10);
      });

      it('should trigger for multiple link matches on one row', done => {
        addRow('test test');
        let count = 0;
        linkifier.registerLinkMatcher(/test/, () => assert.fail(), {
          validationCallback: (url, element, cb) => {
            count += 1;
            if (count === 2) {
              done();
            }
            cb(false);
          }
        });
        linkifier.linkifyRow(0);
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
