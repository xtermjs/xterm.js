/**
 * Copyright (c) 2026 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import { assert } from 'chai';
import { CHARSETS } from '../data/Charsets';
import { CharsetService } from './CharsetService';

describe('CharsetService', () => {
  let service: CharsetService;

  beforeEach(() => {
    service = new CharsetService();
  });

  it('should not update active charset when designating an inactive glevel', () => {
    service.setgCharset(1, CHARSETS['0']);
    assert.strictEqual(service.glevel, 0);
    assert.ok(service.charset === undefined);
  });

  it('should expose the designated charset after setgLevel', () => {
    service.setgCharset(1, CHARSETS['0']);
    service.setgLevel(1);
    assert.strictEqual(service.charset, CHARSETS['0']);
  });

  it('should update active charset when designating the current glevel', () => {
    service.setgLevel(1);
    service.setgCharset(1, CHARSETS['0']);
    assert.strictEqual(service.charset, CHARSETS['0']);
  });

  it('should reset glevel, charsets, and active charset', () => {
    service.setgCharset(1, CHARSETS['0']);
    service.setgLevel(1);
    service.reset();
    assert.strictEqual(service.glevel, 0);
    assert.deepEqual(service.charsets, []);
    assert.ok(service.charset === undefined);
  });
});
