/**
 * Copyright (c) 2026 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import { assert } from 'chai';
import { LimitedStringBuilder, StringBuilder } from 'common/StringBuilder';

describe('StringBuilder', () => {
  it('should start empty', () => {
    const builder = new StringBuilder();
    assert.strictEqual(builder.length, 0);
    assert.strictEqual(builder.toString(), '');
  });

  it('should append a single chunk', () => {
    const builder = new StringBuilder();
    builder.append('hello');
    assert.strictEqual(builder.length, 5);
    assert.strictEqual(builder.toString(), 'hello');
  });

  it('should join multiple chunks in order', () => {
    const builder = new StringBuilder();
    builder.append('foo');
    builder.append('bar');
    builder.append('baz');
    assert.strictEqual(builder.length, 9);
    assert.strictEqual(builder.toString(), 'foobarbaz');
  });

  it('should handle empty chunks', () => {
    const builder = new StringBuilder();
    builder.append('');
    builder.append('a');
    builder.append('');
    assert.strictEqual(builder.length, 1);
    assert.strictEqual(builder.toString(), 'a');
  });

  it('should reset accumulated data', () => {
    const builder = new StringBuilder();
    builder.append('hello');
    builder.reset();
    assert.strictEqual(builder.length, 0);
    assert.strictEqual(builder.toString(), '');
  });

  it('should allow appending after reset', () => {
    const builder = new StringBuilder();
    builder.append('old');
    builder.reset();
    builder.append('new');
    assert.strictEqual(builder.toString(), 'new');
  });

  it('should accumulate many small chunks without quadratic concatenation', () => {
    const builder = new StringBuilder();
    const chunk = 'x';
    const count = 10000;
    for (let i = 0; i < count; i++) {
      builder.append(chunk);
    }
    assert.strictEqual(builder.length, count);
    assert.strictEqual(builder.toString(), 'x'.repeat(count));
  });
});

describe('LimitedStringBuilder', () => {
  it('should expose the configured limit', () => {
    const builder = new LimitedStringBuilder(42);
    assert.strictEqual(builder.limit, 42);
  });

  it('should start empty', () => {
    const builder = new LimitedStringBuilder(10);
    assert.strictEqual(builder.length, 0);
    assert.strictEqual(builder.toString(), '');
  });

  it('should accept data up to the limit', () => {
    const builder = new LimitedStringBuilder(10);
    assert.strictEqual(builder.append('12345'), false);
    assert.strictEqual(builder.append('67890'), false);
    assert.strictEqual(builder.length, 10);
    assert.strictEqual(builder.toString(), '1234567890');
  });

  it('should accept a single chunk exactly at the limit', () => {
    const builder = new LimitedStringBuilder(5);
    assert.strictEqual(builder.append('abcde'), false);
    assert.strictEqual(builder.length, 5);
    assert.strictEqual(builder.toString(), 'abcde');
  });

  it('should reject data exceeding the limit and clear the buffer', () => {
    const builder = new LimitedStringBuilder(5);
    builder.append('abc');
    assert.strictEqual(builder.append('def'), true);
    assert.strictEqual(builder.length, 0);
    assert.strictEqual(builder.toString(), '');
  });

  it('should reject a single chunk larger than the limit', () => {
    const builder = new LimitedStringBuilder(3);
    assert.strictEqual(builder.append('toolong'), true);
    assert.strictEqual(builder.length, 0);
    assert.strictEqual(builder.toString(), '');
  });

  it('should allow appending again after reset following a limit breach', () => {
    const builder = new LimitedStringBuilder(3);
    assert.strictEqual(builder.append('abcd'), true);
    builder.reset();
    assert.strictEqual(builder.append('ab'), false);
    assert.strictEqual(builder.toString(), 'ab');
  });

  it('should accumulate many chunks before hitting the limit', () => {
    const limit = 100;
    const builder = new LimitedStringBuilder(limit);
    const chunk = 'A';
    for (let i = 0; i < limit; i++) {
      assert.strictEqual(builder.append(chunk), false);
    }
    assert.strictEqual(builder.toString(), 'A'.repeat(limit));
    assert.strictEqual(builder.append('B'), true);
    assert.strictEqual(builder.toString(), '');
  });

  it('should reject when limit is zero and any data is appended', () => {
    const builder = new LimitedStringBuilder(0);
    assert.strictEqual(builder.append('a'), true);
    assert.strictEqual(builder.length, 0);
  });

  it('should allow zero-length appends at the limit', () => {
    const builder = new LimitedStringBuilder(0);
    assert.strictEqual(builder.append(''), false);
    assert.strictEqual(builder.length, 0);
    assert.strictEqual(builder.toString(), '');
  });
});
