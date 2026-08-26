/**
 * Copyright (c) 2026 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import type { ITextureAtlasDirtyRect } from './Types';

export const enum UploadPlannerConstants {
  BUFFER_MERGE_GAP_BYTES = 256,
  ATLAS_COPY_CALL_PIXEL_COST = 4096
}

export interface IBufferUploadRange {
  readonly byteOffset: number;
  readonly byteLength: number;
}

export interface IBufferUploadPlan {
  readonly ranges: ReadonlyArray<IBufferUploadRange>;
  readonly sourceRangeCount: number;
  readonly dirtyCellCount: number;
  readonly sourceUploadByteLength: number;
  readonly uploadByteLength: number;
  readonly overfetchByteLength: number;
}

export interface IAtlasUploadRect {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export interface IAtlasUploadPlan {
  readonly rects: ReadonlyArray<IAtlasUploadRect>;
  readonly sourceRectCount: number;
  readonly uploadPixels: number;
  readonly isFullUpload: boolean;
}

interface IAtlasUploadCandidate {
  readonly rects: ReadonlyArray<IAtlasUploadRect>;
  readonly uploadPixels: number;
  readonly score: number;
}

/** Tracks exact dirty cells while retaining row bounds for cheap planning. */
export class DirtyCellUploadTracker {
  private readonly _dirtyCells: Uint8Array;
  private readonly _minDirtyX: Int32Array;
  private readonly _maxDirtyX: Int32Array;
  private _dirtyCellCount = 0;

  constructor(
    private readonly _cols: number,
    private readonly _rows: number,
    private readonly _bytesPerCell: number
  ) {
    this._dirtyCells = new Uint8Array(_cols * _rows);
    this._minDirtyX = new Int32Array(_rows);
    this._maxDirtyX = new Int32Array(_rows);
    this._resetRowBounds();
  }

  public mark(x: number, y: number): void {
    if (x < 0 || x >= this._cols || y < 0 || y >= this._rows) {
      return;
    }
    const index = y * this._cols + x;
    if (this._dirtyCells[index]) {
      return;
    }
    this._dirtyCells[index] = 1;
    this._dirtyCellCount++;
    if (x < this._minDirtyX[y]) {
      this._minDirtyX[y] = x;
    }
    if (x > this._maxDirtyX[y]) {
      this._maxDirtyX[y] = x;
    }
  }

  public markAll(): void {
    if (this._cols === 0 || this._rows === 0) {
      return;
    }
    this._dirtyCells.fill(1);
    this._dirtyCellCount = this._cols * this._rows;
    this._minDirtyX.fill(0);
    this._maxDirtyX.fill(this._cols - 1);
  }

  /** Builds an upload plan without consuming dirty state. */
  public plan(): IBufferUploadPlan {
    const sourceRanges: IBufferUploadRange[] = [];
    let sourceUploadByteLength = 0;

    for (let y = 0; y < this._rows; y++) {
      const minX = this._minDirtyX[y];
      const maxX = this._maxDirtyX[y];
      if (maxX < minX) {
        continue;
      }
      let x = minX;
      while (x <= maxX) {
        while (x <= maxX && this._dirtyCells[y * this._cols + x] === 0) {
          x++;
        }
        if (x > maxX) {
          break;
        }
        const startX = x;
        while (x <= maxX && this._dirtyCells[y * this._cols + x] !== 0) {
          x++;
        }
        const byteOffset = (y * this._cols + startX) * this._bytesPerCell;
        const byteEnd = (y * this._cols + x) * this._bytesPerCell;
        const previous = sourceRanges[sourceRanges.length - 1];
        if (previous && byteOffset - (previous.byteOffset + previous.byteLength) <= UploadPlannerConstants.BUFFER_MERGE_GAP_BYTES) {
          const merged = { byteOffset: previous.byteOffset, byteLength: byteEnd - previous.byteOffset };
          sourceUploadByteLength += merged.byteLength - previous.byteLength;
          sourceRanges[sourceRanges.length - 1] = merged;
        } else {
          const range = { byteOffset, byteLength: byteEnd - byteOffset };
          sourceUploadByteLength += range.byteLength;
          sourceRanges.push(range);
        }
      }
    }

    if (sourceRanges.length === 0) {
      return {
        ranges: [],
        sourceRangeCount: 0,
        dirtyCellCount: 0,
        sourceUploadByteLength: 0,
        uploadByteLength: 0,
        overfetchByteLength: 0
      };
    }

    return {
      ranges: sourceRanges,
      sourceRangeCount: sourceRanges.length,
      dirtyCellCount: this._dirtyCellCount,
      sourceUploadByteLength,
      uploadByteLength: sourceUploadByteLength,
      overfetchByteLength: sourceUploadByteLength - this._dirtyCellCount * this._bytesPerCell
    };
  }

