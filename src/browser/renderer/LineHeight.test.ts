/**
 * Copyright (c) 2023 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import { assert } from 'chai';

/**
 * Calculates the line height in pixels based on the lineHeight option and character height.
 * This is the same function used in both DomRenderer and WebglRenderer.
 */
function calculateLineHeightInPixels(lineHeight: number | string, charHeight: number): number {
  if (typeof lineHeight === 'string' && lineHeight.endsWith('px')) {
    const pxValue = parseFloat(lineHeight.slice(0, -2));
    // Ensure the pixel value is at least as large as the character height
    return Math.max(pxValue, charHeight);
  }
  // Numeric lineHeight acts as a multiplier
  return Math.floor(charHeight * (lineHeight as number));
}

describe('calculateLineHeightInPixels', () => {
  describe('numeric lineHeight', () => {
    it('should calculate correctly with multiplier 1', () => {
      assert.equal(calculateLineHeightInPixels(1, 20), 20);
    });

    it('should calculate correctly with multiplier 1.2', () => {
      assert.equal(calculateLineHeightInPixels(1.2, 20), 24);
    });

    it('should calculate correctly with multiplier 1.5', () => {
      assert.equal(calculateLineHeightInPixels(1.5, 20), 30);
    });

    it('should floor the result', () => {
      assert.equal(calculateLineHeightInPixels(1.3, 20), 26); // Math.floor(26)
    });
  });

  describe('string lineHeight with px format', () => {
    it('should use px value directly when larger than char height', () => {
      assert.equal(calculateLineHeightInPixels('25px', 20), 25);
    });

    it('should use char height when px value is smaller', () => {
      assert.equal(calculateLineHeightInPixels('15px', 20), 20);
    });

    it('should handle decimal px values', () => {
      assert.equal(calculateLineHeightInPixels('23.5px', 20), 23.5);
    });

    it('should handle edge case where px equals char height', () => {
      assert.equal(calculateLineHeightInPixels('20px', 20), 20);
    });

    it('should handle very large px values', () => {
      assert.equal(calculateLineHeightInPixels('100px', 20), 100);
    });
  });

  describe('edge cases', () => {
    it('should handle zero char height with numeric multiplier', () => {
      assert.equal(calculateLineHeightInPixels(1.5, 0), 0);
    });

    it('should handle zero char height with px value', () => {
      assert.equal(calculateLineHeightInPixels('25px', 0), 25);
    });

    it('should handle 1px with various char heights', () => {
      assert.equal(calculateLineHeightInPixels('1px', 5), 5);
      assert.equal(calculateLineHeightInPixels('1px', 20), 20);
      assert.equal(calculateLineHeightInPixels('1px', 0), 1);
    });
  });
});
