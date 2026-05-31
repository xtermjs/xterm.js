/**
 * Copyright (c) 2019 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import type { IEvent } from 'common/Event';
import type { IAttributeData } from 'common/buffer/CellTypes';
import type { IBuffer, IBufferSet } from 'common/buffer/Types';

export interface IBufferResizeEvent {
  cols: number;
  rows: number;
  colsChanged: boolean;
  rowsChanged: boolean;
}

export interface IBufferService {
  serviceBrand: undefined;

  readonly cols: number;
  readonly rows: number;
  readonly buffer: IBuffer;
  readonly buffers: IBufferSet;
  isUserScrolling: boolean;
  onResize: IEvent<IBufferResizeEvent>;
  onScroll: IEvent<number>;
  scroll(eraseAttr: IAttributeData, isWrapped?: boolean): void;
  scrollLines(disp: number, suppressScrollEvent?: boolean): void;
  resize(cols: number, rows: number): void;
  reset(): void;
}
