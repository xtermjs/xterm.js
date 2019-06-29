/**
 * Copyright (c) 2019 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import { IEvent } from 'common/EventEmitter';
import { IRenderDimensions, IRenderer, CharacterJoinerHandler } from 'browser/renderer/Types';
import { IColorSet } from 'browser/Types';
import { ISelectionRedrawRequestEvent } from 'browser/selection/Types';

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

export interface ISelectionService {
  readonly selectionText: string;
  readonly hasSelection: boolean;
  readonly selectionStart: [number, number];
  readonly selectionEnd: [number, number];

  readonly onLinuxMouseSelection: IEvent<string>;
  readonly onRedrawRequest: IEvent<ISelectionRedrawRequestEvent>
  readonly onSelectionChange: IEvent<void>;

  disable(): void;
  enable(): void;
  reset(): void;
  setSelection(row: number, col: number, length: number): void;
  selectAll(): void;
  selectLines(start: number, end: number): void;
  clearSelection(): void;
  isClickInSelection(event: MouseEvent): boolean;
  selectWordAtCursor(event: MouseEvent): void;
  shouldColumnSelect(event: KeyboardEvent | MouseEvent): boolean;
  shouldForceSelection(event: MouseEvent): boolean;
  refresh(isLinuxMouseSelection?: boolean): void;
  onMouseDown(event: MouseEvent): void;
}
