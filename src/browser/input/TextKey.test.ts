/**
 * Copyright (c) 2026 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import { assert } from 'chai';
import { isTextKey } from './TextKey';

describe('isTextKey', () => {
  it('should be true for multi-character text', () => {
    assert.isTrue(isTextKey('Hello'));
    assert.isTrue(isTextKey('This is a sentence.'));
    assert.isTrue(isTextKey('héllo'));
  });

  it('should be false for single characters, including a multi-unit emoji', () => {
    assert.isFalse(isTextKey('a'));
    assert.isFalse(isTextKey('é'));
    assert.isFalse(isTextKey('\u{1F600}'));
  });

  it('should be false for named keys', () => {
    for (const key of ['Enter', 'ArrowLeft', 'F1', 'F24', 'Unidentified', 'Dead', 'Process', 'Shift', 'Backspace', 'MediaPlayPause']) {
      assert.isFalse(isTextKey(key), key);
    }
  });

  it('should be false for missing keys', () => {
    assert.isFalse(isTextKey(undefined));
    assert.isFalse(isTextKey(''));
  });
});
