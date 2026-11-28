/**
 * Copyright (c) 2026 The xterm.js authors. All rights reserved.
 * @license MIT
 */
import { assert } from 'chai';
import { BufferLine } from 'common/buffer/BufferLine';
import { CellData } from 'common/buffer/CellData';
import { Attributes, BgFlags, Content } from 'common/buffer/Constants';
import { ExtendedAttrs } from 'common/buffer/AttributeData';
import { decodePlaceholder, IPlaceholderCell, placeholderDiacritic, PLACEHOLDER_CODEPOINT } from './KittyPlaceholder';

const PLACEHOLDER = String.fromCodePoint(PLACEHOLDER_CODEPOINT);

function setCell(line: BufferLine, x: number, chars: string, fg: number, underlineColor: number = -1): void {
  const cell = new CellData();
  cell.fg = fg;
  if (chars.length > 2) {
    cell.content = Content.IS_COMBINED_MASK | (1 << Content.WIDTH_SHIFT);
    cell.combinedData = chars;
  } else {
    cell.content = chars.codePointAt(0)! | (1 << Content.WIDTH_SHIFT);
  }
  if (underlineColor !== -1) {
    cell.extended = new ExtendedAttrs();
    cell.extended.underlineColor = underlineColor;
    cell.bg |= BgFlags.HAS_EXTENDED;
  }
  line.setCell(x, cell);
}

function decodeLine(line: BufferLine): (IPlaceholderCell | undefined)[] {
  const result: (IPlaceholderCell | undefined)[] = [];
  const work = new CellData();
  let prev: IPlaceholderCell | undefined;
  for (let x = 0; x < line.length; ++x) {
    const out: IPlaceholderCell = { imageId: 0, placementId: 0, row: 0, col: 0 };
    prev = decodePlaceholder(line, x, work, prev, out) ? out : undefined;
    result.push(prev);
  }
  return result;
}

describe('KittyPlaceholder', () => {
  const rgb = (id: number): number => Attributes.CM_RGB | id;
  const d = placeholderDiacritic;

  it('ignores cells that are not placeholders', () => {
    const line = new BufferLine(2);
    setCell(line, 0, 'a', rgb(1));
    assert.deepEqual(decodeLine(line), [undefined, undefined]);
  });

  it('ignores placeholders with the default fg color (no image id)', () => {
    const line = new BufferLine(1);
    setCell(line, 0, PLACEHOLDER + d(0) + d(0), 0);
    assert.deepEqual(decodeLine(line), [undefined]);
  });

  it('decodes row and column diacritics', () => {
    const line = new BufferLine(2);
    setCell(line, 0, PLACEHOLDER + d(3) + d(7), rgb(42));
    setCell(line, 1, PLACEHOLDER + d(3) + d(8), rgb(42));
    assert.deepEqual(decodeLine(line), [
      { imageId: 42, placementId: 0, row: 3, col: 7 },
      { imageId: 42, placementId: 0, row: 3, col: 8 }
    ]);
  });

  it('decodes diacritics outside the BMP', () => {
    const line = new BufferLine(1);
    setCell(line, 0, PLACEHOLDER + d(296) + d(200), rgb(1));
    assert.deepEqual(decodeLine(line)[0], { imageId: 1, placementId: 0, row: 296, col: 200 });
  });

  it('takes the image id from a 256-color fg', () => {
    const line = new BufferLine(1);
    setCell(line, 0, PLACEHOLDER + d(0) + d(0), Attributes.CM_P256 | 200);
    assert.strictEqual(decodeLine(line)[0]!.imageId, 200);
  });

  it('takes the image id MSB from the third diacritic', () => {
    const line = new BufferLine(1);
    setCell(line, 0, PLACEHOLDER + d(0) + d(0) + d(2), rgb(0x010203));
    assert.strictEqual(decodeLine(line)[0]!.imageId, 0x02010203);
  });

  it('takes the placement id from the underline color', () => {
    const line = new BufferLine(1);
    setCell(line, 0, PLACEHOLDER + d(0) + d(0), rgb(5), Attributes.CM_RGB | 9);
    assert.strictEqual(decodeLine(line)[0]!.placementId, 9);
  });

  it('infers row, column and MSB from the left neighbour', () => {
    const line = new BufferLine(3);
    setCell(line, 0, PLACEHOLDER + d(2) + d(4) + d(1), rgb(7));
    setCell(line, 1, PLACEHOLDER, rgb(7));
    setCell(line, 2, PLACEHOLDER + d(2), rgb(7));
    assert.deepEqual(decodeLine(line), [
      { imageId: 0x01000007, placementId: 0, row: 2, col: 4 },
      { imageId: 0x01000007, placementId: 0, row: 2, col: 5 },
      { imageId: 0x01000007, placementId: 0, row: 2, col: 6 }
    ]);
  });

  it('starts at 0 when the left neighbour belongs to another image or row', () => {
    const line = new BufferLine(3);
    setCell(line, 0, PLACEHOLDER + d(1) + d(4), rgb(7));
    setCell(line, 1, PLACEHOLDER, rgb(8));
    setCell(line, 2, PLACEHOLDER + d(2), rgb(8));
    assert.deepEqual(decodeLine(line), [
      { imageId: 7, placementId: 0, row: 1, col: 4 },
      { imageId: 8, placementId: 0, row: 0, col: 0 },
      { imageId: 8, placementId: 0, row: 2, col: 0 }
    ]);
  });
});
