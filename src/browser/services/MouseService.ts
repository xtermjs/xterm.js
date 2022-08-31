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
      this._renderService.dimensions.actualCellWidth,
      this._renderService.dimensions.actualCellHeight,
      isSelection
    );
  }

  public getMouseReportCoords(event: MouseEvent, element: HTMLElement, colCount: number, rowCount: number): { col: number, row: number, x: number, y: number } | undefined {
    const pixelCoords = getCoordsRelativeToElement(window, event, element);

    // due to rounding issue in zoom state pixel values might be negative at the edges
    // simply ignore the event effectively narrowing the active mouse area
    if (pixelCoords[0] < 0 || pixelCoords[1] < 0) {
      return undefined;
    }
    // also ignore if we exceed real pixel area
    if (pixelCoords[0] >= this._renderService.dimensions.canvasWidth || pixelCoords[1] >= this._renderService.dimensions.canvasHeight) {
      return undefined;
    }

    pixelCoords[0] = Math.round(pixelCoords[0]);
    pixelCoords[1] = Math.round(pixelCoords[1]);

    const cellCoords = this.getCoords(event, element, colCount, rowCount);
    if (!cellCoords) {
      return undefined;
    }
    return {
      col: cellCoords[0] - 1,
      row: cellCoords[1] - 1,
      x: pixelCoords[0],
      y: pixelCoords[1]
    };
  }
}
