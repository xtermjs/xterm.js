/**
 * Copyright (c) 2026 The xterm.js authors. All rights reserved.
 * @license MIT
 *
 * Kitty graphics Unicode placeholders (virtual placements, U=1).
 * See: https://sw.kovidgoyal.net/kitty/graphics-protocol/#unicode-placeholders
 */

import type { IBufferLine } from 'common/buffer/Types';
import type { CellData } from 'common/buffer/CellData';
import { Attributes, BgFlags } from 'common/buffer/Constants';

// Placeholder character the client writes into every cell of a virtual placement.
export const PLACEHOLDER_CODEPOINT = 0x10EEEE;

// Combining chars encoding row/column numbers (and the image id MSB), in order:
// the n-th entry stands for the number n. Taken from kitty's gen/rowcolumn-diacritics.txt.
const DIACRITICS = [
  0x0305, 0x030D, 0x030E, 0x0310, 0x0312, 0x033D, 0x033E, 0x033F, 0x0346, 0x034A,
  0x034B, 0x034C, 0x0350, 0x0351, 0x0352, 0x0357, 0x035B, 0x0363, 0x0364, 0x0365,
  0x0366, 0x0367, 0x0368, 0x0369, 0x036A, 0x036B, 0x036C, 0x036D, 0x036E, 0x036F,
  0x0483, 0x0484, 0x0485, 0x0486, 0x0487, 0x0592, 0x0593, 0x0594, 0x0595, 0x0597,
  0x0598, 0x0599, 0x059C, 0x059D, 0x059E, 0x059F, 0x05A0, 0x05A1, 0x05A8, 0x05A9,
  0x05AB, 0x05AC, 0x05AF, 0x05C4, 0x0610, 0x0611, 0x0612, 0x0613, 0x0614, 0x0615,
  0x0616, 0x0617, 0x0657, 0x0658, 0x0659, 0x065A, 0x065B, 0x065D, 0x065E, 0x06D6,
  0x06D7, 0x06D8, 0x06D9, 0x06DA, 0x06DB, 0x06DC, 0x06DF, 0x06E0, 0x06E1, 0x06E2,
  0x06E4, 0x06E7, 0x06E8, 0x06EB, 0x06EC, 0x0730, 0x0732, 0x0733, 0x0735, 0x0736,
  0x073A, 0x073D, 0x073F, 0x0740, 0x0741, 0x0743, 0x0745, 0x0747, 0x0749, 0x074A,
  0x07EB, 0x07EC, 0x07ED, 0x07EE, 0x07EF, 0x07F0, 0x07F1, 0x07F3, 0x0816, 0x0817,
  0x0818, 0x0819, 0x081B, 0x081C, 0x081D, 0x081E, 0x081F, 0x0820, 0x0821, 0x0822,
  0x0823, 0x0825, 0x0826, 0x0827, 0x0829, 0x082A, 0x082B, 0x082C, 0x082D, 0x0951,
  0x0953, 0x0954, 0x0F82, 0x0F83, 0x0F86, 0x0F87, 0x135D, 0x135E, 0x135F, 0x17DD,
  0x193A, 0x1A17, 0x1A75, 0x1A76, 0x1A77, 0x1A78, 0x1A79, 0x1A7A, 0x1A7B, 0x1A7C,
  0x1B6B, 0x1B6D, 0x1B6E, 0x1B6F, 0x1B70, 0x1B71, 0x1B72, 0x1B73, 0x1CD0, 0x1CD1,
  0x1CD2, 0x1CDA, 0x1CDB, 0x1CE0, 0x1DC0, 0x1DC1, 0x1DC3, 0x1DC4, 0x1DC5, 0x1DC6,
  0x1DC7, 0x1DC8, 0x1DC9, 0x1DCB, 0x1DCC, 0x1DD1, 0x1DD2, 0x1DD3, 0x1DD4, 0x1DD5,
  0x1DD6, 0x1DD7, 0x1DD8, 0x1DD9, 0x1DDA, 0x1DDB, 0x1DDC, 0x1DDD, 0x1DDE, 0x1DDF,
  0x1DE0, 0x1DE1, 0x1DE2, 0x1DE3, 0x1DE4, 0x1DE5, 0x1DE6, 0x1DFE, 0x20D0, 0x20D1,
  0x20D4, 0x20D5, 0x20D6, 0x20D7, 0x20DB, 0x20DC, 0x20E1, 0x20E7, 0x20E9, 0x20F0,
  0x2CEF, 0x2CF0, 0x2CF1, 0x2DE0, 0x2DE1, 0x2DE2, 0x2DE3, 0x2DE4, 0x2DE5, 0x2DE6,
  0x2DE7, 0x2DE8, 0x2DE9, 0x2DEA, 0x2DEB, 0x2DEC, 0x2DED, 0x2DEE, 0x2DEF, 0x2DF0,
  0x2DF1, 0x2DF2, 0x2DF3, 0x2DF4, 0x2DF5, 0x2DF6, 0x2DF7, 0x2DF8, 0x2DF9, 0x2DFA,
  0x2DFB, 0x2DFC, 0x2DFD, 0x2DFE, 0x2DFF, 0xA66F, 0xA67C, 0xA67D, 0xA6F0, 0xA6F1,
  0xA8E0, 0xA8E1, 0xA8E2, 0xA8E3, 0xA8E4, 0xA8E5, 0xA8E6, 0xA8E7, 0xA8E8, 0xA8E9,
  0xA8EA, 0xA8EB, 0xA8EC, 0xA8ED, 0xA8EE, 0xA8EF, 0xA8F0, 0xA8F1, 0xAAB0, 0xAAB2,
  0xAAB3, 0xAAB7, 0xAAB8, 0xAABE, 0xAABF, 0xAAC1, 0xFE20, 0xFE21, 0xFE22, 0xFE23,
  0xFE24, 0xFE25, 0xFE26, 0x10A0F, 0x10A38, 0x1D185, 0x1D186, 0x1D187, 0x1D188, 0x1D189,
  0x1D1AA, 0x1D1AB, 0x1D1AC, 0x1D1AD, 0x1D242, 0x1D243, 0x1D244
];

