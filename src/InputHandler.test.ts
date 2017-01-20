import { assert } from 'chai';
import { InputHandler } from './InputHandler';

describe('InputHandler', () => {
  describe('setCursorStyle', () => {
    it('should call Terminal.setOption with correct params', () => {
      let options = {};
      let terminal = {
        setOption: (option, value) => options[option] = value
      };
      let inputHandler = new InputHandler(terminal);

      inputHandler.setCursorStyle([0]);
      assert.equal(options['cursorStyle'], 'block');
      assert.equal(options['cursorBlink'], true);

      options = {};
      inputHandler.setCursorStyle([1]);
      assert.equal(options['cursorStyle'], 'block');
      assert.equal(options['cursorBlink'], true);

      options = {};
      inputHandler.setCursorStyle([2]);
      assert.equal(options['cursorStyle'], 'block');
      assert.equal(options['cursorBlink'], false);

      options = {};
      inputHandler.setCursorStyle([3]);
      assert.equal(options['cursorStyle'], 'underline');
      assert.equal(options['cursorBlink'], true);

      options = {};
      inputHandler.setCursorStyle([4]);
      assert.equal(options['cursorStyle'], 'underline');
      assert.equal(options['cursorBlink'], false);

      options = {};
      inputHandler.setCursorStyle([5]);
      assert.equal(options['cursorStyle'], 'bar');
      assert.equal(options['cursorBlink'], true);

      options = {};
      inputHandler.setCursorStyle([6]);
      assert.equal(options['cursorStyle'], 'bar');
      assert.equal(options['cursorBlink'], false);

    });
  });
});
