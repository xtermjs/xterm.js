/**
 * Copyright (c) 2019 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import { IEvent } from 'common/EventEmitter2';

export interface ICharDimensionsService {
  readonly width: number;
  readonly height: number;
  readonly onCharDimensionsChange: IEvent<string>;
  measure(): void;
}
