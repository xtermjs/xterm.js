/**
 * @license MIT
 */
import { ICharMeasure, ITerminal } from '../Interfaces';

declare var assert: Chai.Assert;
declare var Terminal: ITerminal;

// Do not describe tests unless in PhantomJS environment
if (typeof Terminal !== 'undefined') {

  const CharMeasure = (<any>Terminal).CharMeasure;

  describe('CharMeasure', () => {
    const parentElement = document.createElement('div');
    let charMeasure: ICharMeasure;

    beforeEach(() => {
      charMeasure = new CharMeasure(parentElement);
      document.querySelector('#xterm').appendChild(parentElement);
    });

    afterEach(() => {
      if (parentElement && parentElement.parentElement) {
        parentElement.parentElement.removeChild(parentElement);
      }
    });

    describe('measure', () => {
      it('should be performed async on first call', done => {
        assert.equal(charMeasure.width, null);
        charMeasure.measure();
        assert.equal(charMeasure.width, null);
        setTimeout(() => {
          assert.isTrue(charMeasure.width > 0);
          done();
        }, 0);
      });

      it('should be performed sync on successive calls', done => {
        charMeasure.measure();
        setTimeout(() => {
          const firstWidth = charMeasure.width;
          parentElement.style.fontSize = '2em';
          charMeasure.measure();
          assert.equal(charMeasure.width, firstWidth * 2);
          done();
        }, 0);
      });

      it('should NOT do a measure when the parent is hidden', done => {
        charMeasure.measure();
        setTimeout(() => {
          const firstWidth = charMeasure.width;
          parentElement.style.display = 'none';
          parentElement.style.fontSize = '2em';
          charMeasure.measure();
          assert.equal(charMeasure.width, firstWidth);
          done();
        }, 0);
      });
    });
  });

}
