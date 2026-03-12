/**
 * Copyright (c) 2026 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import { getWindow } from 'browser/Dom';
import { getCoords, getCoordsRelativeToElement } from 'browser/input/Mouse';
import { ICharSizeService, IMouseCoordsService, IRenderService } from 'browser/services/Services';

export class MouseCoordsService implements IMouseCoordsService {
  public serviceBrand: undefined;

  constructor(
    @ICharSizeService private readonly _charSizeService: ICharSizeService,
    @IRenderService private readonly _renderService: IRenderService
  ) {
  }

  public getCoords(event: {clientX: number, clientY: number}, element: HTMLElement, colCount: number, rowCount: number, isSelection?: boolean): [number, number] | undefined {
    return getCoords(
      window,
      event,
      element,
      colCount,
      rowCount,
      this._charSizeService.hasValidSize,
      this._renderService.dimensions.css.cell.width,
      this._renderService.dimensions.css.cell.height,
      isSelection
    );
  }

  public getMouseReportCoords(event: MouseEvent, element: HTMLElement): { col: number, row: number, x: number, y: number } | undefined {
    const coords = getCoordsRelativeToElement(getWindow(element), event, element);
    if (!this._charSizeService.hasValidSize) {
      return undefined;
    }
    coords[0] = Math.min(Math.max(coords[0], 0), this._renderService.dimensions.css.canvas.width - 1);
    coords[1] = Math.min(Math.max(coords[1], 0), this._renderService.dimensions.css.canvas.height - 1);
    return {
      col: Math.floor(coords[0] / this._renderService.dimensions.css.cell.width),
      row: Math.floor(coords[1] / this._renderService.dimensions.css.cell.height),
      x: Math.floor(coords[0]),
      y: Math.floor(coords[1])
    };
  }
}
