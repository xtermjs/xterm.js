/**
 * Copyright (c) 2017 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import { assert } from 'chai';
import { InputHandler } from './InputHandler';
import { MockInputHandlingTerminal } from './utils/TestUtils.test';

describe('InputHandler', () => {
  describe('save and restore cursor', () => {
    const terminal = new MockInputHandlingTerminal();
    terminal.buffer.x = 1;
    terminal.buffer.y = 2;
    terminal.curAttr = 3;
    const inputHandler = new InputHandler(terminal);
    // Save cursor position
    inputHandler.saveCursor([]);
    assert.equal(terminal.buffer.x, 1);
    assert.equal(terminal.buffer.y, 2);
    assert.equal(terminal.curAttr, 3);
    // Change cursor position
    terminal.buffer.x = 10;
    terminal.buffer.y = 20;
    terminal.curAttr = 30;
    // Restore cursor position
    inputHandler.restoreCursor([]);
    assert.equal(terminal.buffer.x, 1);
    assert.equal(terminal.buffer.y, 2);
    assert.equal(terminal.curAttr, 3);
  });
  describe('setCursorStyle', () => {
    it('should call Terminal.setOption with correct params', () => {
      const terminal = new MockInputHandlingTerminal();
      const inputHandler = new InputHandler(terminal);
      const collect = ' ';

      inputHandler.setCursorStyle([0], collect);
      assert.equal(terminal.options['cursorStyle'], 'block');
      assert.equal(terminal.options['cursorBlink'], true);

      terminal.options = {};
      inputHandler.setCursorStyle([1], collect);
      assert.equal(terminal.options['cursorStyle'], 'block');
      assert.equal(terminal.options['cursorBlink'], true);

      terminal.options = {};
      inputHandler.setCursorStyle([2], collect);
      assert.equal(terminal.options['cursorStyle'], 'block');
      assert.equal(terminal.options['cursorBlink'], false);

      terminal.options = {};
      inputHandler.setCursorStyle([3], collect);
      assert.equal(terminal.options['cursorStyle'], 'underline');
      assert.equal(terminal.options['cursorBlink'], true);

      terminal.options = {};
      inputHandler.setCursorStyle([4], collect);
      assert.equal(terminal.options['cursorStyle'], 'underline');
      assert.equal(terminal.options['cursorBlink'], false);

      terminal.options = {};
      inputHandler.setCursorStyle([5], collect);
      assert.equal(terminal.options['cursorStyle'], 'bar');
      assert.equal(terminal.options['cursorBlink'], true);

      terminal.options = {};
      inputHandler.setCursorStyle([6], collect);
      assert.equal(terminal.options['cursorStyle'], 'bar');
      assert.equal(terminal.options['cursorBlink'], false);
    });
  });
  describe('setMode', () => {
    it('should toggle Terminal.bracketedPasteMode', () => {
      const terminal = new MockInputHandlingTerminal();
      const collect = '?';
      terminal.bracketedPasteMode = false;
      const inputHandler = new InputHandler(terminal);
      // Set bracketed paste mode
      inputHandler.setMode([2004], collect);
      assert.equal(terminal.bracketedPasteMode, true);
      // Reset bracketed paste mode
      inputHandler.resetMode([2004], collect);
      assert.equal(terminal.bracketedPasteMode, false);
    });
  });
});
