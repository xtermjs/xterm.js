/**
 * Copyright (c) 2023 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import { assert } from 'chai';
import { OptionsService } from 'common/services/OptionsService';

describe('OptionsService lineHeight', () => {
  let optionsService: OptionsService;

  beforeEach(() => {
    optionsService = new OptionsService({});
  });

  describe('numeric lineHeight', () => {
    it('should accept numeric values', () => {
      optionsService.options.lineHeight = 1.5;
      assert.equal(optionsService.rawOptions.lineHeight, 1.5);
    });

    it('should reject values less than 1', () => {
      assert.throws(() => optionsService.options.lineHeight = 0.5);
    });

    it('should accept 1 as minimum value', () => {
      optionsService.options.lineHeight = 1;
      assert.equal(optionsService.rawOptions.lineHeight, 1);
    });
  });

  describe('string lineHeight with px format', () => {
    it('should accept px values', () => {
      optionsService.options.lineHeight = '24px';
      assert.equal(optionsService.rawOptions.lineHeight, '24px');
    });

    it('should accept decimal px values', () => {
      optionsService.options.lineHeight = '23.5px';
      assert.equal(optionsService.rawOptions.lineHeight, '23.5px');
    });

    it('should reject px values less than 1', () => {
      assert.throws(() => optionsService.options.lineHeight = '0.5px');
    });

    it('should accept 1px as minimum value', () => {
      optionsService.options.lineHeight = '1px';
      assert.equal(optionsService.rawOptions.lineHeight, '1px');
    });

    it('should reject non-px string values', () => {
      assert.throws(() => optionsService.options.lineHeight = '24' as any);
      assert.throws(() => optionsService.options.lineHeight = '24em' as any);
      assert.throws(() => optionsService.options.lineHeight = 'normal' as any);
    });

    it('should reject invalid px values', () => {
      assert.throws(() => optionsService.options.lineHeight = 'invalidpx' as any);
      assert.throws(() => optionsService.options.lineHeight = 'px' as any);
    });
  });

  describe('invalid lineHeight types', () => {
    it('should reject null', () => {
      assert.throws(() => optionsService.options.lineHeight = null as any);
    });

    it('should reject undefined when explicitly set', () => {
      assert.throws(() => optionsService.options.lineHeight = undefined as any);
    });

    it('should reject boolean values', () => {
      assert.throws(() => optionsService.options.lineHeight = true as any);
      assert.throws(() => optionsService.options.lineHeight = false as any);
    });

    it('should reject arrays', () => {
      assert.throws(() => optionsService.options.lineHeight = [] as any);
    });

    it('should reject objects', () => {
      assert.throws(() => optionsService.options.lineHeight = {} as any);
    });
  });
});
