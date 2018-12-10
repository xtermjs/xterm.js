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
  findNext(term: string, searchOptions: ISearchOptions): boolean;
  findPrevious(term: string, searchOptions: ISearchOptions): boolean;
}

export interface ISearchOptions {
  regex?: boolean;
  wholeWord?: boolean;
  caseSensitive?: boolean;
  /** Assume caller implements 'search as you type' where findNext gets called when search input changes */
  incremental?: boolean;
}

export interface ISearchResult {
  term: string;
  col: number;
  row: number;
}
