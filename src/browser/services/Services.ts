/**
 * Copyright (c) 2019 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import { IEvent } from 'common/EventEmitter';
import { IRenderDimensions, IRenderer, CharacterJoinerHandler } from 'browser/renderer/Types';
import { IColorSet } from 'browser/Types';
import { ISelectionRedrawRequestEvent } from 'browser/selection/Types';
import { createDecorator } from 'common/services/ServiceRegistry';
import { IDisposable } from 'common/Types';

export const ICharSizeService = createDecorator<ICharSizeService>('CharSizeService');
export interface ICharSizeService {
  serviceBrand: any;

  readonly width: number;
  readonly height: number;
  readonly hasValidSize: boolean;

  readonly onCharSizeChange: IEvent<void>;

  measure(): void;
}

export const ICoreBrowserService = createDecorator<ICoreBrowserService>('CoreBrowserService');
export interface ICoreBrowserService {
  serviceBrand: any;

  readonly isFocused: boolean;
}

export const IMouseService = createDecorator<IMouseService>('MouseService');
export interface IMouseService {
  serviceBrand: any;

  getCoords(event: {clientX: number, clientY: number}, element: HTMLElement, colCount: number, rowCount: number, isSelection?: boolean): [number, number] | undefined;
  getRawByteCoords(event: MouseEvent, element: HTMLElement, colCount: number, rowCount: number): { x: number, y: number } | undefined;
}

export const IRenderService = createDecorator<IRenderService>('RenderService');
export interface IRenderService extends IDisposable {
  serviceBrand: any;

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

export const ISelectionService = createDecorator<ISelectionService>('SelectionService');
export interface ISelectionService {
  serviceBrand: any;

  readonly selectionText: string;
  readonly hasSelection: boolean;
  readonly selectionStart: [number, number] | undefined;
  readonly selectionEnd: [number, number] | undefined;

  readonly onLinuxMouseSelection: IEvent<string>;
  readonly onRedrawRequest: IEvent<ISelectionRedrawRequestEvent>;
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

export const ISoundService = createDecorator<ISoundService>('SoundService');
export interface ISoundService {
  serviceBrand: any;

  playBellSound(): void;
}
