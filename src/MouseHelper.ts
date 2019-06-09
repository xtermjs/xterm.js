/**
 * Copyright (c) 2017 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import { IMouseHelper } from './Types';
import { RenderService } from 'browser/services/RenderService';
import { ICharSizeService } from 'browser/services/Services';

export class MouseHelper implements IMouseHelper {
  constructor(
    private _renderService: RenderService,
    private _charSizeService: ICharSizeService
  ) {
  }

  public static getCoordsRelativeToElement(event: {clientX: number, clientY: number}, element: HTMLElement): [number, number] {
    const rect = element.getBoundingClientRect();
    return [event.clientX - rect.left, event.clientY - rect.top];
  }

  /**
   * Gets coordinates within the terminal for a particular mouse event. The result
   * is returned as an array in the form [x, y] instead of an object as it's a
   * little faster and this function is used in some low level code.
   * @param event The mouse event.
   * @param element The terminal's container element.
   * @param colCount The number of columns in the terminal.
   * @param rowCount The number of rows n the terminal.
   * @param isSelection Whether the request is for the selection or not. This will
   * apply an offset to the x value such that the left half of the cell will
   * select that cell and the right half will select the next cell.
   */
  public getCoords(event: {clientX: number, clientY: number}, element: HTMLElement, colCount: number, rowCount: number, isSelection?: boolean): [number, number] {
    // Coordinates cannot be measured if there are no valid
    if (!this._charSizeService.hasValidSize) {
      return null;
    }

    const coords = MouseHelper.getCoordsRelativeToElement(event, element);
    if (!coords) {
      return null;
    }

    coords[0] = Math.ceil((coords[0] + (isSelection ? this._renderService.dimensions.actualCellWidth / 2 : 0)) / this._renderService.dimensions.actualCellWidth);
    coords[1] = Math.ceil(coords[1] / this._renderService.dimensions.actualCellHeight);

    // Ensure coordinates are within the terminal viewport. Note that selections
    // need an addition point of precision to cover the end point (as characters
    // cover half of one char and half of the next).
    coords[0] = Math.min(Math.max(coords[0], 1), colCount + (isSelection ? 1 : 0));
    coords[1] = Math.min(Math.max(coords[1], 1), rowCount);

    return coords;
  }

  /**
   * Gets coordinates within the terminal for a particular mouse event, wrapping
   * them to the bounds of the terminal and adding 32 to both the x and y values
   * as expected by xterm.
   * @param event The mouse event.
   * @param element The terminal's container element.
   * @param colCount The number of columns in the terminal.
   * @param rowCount The number of rows in the terminal.
   */
  public getRawByteCoords(event: MouseEvent, element: HTMLElement, colCount: number, rowCount: number): { x: number, y: number } {
    const coords = this.getCoords(event, element, colCount, rowCount);
    let x = coords[0];
    let y = coords[1];

    // xterm sends raw bytes and starts at 32 (SP) for each.
    x += 32;
    y += 32;

    return { x, y };
  }
}
