/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IInternalDecoration } from 'common/services/Services';

export interface IColorZoneStore {
  readonly zones: IColorZone[];
  clear(): void;
  addDecoration(decoration: IInternalDecoration): void;
  /**
   * Sets the amount of padding in lines that will be added between zones, if new lines intersect
   * the padding they will be merged into the same zone.
   */
  setPadding(padding: { [position: string]: number }): void;
}

export interface IColorZone {
  /** Color in a format supported by canvas' fillStyle. */
  color: string;
  position: 'full' | 'left' | 'center' | 'right' | undefined;
  startBufferLine: number;
  endBufferLine: number;
}

export class ColorZoneStore implements IColorZoneStore {
  private _zones: IColorZone[] = [];
  public get zones(): IColorZone[] { return this._zones; }

  private _linePadding: { [position: string]: number } = {
    full: 0,
    left: 0,
    center: 0,
    right: 0
  };

  public clear(): void {
    this._zones.length = 0;
  }

  public addDecoration(decoration: IInternalDecoration): void {
    if (!decoration.options.overviewRulerOptions) {
      return;
    }
    for (const z of this._zones) {
      if (z.color === decoration.options.overviewRulerOptions.color &&
          z.position === decoration.options.overviewRulerOptions.position) {
        if (this._lineIntersectsZone(z, decoration.marker.line)) {
          return;
        }
        if (this._lineAdjacentToZone(z, decoration.marker.line, decoration.options.overviewRulerOptions.position)) {
          this._addLineToZone(z, decoration.marker.line);
          return;
        }
      }
    }
    // TODO: Track zones in an object pool to reduce GC
    this._zones.push({
      color: decoration.options.overviewRulerOptions.color,
      position: decoration.options.overviewRulerOptions.position,
      startBufferLine: decoration.marker.line,
      endBufferLine: decoration.marker.line
    });
  }

  public setPadding(padding: { [position: string]: number }): void {
    console.log('padding', padding);
    this._linePadding = padding;
  }

  private _lineIntersectsZone(zone: IColorZone, line: number): boolean {
    return (
      line >= zone.startBufferLine &&
      line <= zone.endBufferLine
    );
  }

  private _lineAdjacentToZone(zone: IColorZone, line: number, position: IColorZone['position']): boolean {
    return (
      (line >= zone.startBufferLine - this._linePadding[position || 'full'] * 2) &&
      (line <= zone.endBufferLine + this._linePadding[position || 'full'] * 2)
    );
  }

  private _addLineToZone(zone: IColorZone, line: number): void {
    zone.startBufferLine = Math.min(zone.startBufferLine, line);
    zone.endBufferLine = Math.max(zone.endBufferLine, line);
  }
}
