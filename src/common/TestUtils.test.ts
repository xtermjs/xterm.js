/**
 * Copyright (c) 2019 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import { IBufferService, IOptionsService, ITerminalOptions, IPartialTerminalOptions } from 'common/services/Services';
import { IEvent, EventEmitter2 } from 'common/EventEmitter2';
import { clone } from 'common/Clone';
import { DEFAULT_OPTIONS } from 'common/services/OptionsService';

export class MockBufferService implements IBufferService {
  constructor(
    public cols: number,
    public rows: number
  ) {}
  resize(cols: number, rows: number): void {
    this.cols = cols;
    this.rows = rows;
  }
}

export class MockOptionsService implements IOptionsService {
  options: ITerminalOptions = clone(DEFAULT_OPTIONS);
  onOptionChange: IEvent<string> = new EventEmitter2<string>().event;
  constructor(testOptions: IPartialTerminalOptions) {
    Object.keys(testOptions).forEach(key => this.options[key] = (<any>testOptions)[key]);
  }
  setOption<T>(key: string, value: T): void {
    throw new Error('Method not implemented.');
  }
  getOption<T>(key: string): T {
    throw new Error('Method not implemented.');
  }
}
