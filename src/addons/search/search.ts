/**
 * Copyright (c) 2017 The xterm.js authors. All rights reserved.
 * @license MIT
 */

/// <reference path="../../../typings/xterm.d.ts"/>

import { SearchHelper } from './SearchHelper';
import { Terminal } from 'xterm';
import { ISearchAddonTerminal } from './Interfaces';

/**
 * Find the next instance of the term, then scroll to and select it. If it
 * doesn't exist, do nothing.
 * @param term Tne search term.
 * @return Whether a result was found.
 */
export function findNext(terminal: Terminal, term: string): boolean {
  const addonTerminal = <ISearchAddonTerminal>terminal;
  if (!addonTerminal.__searchHelper) {
    addonTerminal.__searchHelper = new SearchHelper(addonTerminal);
  }
  return addonTerminal.__searchHelper.findNext(term);
}

/**
 * Find the previous instance of the term, then scroll to and select it. If it
 * doesn't exist, do nothing.
 * @param term Tne search term.
 * @return Whether a result was found.
 */
export function findPrevious(terminal: Terminal, term: string): boolean {
  const addonTerminal = <ISearchAddonTerminal>terminal;
  if (!addonTerminal.__searchHelper) {
    addonTerminal.__searchHelper = new SearchHelper(addonTerminal);
  }
  return addonTerminal.__searchHelper.findPrevious(term);
}

export function apply(terminalConstructor: typeof Terminal): void {
  (<any>terminalConstructor.prototype).findNext = function(term: string): boolean {
    return findNext(this, term);
  };

  (<any>terminalConstructor.prototype).findPrevious = function(term: string): boolean {
    return findPrevious(this, term);
  };
}
