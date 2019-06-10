/**
 * Copyright (c) 2019 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import { IEvent, EventEmitter } from 'common/EventEmitter';
import { ICharSizeService } from 'browser/services/Services';

export class MockCharSizeService implements ICharSizeService {
  get hasValidSize(): boolean { return this.width > 0 && this.height > 0; }
  onCharSizeChange: IEvent<void> = new EventEmitter<void>().event;
  constructor(public width: number, public height: number) {}
  measure(): void {}
}
