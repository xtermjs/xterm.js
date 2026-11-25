/**
 * Copyright (c) 2026 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import { assert } from 'chai';
import type { ILogService } from 'common/services/Services';
import { createPatternCanvas, tryDrawCustomGlyph } from './CustomGlyphRasterizer';

interface IFillRectCall {
  x: number;
  y: number;
  width: number;
  height: number;
}

function getBlockRectCalls(
  char: string,
  deviceCellWidth: number,
  deviceCellHeight: number,
  xOffset: number = 0,
  yOffset: number = 0
): IFillRectCall[] {
  const calls: IFillRectCall[] = [];
  const ctx = {
    fillRect: (x: number, y: number, width: number, height: number): void => {
      calls.push({ x, y, width, height });
    }
  } as unknown as CanvasRenderingContext2D;

  assert.isTrue(tryDrawCustomGlyph(
    ctx,
    char,
    xOffset,
    yOffset,
    deviceCellWidth,
    deviceCellHeight,
    deviceCellWidth,
    deviceCellHeight,
    15,
    1,
    {} as ILogService
  ));
  return calls;
}

function getIntegerCoverage(calls: IFillRectCall[]): Set<string> {
  const result = new Set<string>();
  for (const call of calls) {
    assert.isTrue([call.x, call.y, call.width, call.height].every(Number.isInteger));
    for (let y = call.y; y < call.y + call.height; y++) {
      for (let x = call.x; x < call.x + call.width; x++) {
        result.add(`${x},${y}`);
      }
    }
  }
  return result;
}

function getIntersectionArea(a: IFillRectCall, b: IFillRectCall): number {
  return Math.max(0, Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x)) *
    Math.max(0, Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y));
}

describe('CustomGlyphRasterizer', () => {
  describe('solid octant block vectors', () => {
    it('shares integer boundaries between composite and complementary blocks', () => {
      for (const width of [7, 9]) {
        const [leftFull, upperRight] = getBlockRectCalls('\u259B', width, 17);
        assert.isTrue([leftFull, upperRight]
          .flatMap(e => [e.x, e.y, e.width, e.height])
          .every(Number.isInteger));
        assert.equal(leftFull.x + leftFull.width, upperRight.x);
        assert.equal(leftFull.height, 17);
        assert.isBelow(upperRight.height, leftFull.height);

        const [left] = getBlockRectCalls('\u258C', width, 17);
        const [right] = getBlockRectCalls('\u2590', width, 17);
        assert.equal(left.x + left.width, right.x);
        assert.equal(left.width + right.width, width);
      }

      const [top] = getBlockRectCalls('\u2580', 9, 17);
      const [bottom] = getBlockRectCalls('\u2584', 9, 17);
      assert.equal(top.y + top.height, bottom.y);
      assert.equal(top.height + bottom.height, 17);
    });

    it('preserves one-eighth coverage across the sampling threshold', () => {
      for (const width of [7, 8, 9]) {
        const [stripe] = getBlockRectCalls('\u{1FB73}', width, 17);
        assert.isAbove(stripe.width, 0);
        if (width >= 8) {
          assert.isTrue(Number.isInteger(stripe.x));
          assert.isTrue(Number.isInteger(stripe.width));
        }
      }
      const [unsafeStripe] = getBlockRectCalls('\u{1FB73}', 7, 17);
      assert.isFalse(Number.isInteger(unsafeStripe.x));
      assert.isFalse(Number.isInteger(unsafeStripe.width));
      const [offsetSafeStripe] = getBlockRectCalls('\u{1FB73}', 7, 17, 0.25);
      assert.deepEqual(offsetSafeStripe, { x: 4, y: 0, width: 1, height: 17 });

      const [horizontalStripe] = getBlockRectCalls('\u{1FB79}', 9, 7);
      assert.isAbove(horizontalStripe.height, 0);
      assert.isFalse(Number.isInteger(horizontalStripe.y));
    });

    it('preserves intentional gaps in striped and checkerboard blocks', () => {
      const stripes = getBlockRectCalls('\u{1FB81}', 9, 9);
      assert.lengthOf(stripes, 4);
      getIntegerCoverage(stripes);
      assert.isTrue(stripes.every(e => e.width === 9 && e.height === 1));
      for (let i = 1; i < stripes.length; i++) {
        assert.isBelow(stripes[i - 1].y + stripes[i - 1].height, stripes[i].y);
      }

      for (const size of [7, 9]) {
        const checker = getBlockRectCalls('\u{1FB95}', size, size);
        const coverage = getIntegerCoverage(checker);
        for (let i = 0; i < checker.length; i++) {
          for (let j = i + 1; j < checker.length; j++) {
            assert.equal(getIntersectionArea(checker[i], checker[j]), 0);
          }
        }
        assert.isAtLeast(coverage.size, Math.floor(size * size / 2));
        assert.isAtMost(coverage.size, Math.ceil(size * size / 2));
        for (let y = 0; y < size; y++) {
          const count = Array.from({ length: size }, (_, x) => coverage.has(`${x},${y}`)).filter(Boolean).length;
          assert.isAbove(count, 0);
          assert.isBelow(count, size);
        }
      }
    });

    it('rounds absolute coordinates instead of local dimensions', () => {
      assert.deepEqual(getBlockRectCalls('\u258C', 9, 17, 2.25, 3.25), [
        { x: 2, y: 3, width: 5, height: 17 }
      ]);
    });
  });

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
