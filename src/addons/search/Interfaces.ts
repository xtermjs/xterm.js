/**
 * Copyright (c) 2018 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import { Terminal } from 'xterm';

// TODO: Don't rely on this private API
export interface ITerminalCore {
  buffer: any;
  selectionManager: any;
}

export interface ISearchAddonTerminal extends Terminal {
  __searchHelper?: ISearchHelper;
  _core: ITerminalCore;
}

export interface ISearchHelper {
  findNext(term: string): boolean;
  findPrevious(term: string): boolean;
}
