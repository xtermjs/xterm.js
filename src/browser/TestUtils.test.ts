/**
 * Copyright (c) 2019 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import { IEvent, EventEmitter2 } from 'common/EventEmitter2';
import { ICharSizeService } from 'browser/services/Services';

export class MockCharSizeService implements ICharSizeService {
  get hasValidSize(): boolean { return this.width > 0 && this.height > 0; }
  onCharSizeChange: IEvent<void> = new EventEmitter2<void>().event;
  constructor(public width: number, public height: number) {}
  measure(): void {}
}
