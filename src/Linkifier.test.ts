/**
 * @license MIT
 */
import jsdom = require('jsdom');
import { assert } from 'chai';
import { ITerminal, ILinkifier } from './Interfaces';
import { Linkifier } from './Linkifier';
import { LinkMatcher } from './Types';

class TestLinkifier extends Linkifier {
  constructor(document: Document, rows: HTMLElement[]) {
    Linkifier.TIME_BEFORE_LINKIFY = 0;
    super(document, rows);
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
    rows = [];
    jsdom.env('', (err, w) => {
      window = w;
      document = window.document;
      linkifier = new TestLinkifier(document, rows);
      container = document.createElement('div');
      document.body.appendChild(container);
      done();
    });
  });

  function addRow(text: string) {
    const element = document.createElement('div');
    element.textContent = text;
    container.appendChild(element);
    rows.push(element);
  }

  function clickElement(element: Node) {
    const event = document.createEvent('MouseEvent');
    event.initMouseEvent('click', true, true, window, 0, 0, 0, 0, 0, false, false, false, false, 0, null);
    element.dispatchEvent(event);
  }

  describe('validationCallback', () => {
    it('should enable link if true', done => {
      addRow('test');
      linkifier.registerLinkMatcher(/test/, () => done(), {
        validationCallback: (url, cb) => {
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
        validationCallback: (url, cb) => {
          cb(false);
          assert.equal((<HTMLElement>rows[0].firstChild).tagName, 'A');
          setTimeout(() => clickElement(rows[0].firstChild), 0);
        }
      });
      linkifier.linkifyRow(0);
      // Allow time for the click to be performed
      setTimeout(() => done(), 10);
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
