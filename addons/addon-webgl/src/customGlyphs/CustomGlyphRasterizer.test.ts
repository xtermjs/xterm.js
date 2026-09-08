/**
 * Copyright (c) 2026 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import { assert } from 'chai';
import { createPatternCanvas } from './CustomGlyphRasterizer';

describe('CustomGlyphRasterizer', () => {
  describe('createPatternCanvas', () => {
    it('prefers an offscreen canvas without using the DOM canvas factory', () => {
      const expectedCanvas = {} as OffscreenCanvas;
      const calls: string[] = [];

      const canvas = createPatternCanvas(
        2,
        3,
        (width, height) => {
          calls.push(`offscreen:${width}x${height}`);
          return expectedCanvas;
        },
        () => {
          calls.push('dom');
          return {} as HTMLCanvasElement;
        }
      );

      assert.deepEqual({ canvas, calls }, {
        canvas: expectedCanvas,
        calls: ['offscreen:2x3']
      });
    });

    it('uses the main-realm DOM canvas factory when OffscreenCanvas is unavailable', () => {
      const expectedCanvas = {} as HTMLCanvasElement;
      const calls: string[] = [];

      const canvas = createPatternCanvas(
        4,
        5,
        undefined,
        (width, height) => {
          calls.push(`dom:${width}x${height}`);
          return expectedCanvas;
        }
      );

      assert.deepEqual({ canvas, calls }, {
        canvas: expectedCanvas,
        calls: ['dom:4x5']
      });
    });
  });
});
