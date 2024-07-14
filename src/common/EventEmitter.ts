/**
 * Copyright (c) 2019 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import { IDisposable } from 'common/Types';
import type { Emitter, Event } from 'vs/base/common/event';

export function forwardEvent<T>(from: Event<T>, to: Emitter<T>): IDisposable {
  return from(e => to.fire(e));
}
