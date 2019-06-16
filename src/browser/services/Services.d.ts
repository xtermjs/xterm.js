/**
 * Copyright (c) 2019 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import { IEvent } from 'common/EventEmitter';
import { IRenderDimensions, IRenderer, CharacterJoinerHandler } from 'browser/renderer/Types';
import { IColorSet } from 'browser/Types';

export interface ICharSizeService {
  readonly width: number;
  readonly height: number;
  readonly hasValidSize: boolean;

  readonly onCharSizeChange: IEvent<void>;

  measure(): void;
}

export interface IMouseService {
  getCoords(event: {clientX: number, clientY: number}, element: HTMLElement, colCount: number, rowCount: number, isSelection?: boolean): [number, number] | undefined;
  getRawByteCoords(event: MouseEvent, element: HTMLElement, colCount: number, rowCount: number): { x: number, y: number } | undefined;
}

export interface IRenderService {
  onDimensionsChange: IEvent<IRenderDimensions>;
  onRender: IEvent<{ start: number, end: number }>;
  onRefreshRequest: IEvent<{ start: number, end: number }>;

  dimensions: IRenderDimensions;

  refreshRows(start: number, end: number): void;
  resize(cols: number, rows: number): void;
  changeOptions(): void;
  setRenderer(renderer: IRenderer): void;
  setColors(colors: IColorSet): void;
  onDevicePixelRatioChange(): void;
  onResize(cols: number, rows: number): void;
  // TODO: Is this useful when we have onResize?
  onCharSizeChanged(): void;
  onBlur(): void;
  onFocus(): void;
  onSelectionChanged(start: [number, number], end: [number, number], columnSelectMode: boolean): void;
  onCursorMove(): void;
  clear(): void;
  registerCharacterJoiner(handler: CharacterJoinerHandler): number;
  deregisterCharacterJoiner(joinerId: number): boolean;
}
