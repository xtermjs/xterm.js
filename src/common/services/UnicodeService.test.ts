/**
 * Copyright (c) 2019 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import { assert } from 'chai';
import { UnicodeService } from 'common/services/UnicodeService';
import { IUnicodeVersionProvider } from 'common/services/Services';

class DummyProvider implements IUnicodeVersionProvider {
  public version = '123';
  public wcwidth(n: number): 0 | 1 | 2 {
    return 2;
  }
  public charProperties(codepoint: number): number {
    return UnicodeService.createPropertyValue(0, this.wcwidth(codepoint));
  }
}

describe('unicode provider', () => {
  let us: UnicodeService;
  beforeEach(() => {
    us = new UnicodeService();
  });
  it('default to V6', () => {
    assert.equal(us.activeVersion, '6');
    assert.deepEqual(us.versions, ['6']);
    assert.doesNotThrow(() => { us.activeVersion = '6'; }, `unknown Unicode version "6"`);
    assert.equal(us.getStringCellWidth('hello'), 5);
  });
  it('activate should throw for unknown version', () => {
    assert.throws(() => { us.activeVersion = '55'; }, 'unknown Unicode version "55"');
  });
  it('should notify about version change', () => {
    const notes: string[] = [];
    us.onChange(version => notes.push(version));
    const dummyProvider = new DummyProvider();
    us.register(dummyProvider);
    us.activeVersion = dummyProvider.version;
    assert.deepEqual(notes, [dummyProvider.version]);
  });
  it('correctly changes provider impl', () => {
    assert.equal(us.getStringCellWidth('hello'), 5);
    const dummyProvider = new DummyProvider();
    us.register(dummyProvider);
    us.activeVersion = dummyProvider.version;
    assert.equal(us.getStringCellWidth('hello'), 2 * 5);
  });
  it('wcwidth V6 emoji test', () => {
    const widthV6 = us.getStringCellWidth('🤣🤣🤣🤣🤣🤣🤣🤣🤣🤣');
    assert.equal(widthV6, 10);
  });
});
