/**
 * Copyright (c) 2019 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import { IEvent, EventEmitter } from 'common/EventEmitter';
import { ICharSizeService, IMouseService } from 'browser/services/Services';

export class MockCharSizeService implements ICharSizeService {
  get hasValidSize(): boolean { return this.width > 0 && this.height > 0; }
  onCharSizeChange: IEvent<void> = new EventEmitter<void>().event;
  constructor(public width: number, public height: number) {}
  measure(): void {}
}

export class MockMouseService implements IMouseService {
  public getCoords(event: {clientX: number, clientY: number}, element: HTMLElement, colCount: number, rowCount: number, isSelection?: boolean): [number, number] | undefined {
    throw new Error('Not implemented');
  }

  public getRawByteCoords(event: MouseEvent, element: HTMLElement, colCount: number, rowCount: number): { x: number, y: number } | undefined {
    throw new Error('Not implemented');
  }
}
