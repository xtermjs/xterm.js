/**
 * Copyright (c) 2019 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import { UNDERLINE_CURLY_SEGMENT_SIZE } from 'browser/renderer/shared/Constants';
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

export function createDrawCurlyPlan(cellWidth: number, lineWidth: number): any[] {
  const defaultFullSegmentWidth = UNDERLINE_CURLY_SEGMENT_SIZE * lineWidth * 2;

  if (lineWidth === 2) {
    // 12 look better
    return createVariantSequences(cellWidth, 12, lineWidth, 4);
  }

  if (lineWidth === 3) {
    return createVariantSequences(cellWidth, 16, lineWidth, 5);
  }

  // if (lineWidth === 4) {
  //   return createVariantSequences(cellWidth, 20 , lineWidth, 6);
  // }

  return createVariantSequences(cellWidth, defaultFullSegmentWidth , lineWidth, 3 * lineWidth);
}

function createVariantSequences(cellWidth: number, fullSegmentWidth: number, point: number, line: number): string[] {
  const result: string[] = [];
  let totalPixels = cellWidth * fullSegmentWidth;
  let joinOrLine: UnderlineCurlyJoinOrLine = 'join';
  let upOrDown: UnderlineCurlyLineType = 'up';
  let lastUpOrDown: UnderlineCurlyLineType = 'up';
  // Split between cells to be processed
  let waitHandleLinePixels = 0;
  while (totalPixels > 0) {
    const cellResult: any[] = [];
    let cellCurrentWidth = cellWidth;
    while (cellCurrentWidth > 0) {
      if (joinOrLine === 'join') {
        let token: UnderlineDrawCurlyOp = upOrDown === 'up' ? 'Y' : 'B';
        if (waitHandleLinePixels > 0) {
          // right
          token = lastUpOrDown === 'up' ? 'M' : 'P';
          cellResult.push(`${token}${waitHandleLinePixels}`);
          cellCurrentWidth -= waitHandleLinePixels;
          waitHandleLinePixels = 0;
          joinOrLine = 'line';
        } else {
          // left
          const usingWidth = point;
          if (usingWidth > cellCurrentWidth) {
            token = lastUpOrDown === 'up' ? 'Z' : 'Q';
            cellResult.push(`${token}${cellCurrentWidth}`);
            waitHandleLinePixels = usingWidth - cellCurrentWidth;
            cellCurrentWidth = 0;
          } else {
            cellResult.push(`${token}${point}`);
            cellCurrentWidth -= point;
            joinOrLine = 'line';
          }
        }
      } else if (joinOrLine === 'line') {
        const token: UnderlineDrawCurlyOp = upOrDown === 'up' ? 'U' : 'D';
        if (waitHandleLinePixels > 0) {
          cellResult.push(`${token}${waitHandleLinePixels}`);
          cellCurrentWidth -= waitHandleLinePixels;
          waitHandleLinePixels = 0;
          joinOrLine = 'join';
          lastUpOrDown = upOrDown;
          upOrDown = upOrDown === 'up' ? 'down' : 'up';
        } else {
          const usingWidth = line;
          if (usingWidth > cellCurrentWidth) {
            cellResult.push(`${token}${cellCurrentWidth}`);
            waitHandleLinePixels = usingWidth - cellCurrentWidth;
            cellCurrentWidth = 0;
          } else {
            cellResult.push(`${token}${line}`);
            cellCurrentWidth -= line;
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
