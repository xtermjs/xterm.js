/**
 * Copyright (c) 2018 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import { Terminal } from 'xterm';

export interface ISearchAddonTerminal extends Terminal {
  __searchHelper?: ISearchHelper;

  // TODO: Reuse ITerminal from core
  buffer: any;
  selectionManager: any;
}

export interface ISearchHelper {
  findNext(term: string): boolean;
  findPrevious(term: string): boolean;
}