  /** Consumes all currently tracked dirty cells after every planned upload succeeded. */
  public commit(): void {
    this._dirtyCells.fill(0);
    this._dirtyCellCount = 0;
    this._resetRowBounds();
  }

  private _resetRowBounds(): void {
    this._minDirtyX.fill(this._cols);
    this._maxDirtyX.fill(-1);
  }
}

export function planAtlasUploads(
  pageWidth: number,
  pageHeight: number,
  dirtyRects: ReadonlyArray<ITextureAtlasDirtyRect> | undefined
): IAtlasUploadPlan {
  const fullRect: IAtlasUploadRect = { x: 0, y: 0, width: pageWidth, height: pageHeight };
  const fullPixels = pageWidth * pageHeight;
  if (!dirtyRects || dirtyRects.length === 0) {
    return { rects: [fullRect], sourceRectCount: dirtyRects?.length ?? 0, uploadPixels: fullPixels, isFullUpload: true };
  }

  const clipped = dirtyRects.map(rect => clipRect(rect, pageWidth, pageHeight)).filter((rect): rect is IAtlasUploadRect => !!rect);
  if (clipped.length === 0) {
    return { rects: [fullRect], sourceRectCount: dirtyRects.length, uploadPixels: fullPixels, isFullUpload: true };
  }

  const bounds = boundingRect(clipped);
  const candidates: IAtlasUploadCandidate[] = [
    createCandidate(clipped),
    createCandidate([bounds]),
    createCandidate([fullRect])
  ];
  candidates.sort((a, b) => a.score - b.score || a.rects.length - b.rects.length || a.uploadPixels - b.uploadPixels);
  const selected = candidates[0];
  return {
    rects: selected.rects,
    sourceRectCount: dirtyRects.length,
    uploadPixels: selected.uploadPixels,
    isFullUpload: selected.rects.length === 1 && isSameRect(selected.rects[0], fullRect)
  };
}

function createCandidate(rects: ReadonlyArray<IAtlasUploadRect>): IAtlasUploadCandidate {
  const uploadPixels = rects.reduce((total, rect) => total + rect.width * rect.height, 0);
  return {
    rects,
    uploadPixels,
    score: uploadPixels + rects.length * UploadPlannerConstants.ATLAS_COPY_CALL_PIXEL_COST
  };
}

function clipRect(rect: ITextureAtlasDirtyRect, pageWidth: number, pageHeight: number): IAtlasUploadRect | undefined {
  const x = Math.max(0, Math.min(pageWidth, rect.x));
  const y = Math.max(0, Math.min(pageHeight, rect.y));
  const right = Math.max(x, Math.min(pageWidth, rect.x + rect.width));
  const bottom = Math.max(y, Math.min(pageHeight, rect.y + rect.height));
  return right > x && bottom > y ? { x, y, width: right - x, height: bottom - y } : undefined;
}

function boundingRect(rects: ReadonlyArray<IAtlasUploadRect>): IAtlasUploadRect {
  let left = rects[0].x;
  let top = rects[0].y;
  let right = left + rects[0].width;
  let bottom = top + rects[0].height;
  for (let i = 1; i < rects.length; i++) {
    left = Math.min(left, rects[i].x);
    top = Math.min(top, rects[i].y);
    right = Math.max(right, rects[i].x + rects[i].width);
    bottom = Math.max(bottom, rects[i].y + rects[i].height);
  }
  return { x: left, y: top, width: right - left, height: bottom - top };
}

function isSameRect(a: IAtlasUploadRect, b: IAtlasUploadRect): boolean {
  return a.x === b.x && a.y === b.y && a.width === b.width && a.height === b.height;
}
