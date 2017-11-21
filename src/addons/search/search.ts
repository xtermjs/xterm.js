/**
 * Copyright (c) 2017 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import { SearchHelper } from './SearchHelper';
import { ITerminal } from '../../Interfaces';


/**
 * Find the next instance of the term, then scroll to and select it. If it
 * doesn't exist, do nothing.
 * @param term Tne search term.
 * @return Whether a result was found.
 */
function findNext(terminal: ITerminal, term: string): boolean {
  if (!terminal._searchHelper) {
    terminal.searchHelper = new SearchHelper(terminal);
  }
  return (<SearchHelper>terminal.searchHelper).findNext(term);
};

/**
 * Find the previous instance of the term, then scroll to and select it. If it
 * doesn't exist, do nothing.
 * @param term Tne search term.
 * @return Whether a result was found.
 */
Terminal.prototype.findPrevious = function(terminal: ITerminal, term: string): boolean {
  if (!terminal._searchHelper) {
    terminal.searchHelper = new SearchHelper(terminal);
  }
  return (<SearchHelper>terminal.searchHelper).findPrevious(term);
};

export function apply(terminalConstructor) {
  terminalConstructor.prototype.findNext = function(term) {
    return findNext(this, term);
  }

  terminalConstructor.prototype.findPrevious = function(term) {
    return findPrevious(this, term);
  }
}
