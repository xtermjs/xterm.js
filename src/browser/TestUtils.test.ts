/**
 * Copyright (c) 2019 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import { IEvent, EventEmitter } from 'common/EventEmitter';
import { ICharSizeService, IMouseService, IRenderService } from 'browser/services/Services';
import { IRenderDimensions, IRenderer, CharacterJoinerHandler } from 'browser/renderer/Types';
import { IColorSet } from 'browser/Types';

export class MockCharSizeService implements ICharSizeService {
  public serviceBrand: undefined;
  public get hasValidSize(): boolean { return this.width > 0 && this.height > 0; }
  public onCharSizeChange: IEvent<void> = new EventEmitter<void>().event;
  constructor(public width: number, public height: number) {}
  public measure(): void {}
}

export class MockMouseService implements IMouseService {
  public serviceBrand: undefined;
  public getCoords(event: {clientX: number, clientY: number}, element: HTMLElement, colCount: number, rowCount: number, isSelection?: boolean): [number, number] | undefined {
    throw new Error('Not implemented');
  }

  public getRawByteCoords(event: MouseEvent, element: HTMLElement, colCount: number, rowCount: number): { x: number, y: number } | undefined {
    throw new Error('Not implemented');
  }
}

export class MockRenderService implements IRenderService {
  public serviceBrand: undefined;
  public onDimensionsChange: IEvent<IRenderDimensions> = new EventEmitter<IRenderDimensions>().event;
  public onRenderedBufferChange: IEvent<{ start: number, end: number }, void> = new EventEmitter<{ start: number, end: number }>().event;
  public onRefreshRequest: IEvent<{ start: number, end: number}, void> = new EventEmitter<{ start: number, end: number }>().event;
  public dimensions: IRenderDimensions = {
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
  public refreshRows(start: number, end: number): void {
    throw new Error('Method not implemented.');
  }
  public resize(cols: number, rows: number): void {
    throw new Error('Method not implemented.');
  }
  public changeOptions(): void {
    throw new Error('Method not implemented.');
  }
  public setRenderer(renderer: IRenderer): void {
    throw new Error('Method not implemented.');
  }
  public setColors(colors: IColorSet): void {
    throw new Error('Method not implemented.');
  }
  public onDevicePixelRatioChange(): void {
    throw new Error('Method not implemented.');
  }
  public onResize(cols: number, rows: number): void {
    throw new Error('Method not implemented.');
  }
  public onCharSizeChanged(): void {
    throw new Error('Method not implemented.');
  }
  public onBlur(): void {
    throw new Error('Method not implemented.');
  }
  public onFocus(): void {
    throw new Error('Method not implemented.');
  }
  public onSelectionChanged(start: [number, number], end: [number, number], columnSelectMode: boolean): void {
    throw new Error('Method not implemented.');
  }
  public onCursorMove(): void {
    throw new Error('Method not implemented.');
  }
  public clear(): void {
    throw new Error('Method not implemented.');
  }
  public registerCharacterJoiner(handler: CharacterJoinerHandler): number {
    throw new Error('Method not implemented.');
  }
  public deregisterCharacterJoiner(joinerId: number): boolean {
    throw new Error('Method not implemented.');
  }
  public dispose(): void {
    throw new Error('Method not implemented.');
  }
}
