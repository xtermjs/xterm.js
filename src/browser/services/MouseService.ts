/**
 * Copyright (c) 2017 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import { ICharSizeService, IRenderService, IMouseService } from './Services';
import { getCoords, getCoordsRelativeToElement } from 'browser/input/Mouse';

export class MouseService implements IMouseService {
  public serviceBrand: undefined;

  constructor(
    @IRenderService private readonly _renderService: IRenderService,
    @ICharSizeService private readonly _charSizeService: ICharSizeService
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
    const coords = getCoordsRelativeToElement(window, event, element);

    // due to rounding issues in zoom states pixel values might be negative or overflow actual canvas
    // ignore those events effectively narrowing mouse area a tiny bit at the edges
    if (!this._charSizeService.hasValidSize
      || coords[0] < 0
      || coords[1] < 0
      || coords[0] >= this._renderService.dimensions.css.canvas.width
      || coords[1] >= this._renderService.dimensions.css.canvas.height) {
      return undefined;
    }

    return {
      col: Math.floor(coords[0] / this._renderService.dimensions.css.cell.width),
      row: Math.floor(coords[1] / this._renderService.dimensions.css.cell.height),
      x: Math.floor(coords[0]),
      y: Math.floor(coords[1])
    };
  }
}