const DIACRITIC_INDEX: Map<number, number> = new Map(DIACRITICS.map((cp, i) => [cp, i]));

// Decoded placeholder cell.
export interface IPlaceholderCell {
  imageId: number;
  placementId: number;
  row: number;
  col: number;
}

const enum Missing {
  VALUE = -1
}

// Whether the cell at `col` starts with the placeholder character.
export function isPlaceholder(line: IBufferLine, col: number): boolean {
  if (line.isCombined(col)) {
    return line.getString(col).codePointAt(0) === PLACEHOLDER_CODEPOINT;
  }
  return line.getCodePoint(col) === PLACEHOLDER_CODEPOINT;
}

/**
 * Decodes the placeholder at `col` of `line` into `out`, inferring missing
 * row/column numbers from `prev` (the decoded cell to the left, if any).
 * Returns false if the cell does not hold a placeholder.
 *
 * Per spec:
 * - the image id is the fg color (24-bit RGB or 256-palette index), its most
 *   significant byte is the optional third diacritic
 * - the placement id is the underline color (0 when unset)
 * - a missing row/column is inferred from the left neighbour if it belongs to
 *   the same image and placement (same row, next column), else it is 0
 */
export function decodePlaceholder(line: IBufferLine, col: number, cell: CellData, prev: IPlaceholderCell | undefined, out: IPlaceholderCell): boolean {
  if (!isPlaceholder(line, col)) {
    return false;
  }
  const combined = line.isCombined(col);
  line.loadCell(col, cell);

  let imageId = cell.getFgColor();
  if (imageId === -1) {
    return false;
  }
  let placementId = 0;
  if ((cell.bg & BgFlags.HAS_EXTENDED) && ~cell.extended.underlineColor && (cell.extended.underlineColor & Attributes.CM_MASK)) {
    placementId = cell.getUnderlineColor();
  }

  let row: number = Missing.VALUE;
  let column: number = Missing.VALUE;
  let msb: number = Missing.VALUE;
  if (combined) {
    // skip the placeholder itself (2 UTF-16 code units)
    const s = line.getString(col);
    let n = 0;
    for (let i = 2; i < s.length && n < 3; ++n) {
      const cp = s.codePointAt(i)!;
      i += cp > 0xFFFF ? 2 : 1;
      const v = DIACRITIC_INDEX.get(cp);
      if (v === undefined) break;
      if (n === 0) row = v;
      else if (n === 1) column = v;
      else msb = v;
    }
  }

  const sameAsPrev = prev !== undefined
    && prev.placementId === placementId
    && (prev.imageId & 0xFFFFFF) === imageId
    && (row === Missing.VALUE || prev.row === row);
  if (row === Missing.VALUE) {
    row = sameAsPrev ? prev!.row : 0;
  }
  if (column === Missing.VALUE) {
    column = sameAsPrev ? prev!.col + 1 : 0;
  }
  if (msb === Missing.VALUE && sameAsPrev && column === prev!.col + 1) {
    imageId = prev!.imageId;
  } else if (msb !== Missing.VALUE) {
    imageId |= msb << 24;
  }

  out.imageId = imageId >>> 0;
  out.placementId = placementId;
  out.row = row;
  out.col = column;
  return true;
}

// Encodes a row/column number as its diacritic (used by tests and demos).
export function placeholderDiacritic(n: number): string {
  return String.fromCodePoint(DIACRITICS[n]);
}
