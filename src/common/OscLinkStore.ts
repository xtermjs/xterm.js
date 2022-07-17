/**
 * Copyright (c) 2022 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import { IBufferService } from 'common/services/Services';
import { IHyperlinkIdentifier, IMarker } from 'common/Types';

export class OscLinkStore {
  private _currentHyperlink?: IPendingOscLink;

  // private _linkMap: Map<string, Map<string, Link>> = new Map();
  // private _linksByLine: Map<number, IOscLink> = new Map();
  // private _linksById: Map<string, Map<string, IOscLink>> = new Map();
  private _linkStore = new LinkStore();

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
    this._linkStore.add(this._currentHyperlink.id, {
      id: this._currentHyperlink.id,
      ranges
    });
    console.log('finalize links', this._currentHyperlink, ranges);
    this._currentHyperlink = undefined;
    // TODO: Finalize link
  }

  public addCellToLink(x: number, y: number, width: number): void {
    if (!this._currentHyperlink) {
      return;
    }
    let cell: IMarkerCell;
    if (this._currentHyperlink.cells.length > 0 && y === this._currentHyperlink.cells[this._currentHyperlink.cells.length - 1].y.line) {
      cell = { x, y: this._currentHyperlink.cells[this._currentHyperlink.cells.length - 1].y, width };
    } else {
      cell = { x, y: this._bufferService.buffer.addMarker(y), width };
    }
    this._currentHyperlink.cells.push(cell);
  }

  public getByLine(y: number): IOscLink[] {
    return this._linkStore.getByLine(y);
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
      length: lastCell.width
    };
    const ranges: IMarkerRange[] = [currentRange];
    for (let i = 1; i < cells.length; i++) {
      currentCell = cells[i];
      if (currentCell.y.line === lastCell.y.line && currentCell.x === lastCell.x + lastCell.width) {
        currentRange.length += currentCell.width;
      } else {
        currentRange = {
          x: currentCell.x,
          y: currentCell.y,
          length: currentCell.width
        };
        ranges.push(currentRange);
      }
      lastCell = currentCell;
    }
    return ranges;
  }
}

export interface IOscLink {
  id: IHyperlinkIdentifier;
  ranges: IMarkerRange[];
}

interface IPendingOscLink {
  id: IHyperlinkIdentifier;
  cells: IMarkerCell[];
}

interface IMarkerRange {
  // TODO: How to handle wrapped lines?
  x: number;
  y: IMarker;
  length: number;
}

interface IMarkerCell {
  x: number;
  y: IMarker;
  width: number;
}

class LinkStore {
  private _entriesNoId: IOscLink[] = [];
  private _entriesById: { [id: string]: { [link: string]: IOscLink | undefined } | undefined } = {};

  public clear(): void {
    this._entriesById = {};
  }

  public add(linkIdentifier: IHyperlinkIdentifier, link: IOscLink): void {
    // TODO: Remove links when markers dispose
    if (!linkIdentifier.id) {
      this._entriesNoId.push(link);
      return;
    }
    if (!this._entriesById[linkIdentifier.id]) {
      this._entriesById[linkIdentifier.id] = {};
    }
    const existingLink = this._entriesById[linkIdentifier.id]![linkIdentifier.uri];
    if (existingLink) {
      existingLink.ranges.push(...link.ranges);
    } else {
      this._entriesById[linkIdentifier.id]![linkIdentifier.uri] = link;
    }
  }

  public getAll(): IOscLink[] {
    const result = this._entriesNoId.slice();
    const ids = Object.keys(this._entriesById);
    for (const id of ids) {
      const byUri = this._entriesById[id];
      if (!byUri) {
        continue;
      }
      const uris = Object.keys(byUri);
      for (const uri of uris) {
        const link = byUri[uri];
        if (link) {
          result.push(link);
        }
      }
    }
    return result;
  }

  public getByLine(y: number): IOscLink[] {
    // This is very much not optimized, creating a new array and iterating over everything on each
    // request.
    const result: IOscLink[] = [];
    for (const link of this.getAll()) {
      if (link.ranges.some(e => e.y.line === y)) {
        result.push(link);
      }
    }
    return result;
  }
}
