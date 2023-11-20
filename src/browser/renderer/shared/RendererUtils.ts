/**
 * Copyright (c) 2019 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import { IDimensions, IRenderDimensions, UnderlineCurlyJoinOrLine, UnderlineCurlyLineType, UnderlineDrawCurlyOp } from 'browser/renderer/shared/Types';
import { TwoKeyMap } from 'common/MultiKeyMap';

export function throwIfFalsy<T>(value: T | undefined | null): T {
  if (!value) {
    throw new Error('value must not be falsy');
  }
  return value;
}

export function isPowerlineGlyph(codepoint: number): boolean {
  // Only return true for Powerline symbols which require
  // different padding and should be excluded from minimum contrast
  // ratio standards
  return 0xE0A4 <= codepoint && codepoint <= 0xE0D6;
}

export function isRestrictedPowerlineGlyph(codepoint: number): boolean {
  return 0xE0B0 <= codepoint && codepoint <= 0xE0B7;
}

function isBoxOrBlockGlyph(codepoint: number): boolean {
  return 0x2500 <= codepoint && codepoint <= 0x259F;
}

export function excludeFromContrastRatioDemands(codepoint: number): boolean {
  return isPowerlineGlyph(codepoint) || isBoxOrBlockGlyph(codepoint);
}

export function createRenderDimensions(): IRenderDimensions {
  return {
    css: {
      canvas: createDimension(),
      cell: createDimension()
    },
    device: {
      canvas: createDimension(),
      cell: createDimension(),
      char: {
        width: 0,
        height: 0,
        left: 0,
        top: 0
      }
    }
  };
}

function createDimension(): IDimensions {
  return {
    width: 0,
    height: 0
  };
}

export function computeNextVariantOffset(cellWidth: number, lineWidth: number, currentOffset: number = 0): number {
  return (cellWidth - (Math.round(lineWidth) * 2 - currentOffset)) % (Math.round(lineWidth) * 2);
}

// TwoKeyMap
// eslint-disable-next-line @typescript-eslint/naming-convention
const _curlyVariantCache = new TwoKeyMap();

export function getCurlyVariant(cellWidth: number, lineWidth: number, offset: number): string {
  if (_curlyVariantCache.get(cellWidth, lineWidth)) {
    const curlyVariants = _curlyVariantCache.get(cellWidth, lineWidth) as any[];
    if (curlyVariants.length > 0) {
      if (!curlyVariants[offset]) {
        return curlyVariants[0];
      }
      return curlyVariants[offset];
    }
  }
  return '';
}

export function getCurlyVariantOffset(x: number, cellWidth: number, lineWidth: number): number {
  if (_curlyVariantCache.get(cellWidth, lineWidth)) {
    const curlyVariants = _curlyVariantCache.get(cellWidth, lineWidth) as any[];
    return x % curlyVariants.length;
  }
  if (!_curlyVariantCache.get(cellWidth, lineWidth)) {
    const curlyVariants = createDrawCurlyPlan(cellWidth, lineWidth);
    _curlyVariantCache.set(cellWidth, lineWidth, curlyVariants);
    return x % curlyVariants.length;
  }
  return 0;
}

const defaultCurlyLinePixels = 3;

export function createDrawCurlyPlan(cellWidth: number, lineWidth: number): string[] {
  return createVariantSequences(cellWidth, lineWidth, defaultCurlyLinePixels + lineWidth - 1);
}

function createVariantSequences(cellWidth: number, joinPixels: number, linePixels: number): string[] {
  const result: string[] = [];
  let totalPixels = cellWidth * ((joinPixels + linePixels) * 2);
  let joinOrLine: UnderlineCurlyJoinOrLine = 'join';
  let upOrDown: UnderlineCurlyLineType = 'up';
  let lastUpOrDown: UnderlineCurlyLineType = 'up';
  // Split between cells to be processed
  let waitHandlePixels = 0;
  while (totalPixels > 0) {
    const cellResult: any[] = [];
    let cellCurrentWidth = cellWidth;
    while (cellCurrentWidth > 0) {
      if (joinOrLine === 'join') {
        let token: UnderlineDrawCurlyOp = upOrDown === 'up' ? 'Y' : 'B';
        if (waitHandlePixels > 0) {
          // right
          token = lastUpOrDown === 'up' ? 'M' : 'P';
          cellResult.push(`${token}${waitHandlePixels}`);
          cellCurrentWidth -= waitHandlePixels;
          waitHandlePixels = 0;
          joinOrLine = 'line';
        } else {
          // left
          const usingWidth = joinPixels;
          if (usingWidth > cellCurrentWidth) {
            token = lastUpOrDown === 'up' ? 'Z' : 'Q';
            cellResult.push(`${token}${cellCurrentWidth}`);
            waitHandlePixels = usingWidth - cellCurrentWidth;
            cellCurrentWidth = 0;
          } else {
            cellResult.push(`${token}${joinPixels}`);
            cellCurrentWidth -= joinPixels;
            joinOrLine = 'line';
          }
        }
      } else if (joinOrLine === 'line') {
        const token: UnderlineDrawCurlyOp = upOrDown === 'up' ? 'U' : 'D';
        if (waitHandlePixels > 0) {
          cellResult.push(`${token}${waitHandlePixels}`);
          cellCurrentWidth -= waitHandlePixels;
          waitHandlePixels = 0;
          joinOrLine = 'join';
          lastUpOrDown = upOrDown;
          upOrDown = upOrDown === 'up' ? 'down' : 'up';
        } else {
          const usingWidth = linePixels;
          if (usingWidth > cellCurrentWidth) {
            cellResult.push(`${token}${cellCurrentWidth}`);
            waitHandlePixels = usingWidth - cellCurrentWidth;
            cellCurrentWidth = 0;
          } else {
            cellResult.push(`${token}${linePixels}`);
            cellCurrentWidth -= linePixels;
            joinOrLine = 'join';
            lastUpOrDown = upOrDown;
            upOrDown = upOrDown === 'up' ? 'down' : 'up';
          }
        }
      }
    }
    totalPixels -= cellWidth;
    result.push(cellResult.join(' '));
  }
  return result;
}
