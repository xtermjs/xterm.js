/**
 * @license MIT
 */
import { ITerminal, ILinkifier } from './Interfaces';

declare var assert: Chai.Assert;
declare var Terminal: ITerminal;

// Do not describe tests unless in PhantomJS environment
if (typeof Terminal !== 'undefined') {

  const Linkifier = (<any>Terminal).Linkifier;
  Linkifier.setTimeBeforeLinkifyForTest(0);

  describe('Linkifier', () => {
    let container: HTMLElement;
    let rows: HTMLElement[];
    let linkifier: ILinkifier;

    beforeEach(() => {
      container = document.createElement('div');
      document.querySelector('#xterm').appendChild(container);
      rows = [];
      linkifier = new Linkifier(rows);
    });

    afterEach(() => {
      while (rows.length) {
        container.removeChild(rows.pop());
      }
      document.querySelector('#xterm').removeChild(container);
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
  });

}
