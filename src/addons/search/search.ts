/**
 * Copyright (c) 2017 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import { SearchHelper } from './SearchHelper';

declare var exports: any;
declare var module: any;
declare var define: any;
declare var require: any;
declare var window: any;

(function (addon) {
  if (typeof window !== 'undefined' && 'Terminal' in window) {
    /**
     * Plain browser environment
     */
    addon(window.Terminal);
  } else if (typeof exports === 'object' && typeof module === 'object') {
    /**
     * CommonJS environment
     */
    module.exports = addon(require('../../Terminal').Terminal);
  } else if (typeof define === 'function') {
    /**
     * Require.js is available
     */
    define(['../../xterm'], addon);
  }
})((Terminal: any) => {
  /**
   * Find the next instance of the term, then scroll to and select it. If it
   * doesn't exist, do nothing.
   * @param term Tne search term.
   * @return Whether a result was found.
   */
  Terminal.prototype.findNext = function(term: string): boolean {
    if (!this._searchHelper) {
      this.searchHelper = new SearchHelper(this);
    }
    return (<SearchHelper>this.searchHelper).findNext(term);
  };

  /**
   * Find the previous instance of the term, then scroll to and select it. If it
   * doesn't exist, do nothing.
   * @param term Tne search term.
   * @return Whether a result was found.
   */
  Terminal.prototype.findPrevious = function(term: string): boolean {
    if (!this._searchHelper) {
      this.searchHelper = new SearchHelper(this);
    }
    return (<SearchHelper>this.searchHelper).findPrevious(term);
  };
});
