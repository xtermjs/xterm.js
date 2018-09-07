/**
 * Copyright (c) 2017 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import { SearchHelper } from './SearchHelper';
import { Terminal } from 'xterm';
import { ISearchAddonTerminal } from './Interfaces';

/**
 * Find the next instance of the term, then scroll to and select it. If it
 * doesn't exist, do nothing.
 * @param term Tne search term.
 * @param regex Should use regular expressions
 * @return Whether a result was found.
 */
export function findNext(terminal: Terminal, term: string, regex: boolean): boolean {
  const addonTerminal = <ISearchAddonTerminal>terminal;
  if (!addonTerminal.__searchHelper) {
    addonTerminal.__searchHelper = new SearchHelper(addonTerminal);
  }
  return addonTerminal.__searchHelper.findNext(term, regex);
}

/**
 * Find the previous instance of the term, then scroll to and select it. If it
 * doesn't exist, do nothing.
 * @param term Tne search term.
 * @param regex Should use regular expressions
 * @return Whether a result was found.
 */
export function findPrevious(terminal: Terminal, term: string, regex: boolean): boolean {
  const addonTerminal = <ISearchAddonTerminal>terminal;
  if (!addonTerminal.__searchHelper) {
    addonTerminal.__searchHelper = new SearchHelper(addonTerminal);
  }
  return addonTerminal.__searchHelper.findPrevious(term, regex);
}

export function apply(terminalConstructor: typeof Terminal): void {
  (<any>terminalConstructor.prototype).findNext = function(term: string, regex: boolean): boolean {
    return findNext(this, term, regex);
  };

  (<any>terminalConstructor.prototype).findPrevious = function(term: string, regex: boolean): boolean {
    return findPrevious(this, term, regex);
  };
}
