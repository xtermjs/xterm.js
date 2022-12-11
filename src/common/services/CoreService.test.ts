/**
 * Copyright (c) 2019 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import { ICoreService } from 'common/services/Services';
import { CoreService } from 'common/services/CoreService';
import { MockBufferService, MockLogService, MockOptionsService } from 'common/TestUtils.test';
import { assert } from 'chai';

describe('CoreService', () => {
  let coreService: ICoreService;

  beforeEach(() => {
    coreService = new CoreService(
      new MockBufferService(80, 30),
      new MockLogService(),
      new MockOptionsService());
  });

  describe('reset', () => {
    it('should not affect isCursorInitialized', () => {
      coreService.isCursorInitialized = true;
      coreService.reset();
      assert.equal(coreService.isCursorInitialized, true);
      coreService.isCursorInitialized = false;
      coreService.reset();
      assert.equal(coreService.isCursorInitialized, false);
    });
  });
});
