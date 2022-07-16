/**
 * Copyright (c) 2022 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import { IBufferService } from 'common/services/Services';
import { IHyperlinkIdentifier, IMarker } from 'common/Types';

export class OscLinkifier {
  private _currentHyperlink?: IPendingOscLink;

  // private _linkMap: Map<string, Map<string, Link>> = new Map();
  private _linksByLine: Map<number, IOscLink> = new Map();
  private _linksById: Map<string, Map<string, IOscLink>> = new Map();

  constructor(
    @IBufferService private readonly _bufferService: IBufferService
  ) {
  }

  public startHyperlink(linkId: IHyperlinkIdentifier): void {
    this._currentHyperlink = {
      id: linkId,
      cells: []
    };
  }

  public finishHyperlink(): void {
    if (!this._currentHyperlink || this._currentHyperlink.cells.length === 0) {
      this._currentHyperlink = undefined;
      return;
    }
    const ranges = this._convertCellsToRanges(this._currentHyperlink.cells);
    console.log('finalize links', this._currentHyperlink, ranges);
    this._currentHyperlink = undefined;
    // TODO: Finalize link
  }

  public addCellToLink(x: number, y: number): void {
    if (!this._currentHyperlink) {
      return;
    }
    let cell: IMarkerCell;
    if (this._currentHyperlink.cells.length > 0 && y === this._currentHyperlink.cells[this._currentHyperlink.cells.length - 1].y.line) {
      cell = { x, y: this._currentHyperlink.cells[this._currentHyperlink.cells.length - 1].y };
    } else {
      cell = { x, y: this._bufferService.buffer.addMarker(y) };
    }
    this._currentHyperlink.cells.push(cell);
  }

  /**
   * Converts an array of cells to ranges, sharing y markers between adjacent entries when possible.
   */
  private _convertCellsToRanges(cells: IMarkerCell[]): IMarkerRange[] {
    if (cells.length === 0) {
      return [];
    }
    let currentCell: IMarkerCell;
    let lastCell: IMarkerCell = cells[0];
    let currentRange: IMarkerRange = {
      x: lastCell.x,
      y: lastCell.y,
      // TODO: Wide chars
      length: 1
    };
    const ranges: IMarkerRange[] = [currentRange];
    for (let i = 1; i < cells.length; i++) {
      currentCell = cells[i];
      if (currentCell.y.line === lastCell.y.line && currentCell.x === lastCell.x + 1) {
        currentRange.length++;
      } else {
        currentRange = {
          x: currentCell.x,
          y: currentCell.y,
          length: 1
        };
        ranges.push(currentRange);
      }
      lastCell = currentCell;
    }
    return ranges;
  }
}

interface IOscLink {
  ranges: IMarkerRange[];
}

interface IPendingOscLink {
  id: IHyperlinkIdentifier;
  cells: IMarkerCell[];
}

interface IMarkerRange {
  // TODO: How to handle wrapped lines?
  x: number;
  length: number;
  y: IMarker;
}

interface IMarkerCell {
  x: number;
  y: IMarker;
}
