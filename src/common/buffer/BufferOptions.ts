/**
 * Copyright (c) 2019 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import type { IDisposable } from 'common/base/Lifecycle';
import type { ITerminalOptions } from 'common/base/TerminalOptions';

/**
 * Options surface used by the buffer layer.
 */
export interface IBufferOptionsService {
  readonly rawOptions: Required<ITerminalOptions>;
  onSpecificOptionChange<K extends keyof ITerminalOptions>(key: K, callback: (value: ITerminalOptions[K]) => void): IDisposable;
}
