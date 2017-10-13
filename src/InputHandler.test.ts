/**
 * Copyright (c) 2017 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import { assert } from 'chai';
import { InputHandler } from './InputHandler';
import { wcwidth } from './InputHandler';
import { MockInputHandlingTerminal } from './utils/TestUtils.test';

describe('InputHandler', () => {
  describe('save and restore cursor', () => {
    let terminal = new MockInputHandlingTerminal();
    terminal.buffer.x = 1;
    terminal.buffer.y = 2;
    let inputHandler = new InputHandler(terminal);
    // Save cursor position
    inputHandler.saveCursor([]);
    assert.equal(terminal.buffer.x, 1);
    assert.equal(terminal.buffer.y, 2);
    // Change cursor position
    terminal.buffer.x = 10;
    terminal.buffer.y = 20;
    // Restore cursor position
    inputHandler.restoreCursor([]);
    assert.equal(terminal.buffer.x, 1);
    assert.equal(terminal.buffer.y, 2);
  });
  describe('setCursorStyle', () => {
    it('should call Terminal.setOption with correct params', () => {
      let terminal = new MockInputHandlingTerminal();
      let inputHandler = new InputHandler(terminal);

      inputHandler.setCursorStyle([0]);
      assert.equal(terminal.options['cursorStyle'], 'block');
      assert.equal(terminal.options['cursorBlink'], true);

      terminal.options = {};
      inputHandler.setCursorStyle([1]);
      assert.equal(terminal.options['cursorStyle'], 'block');
      assert.equal(terminal.options['cursorBlink'], true);

      terminal.options = {};
      inputHandler.setCursorStyle([2]);
      assert.equal(terminal.options['cursorStyle'], 'block');
      assert.equal(terminal.options['cursorBlink'], false);

      terminal.options = {};
      inputHandler.setCursorStyle([3]);
      assert.equal(terminal.options['cursorStyle'], 'underline');
      assert.equal(terminal.options['cursorBlink'], true);

      terminal.options = {};
      inputHandler.setCursorStyle([4]);
      assert.equal(terminal.options['cursorStyle'], 'underline');
      assert.equal(terminal.options['cursorBlink'], false);

      terminal.options = {};
      inputHandler.setCursorStyle([5]);
      assert.equal(terminal.options['cursorStyle'], 'bar');
      assert.equal(terminal.options['cursorBlink'], true);

      terminal.options = {};
      inputHandler.setCursorStyle([6]);
      assert.equal(terminal.options['cursorStyle'], 'bar');
      assert.equal(terminal.options['cursorBlink'], false);
    });
  });
});
