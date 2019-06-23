/**
 * Copyright (c) 2019 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import { CellData } from 'common/buffer/CellData';
import { FLAGS } from './Constants';
import { IBufferLine } from 'common/Types';

export function getCompatAttr(bufferLine: IBufferLine, index: number): number {
  // TODO: Need to move WebGL over to the new system and remove this block
  const cell = new CellData();
  bufferLine.loadCell(index, cell);
  const oldBg = cell.getBgColor() === -1 ? 256 : cell.getBgColor();
  const oldFg = cell.getFgColor() === -1 ? 256 : cell.getFgColor();
  const oldAttr =
    (cell.isBold() ? FLAGS.BOLD : 0) |
    (cell.isUnderline() ? FLAGS.UNDERLINE : 0) |
    (cell.isBlink() ? FLAGS.BLINK : 0) |
    (cell.isInverse() ? FLAGS.INVERSE : 0) |
    (cell.isDim() ? FLAGS.DIM : 0) |
    (cell.isItalic() ? FLAGS.ITALIC : 0);
  const attrCompat =
    oldBg |
    (oldFg << 9) |
    (oldAttr << 18);
  return attrCompat;
}
