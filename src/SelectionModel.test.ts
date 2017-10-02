/**
 * Copyright (c) 2017 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import { assert } from 'chai';
import { ITerminal } from './Interfaces';
import { SelectionModel } from './SelectionModel';
import {BufferSet} from './BufferSet';
import { MockTerminal } from './utils/TestUtils.test';

class TestSelectionModel extends SelectionModel {
  constructor(
    terminal: ITerminal
  ) {
    super(terminal);
  }
}

describe('SelectionManager', () => {
  let window: Window;
  let document: Document;

  let terminal: ITerminal;
  let model: TestSelectionModel;

  beforeEach(() => {
    terminal = new MockTerminal();
    terminal.cols = 80;
    terminal.rows = 2;
    terminal.options.scrollback = 10;
    terminal.buffers = new BufferSet(terminal);
    terminal.buffer = terminal.buffers.active;

    model = new TestSelectionModel(terminal);
  });

  describe('clearSelection', () => {
    it('should clear the final selection', () => {
      model.selectionStart = [0, 0];
      model.selectionEnd = [10, 2];
      assert.deepEqual(model.finalSelectionStart, [0, 0]);
      assert.deepEqual(model.finalSelectionEnd, [10, 2]);
      model.clearSelection();
      assert.deepEqual(model.finalSelectionStart, null);
      assert.deepEqual(model.finalSelectionEnd, null);
    });
  });

  describe('areSelectionValuesReversed', () => {
    it('should return true when the selection end is before selection start', () => {
      model.selectionStart = [1, 0];
      model.selectionEnd = [0, 0];
      assert.equal(model.areSelectionValuesReversed(), true);
      model.selectionStart = [10, 2];
      model.selectionEnd = [0, 0];
      assert.equal(model.areSelectionValuesReversed(), true);
    });
    it('should return false when the selection end is after selection start', () => {
      model.selectionStart = [0, 0];
      model.selectionEnd = [1, 0];
      assert.equal(model.areSelectionValuesReversed(), false);
      model.selectionStart = [0, 0];
      model.selectionEnd = [10, 2];
      assert.equal(model.areSelectionValuesReversed(), false);
    });
  });

  describe('onTrim', () => {
    it('should trim a portion of the selection when a part of it is trimmed', () => {
      model.selectionStart = [0, 0];
      model.selectionEnd = [10, 2];
      model.onTrim(1);
      assert.deepEqual(model.finalSelectionStart, [0, 0]);
      assert.deepEqual(model.finalSelectionEnd, [10, 1]);
      model.onTrim(1);
      assert.deepEqual(model.finalSelectionStart, [0, 0]);
      assert.deepEqual(model.finalSelectionEnd, [10, 0]);
    });
    it('should clear selection when it is trimmed in its entirety', () => {
      model.selectionStart = [0, 0];
      model.selectionEnd = [10, 0];
      model.onTrim(1);
      assert.deepEqual(model.finalSelectionStart, null);
      assert.deepEqual(model.finalSelectionEnd, null);
    });
  });

  describe('finalSelectionStart', () => {
    it('should return the start of the buffer if select all is active', () => {
      model.isSelectAllActive = true;
      assert.deepEqual(model.finalSelectionStart, [0, 0]);
    });
    it('should return selection start if there is no selection end', () => {
      model.selectionStart = [2, 2];
      assert.deepEqual(model.finalSelectionStart, [2, 2]);
    });
    it('should return selection end if values are reversed', () => {
      model.selectionStart = [2, 2];
      model.selectionEnd = [3, 2];
      assert.deepEqual(model.finalSelectionStart, [2, 2]);
      model.selectionEnd = [1, 2];
      assert.deepEqual(model.finalSelectionStart, [1, 2]);
    });
  });

  describe('finalSelectionEnd', () => {
    it('should return the end of the buffer if select all is active', () => {
      model.isSelectAllActive = true;
      assert.deepEqual(model.finalSelectionEnd, [80, 1]);
    });
    it('should return null if there is no selection start', () => {
      assert.equal(model.finalSelectionEnd, null);
      model.selectionEnd = [1, 2];
      assert.equal(model.finalSelectionEnd, null);
    });
    it('should return selection start + length if there is no selection end', () => {
      model.selectionStart = [2, 2];
      model.selectionStartLength = 2;
      assert.deepEqual(model.finalSelectionEnd, [4, 2]);
    });
    it('should return selection start + length if values are reversed', () => {
      model.selectionStart = [2, 2];
      model.selectionStartLength = 2;
      model.selectionEnd = [2, 1];
      assert.deepEqual(model.finalSelectionEnd, [4, 2]);
    });
    it('should return selection start + length if selection end is inside the start selection', () => {
      model.selectionStart = [2, 2];
      model.selectionStartLength = 2;
      model.selectionEnd = [3, 2];
      assert.deepEqual(model.finalSelectionEnd, [4, 2]);
    });
    it('should return selection end if selection end is after selection start + length', () => {
      model.selectionStart = [2, 2];
      model.selectionStartLength = 2;
      model.selectionEnd = [5, 2];
      assert.deepEqual(model.finalSelectionEnd, [5, 2]);
    });
  });
});
