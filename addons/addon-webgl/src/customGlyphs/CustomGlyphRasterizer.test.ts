/**
 * Copyright (c) 2026 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import { assert } from 'chai';
import { customGlyphDefinitions } from './CustomGlyphDefinitions';
import { createPatternCanvas } from './CustomGlyphRasterizer';
import type { CustomGlyphDefinitionPart } from './Types';

describe('CustomGlyphRasterizer', () => {
  // Git branch node glyphs (U+F5EE..U+F60D, #6347): the node must stay a true
  // circle in device pixels at any cell aspect ratio, and the vertical lines
  // must meet the edge of the node.
  describe('git branch node glyphs', () => {
    // Resolves a definition part to the path string the rasterizer would draw
    // for a cell of the given size. PATH_FUNCTION definitions receive
    // xp = 0.15 and yp = 0.15 * cellWidth / cellHeight, like
    // drawPathFunctionCharacter does.
    function resolvePath(part: CustomGlyphDefinitionPart, cellWidth: number, cellHeight: number): string {
      if (typeof part.data === 'function') {
        return part.data(0.15, 0.15 * cellWidth / cellHeight);
      }
      return part.data as string;
    }

    // Radii of the node in device pixels, parsed from the path string.
    function nodeRadiiPx(path: string, cellWidth: number, cellHeight: number): { rx: number, ry: number } {
      const arc = /A([\d.]+),([\d.]+),/.exec(path);
      if (arc) {
        return { rx: parseFloat(arc[1]) * cellWidth, ry: parseFloat(arc[2]) * cellHeight };
      }
      const nums = path.match(/-?\d*\.?\d+/g)?.map(Number) ?? [];
      let minX = Infinity;
      let maxX = -Infinity;
      let minY = Infinity;
      let maxY = -Infinity;
      for (let i = 0; i + 1 < nums.length; i += 2) {
        minX = Math.min(minX, nums[i]);
        maxX = Math.max(maxX, nums[i]);
        minY = Math.min(minY, nums[i + 1]);
        maxY = Math.max(maxY, nums[i + 1]);
      }
      return { rx: (maxX - minX) / 2 * cellWidth, ry: (maxY - minY) / 2 * cellHeight };
    }

    function nodeFillPart(): CustomGlyphDefinitionPart {
      const definition = customGlyphDefinitions['\u{F5EE}'];
      assert.isArray(definition);
      return (definition as CustomGlyphDefinitionPart[])[0];
    }

    function nodeLinePart(char: string): CustomGlyphDefinitionPart {
      const definition = customGlyphDefinitions[char];
      assert.isArray(definition);
      return (definition as CustomGlyphDefinitionPart[])[2];
    }

    it('node is circular when the cell is not 1:2', () => {
      // Tall cell (lineHeight > 1) and wide cell: rx must equal ry in pixels.
      for (const [cellWidth, cellHeight] of [[10, 30], [12, 20], [9, 18]]) {
        const { rx, ry } = nodeRadiiPx(resolvePath(nodeFillPart(), cellWidth, cellHeight), cellWidth, cellHeight);
        assert.closeTo(rx, ry, 0.01, `node radii differ at ${cellWidth}x${cellHeight}: rx=${rx}, ry=${ry}`);
        assert.closeTo(rx, 0.35 * cellWidth, 0.01, `node radius is not 0.35 cell widths at ${cellWidth}x${cellHeight}`);
      }
    });

    it('node is still circular at the 1:2 cell ratio', () => {
      const { rx, ry } = nodeRadiiPx(resolvePath(nodeFillPart(), 10, 20), 10, 20);
      assert.closeTo(rx, ry, 0.01, `node radii differ at 10x20: rx=${rx}, ry=${ry}`);
      assert.closeTo(rx, 3.5, 0.01);
    });

    it('vertical lines meet the edge of the node', () => {
      for (const [cellWidth, cellHeight] of [[10, 30], [10, 20]]) {
        const { ry } = nodeRadiiPx(resolvePath(nodeFillPart(), cellWidth, cellHeight), cellWidth, cellHeight);
        const ryFraction = ry / cellHeight;
        // '\u{F5F8}' is NODE_FILL + NODE_STROKE + NODE_LINE_UP,
        // '\u{F5F6}' is NODE_FILL + NODE_STROKE + NODE_LINE_DOWN.
        const upPath = resolvePath(nodeLinePart('\u{F5F8}'), cellWidth, cellHeight);
        const upNumbers = upPath.match(/-?\d*\.?\d+/g)?.map(Number) ?? [];
        assert.closeTo(upNumbers[upNumbers.length - 1], 0.5 - ryFraction, 1e-9, `line up does not meet node at ${cellWidth}x${cellHeight}: ${upPath}`);
        const downPath = resolvePath(nodeLinePart('\u{F5F6}'), cellWidth, cellHeight);
        const downNumbers = downPath.match(/-?\d*\.?\d+/g)?.map(Number) ?? [];
        assert.closeTo(downNumbers[downNumbers.length - 1], 0.5 + ryFraction, 1e-9, `line down does not meet node at ${cellWidth}x${cellHeight}: ${downPath}`);
      }
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
