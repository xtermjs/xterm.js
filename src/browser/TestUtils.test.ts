/**
 * Copyright (c) 2019 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import { IEvent, EventEmitter } from 'common/EventEmitter';
import { ICharSizeService, IMouseService, IRenderService } from 'browser/services/Services';
import { IRenderDimensions, IRenderer, CharacterJoinerHandler } from 'browser/renderer/Types';
import { IColorSet } from 'browser/Types';

export class MockCharSizeService implements ICharSizeService {
  serviceBrand: any;
  get hasValidSize(): boolean { return this.width > 0 && this.height > 0; }
  onCharSizeChange: IEvent<void> = new EventEmitter<void>().event;
  constructor(public width: number, public height: number) {}
  measure(): void {}
}

export class MockMouseService implements IMouseService {
  serviceBrand: any;
  public getCoords(event: {clientX: number, clientY: number}, element: HTMLElement, colCount: number, rowCount: number, isSelection?: boolean): [number, number] | undefined {
    throw new Error('Not implemented');
  }

  public getRawByteCoords(event: MouseEvent, element: HTMLElement, colCount: number, rowCount: number): { x: number, y: number } | undefined {
    throw new Error('Not implemented');
  }
}

export class MockRenderService implements IRenderService {
  serviceBrand: any;
  onDimensionsChange: IEvent<IRenderDimensions> = new EventEmitter<IRenderDimensions>().event;
  onRenderedBufferChange: IEvent<{ start: number, end: number }, void> = new EventEmitter<{ start: number, end: number }>().event;
  onRefreshRequest: IEvent<{ start: number, end: number}, void> = new EventEmitter<{ start: number, end: number }>().event;
  dimensions: IRenderDimensions = {
    scaledCharWidth: 0,
    scaledCharHeight: 0,
    scaledCellWidth: 0,
    scaledCellHeight: 0,
    scaledCharLeft: 0,
    scaledCharTop: 0,
    scaledCanvasWidth: 0,
    scaledCanvasHeight: 0,
    canvasWidth: 0,
    canvasHeight: 0,
    actualCellWidth: 0,
    actualCellHeight: 0
  };
  refreshRows(start: number, end: number): void {
    throw new Error('Method not implemented.');
  }
  resize(cols: number, rows: number): void {
    throw new Error('Method not implemented.');
  }
  changeOptions(): void {
    throw new Error('Method not implemented.');
  }
  setRenderer(renderer: IRenderer): void {
    throw new Error('Method not implemented.');
  }
  setColors(colors: IColorSet): void {
    throw new Error('Method not implemented.');
  }
  onDevicePixelRatioChange(): void {
    throw new Error('Method not implemented.');
  }
  onResize(cols: number, rows: number): void {
    throw new Error('Method not implemented.');
  }
  onCharSizeChanged(): void {
    throw new Error('Method not implemented.');
  }
  onBlur(): void {
    throw new Error('Method not implemented.');
  }
  onFocus(): void {
    throw new Error('Method not implemented.');
  }
  onSelectionChanged(start: [number, number], end: [number, number], columnSelectMode: boolean): void {
    throw new Error('Method not implemented.');
  }
  onCursorMove(): void {
    throw new Error('Method not implemented.');
  }
  clear(): void {
    throw new Error('Method not implemented.');
  }
  registerCharacterJoiner(handler: CharacterJoinerHandler): number {
    throw new Error('Method not implemented.');
  }
  deregisterCharacterJoiner(joinerId: number): boolean {
    throw new Error('Method not implemented.');
  }
  dispose(): void {
    throw new Error('Method not implemented.');
  }
}
