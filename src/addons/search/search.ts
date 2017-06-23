/**
 * @license MIT
 */

import { SearchHelper } from './SearchHelper';

declare var exports: any;
declare var module: any;
declare var define: any;
declare var require: any;

(function (addon) {
  if ('Terminal' in window) {
    /*
     * Plain browser environment
     */
    addon((<any>window).Terminal);
  } else if (typeof define == 'function') {
    /*
     * Require.js is available
     */
    define(['../../xterm'], addon);
  } else if (typeof exports === 'object' && typeof module === 'object') {
    /*
     * CommonJS environment
     */
    var xterm = '../../xterm'; // Put in a variable do it's not pulled in by browserify
    module.exports = addon(require(xterm));
  }
})((Terminal: any) => {
  /**
   * Find the next instance of the term, then scroll to and select it. If it
   * doesn't exist, do nothing.
   * @param term The term to search for.
   * @return Whether a result was found.
   */
  Terminal.prototype.findNext = function(term: string): boolean {
    if (!this._searchHelper) {
      this.searchHelper = new SearchHelper(this, Terminal.translateBufferLineToString);
    }
    return (<SearchHelper>this.searchHelper).findNext(term);
  };

  /**
   * Find the previous instance of the term, then scroll to and select it. If it
   * doesn't exist, do nothing.
   * @param term The term to search for.
   * @return Whether a result was found.
   */
  Terminal.prototype.findPrevious = function(term: string): boolean {
    if (!this._searchHelper) {
      this.searchHelper = new SearchHelper(this, Terminal.translateBufferLineToString);
    }
    return (<SearchHelper>this.searchHelper).findPrevious(term);
  };
});
