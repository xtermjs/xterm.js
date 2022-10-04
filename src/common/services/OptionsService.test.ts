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
      console.error = () => { };
    });
    afterEach(() => {
      console.error = originalError;
    });
    it('uses default value if invalid constructor option values passed for cols/rows', () => {
      const optionsService = new OptionsService({ cols: undefined, rows: undefined });
      assert.equal(optionsService.options.rows, DEFAULT_OPTIONS.rows);
      assert.equal(optionsService.options.cols, DEFAULT_OPTIONS.cols);
    });
    it('uses values from constructor option values if correctly passed', () => {
      const optionsService = new OptionsService({ cols: 80, rows: 25 });
      assert.equal(optionsService.options.rows, 25);
      assert.equal(optionsService.options.cols, 80);
    });
    it('uses default value if invalid constructor option value passed', () => {
      assert.equal(new OptionsService({ tabStopWidth: 0 }).options.tabStopWidth, DEFAULT_OPTIONS.tabStopWidth);
    });
    it('object.keys return the correct number of options', () => {
      const optionsService = new OptionsService({ cols: 80, rows: 25 });
      assert.notEqual(Object.keys(optionsService.options).length, 0);
    });
  });
  describe('setOption', () => {
    let service: OptionsService;
    beforeEach(() => {
      service = new OptionsService({});
    });
    it('applies valid fontWeight option values', () => {
      service.options.fontWeight = 'bold';
      assert.equal(service.options.fontWeight, 'bold', '"bold" keyword value should be applied');

      service.options.fontWeight = 'normal';
      assert.equal(service.options.fontWeight, 'normal', '"normal" keyword value should be applied');

      service.options.fontWeight = '600';
      assert.equal(service.options.fontWeight, '600', 'String numeric values should be applied');

      service.options.fontWeight = 350;
      assert.equal(service.options.fontWeight, 350, 'Values between 1 and 1000 should be applied as is');

      service.options.fontWeight = 1;
      assert.equal(service.options.fontWeight, 1, 'Range should include minimum value: 1');

      service.options.fontWeight = 1000;
      assert.equal(service.options.fontWeight, 1000, 'Range should include maximum value: 1000');
    });
    it('normalizes invalid fontWeight option values', () => {
      service.options.fontWeight = 350;
      assert.doesNotThrow(() => service.options.fontWeight = 10000, 'fontWeight should be normalized instead of throwing');
      assert.equal(service.options.fontWeight, DEFAULT_OPTIONS.fontWeight, 'Values greater than 1000 should be reset to default');

      service.options.fontWeight = 350;
      service.options.fontWeight = -10;
      assert.equal(service.options.fontWeight, DEFAULT_OPTIONS.fontWeight, 'Values less than 1 should be reset to default');

      service.options.fontWeight = 350;
      service.options.fontWeight = 'bold700' as any;
      assert.equal(service.options.fontWeight, DEFAULT_OPTIONS.fontWeight, 'Wrong string literals should be reset to default');
    });
  });
});
