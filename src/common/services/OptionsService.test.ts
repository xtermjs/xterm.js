/**
 * Copyright (c) 2020 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import { assert } from 'chai';
import { OptionsService, DEFAULT_OPTIONS } from 'common/services/OptionsService';

describe('OptionsService', () => {
  describe('constructor', () => {
    const originalError = console.error;
    beforeEach(() => {
      console.error = () => {};
    });
    afterEach(() => {
      console.error = originalError;
    });
    it('uses default value if invalid constructor option value passed', () => {
      assert.equal(new OptionsService({tabStopWidth: 0}).getOption('tabStopWidth'), DEFAULT_OPTIONS.tabStopWidth);
    });
  });
});
