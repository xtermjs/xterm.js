/**
 * Copyright (c) 2018 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import { Terminal } from 'xterm';

export interface IWinptyCompatAddonTerminal extends Terminal {
  buffer: any;
}
