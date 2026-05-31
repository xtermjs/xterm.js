/**
 * Copyright (c) 2018 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import { ITerminalOptions as IPublicTerminalOptions } from '@xterm/xterm';

// TODO: The options that are not in the public API should be reviewed
export interface ITerminalOptions extends IPublicTerminalOptions {
  [key: string]: any;
  convertEol?: boolean;
  termName?: string;
}
