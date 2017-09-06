/**
 * @license MIT
 */

import { SearchHelper } from './SearchHelper';

declare var exports: any;
declare var module: any;
declare var define: any;
declare var require: any;
declare var window: any;

(function (addon) {
  // One of the most prominent consumer is VSCode which uses a CommonJS environment and has global
  // 'define' function exposed through its loader (https://github.com/Microsoft/vscode-loader).
  // Checking only define first would break it, so we check for an AMD environment with 'define.amd'
  // which is compliant with RequireJS.
  if (typeof define === 'function' && define.amd) {
    /*
     * AMD environment
     */
    define(['../../xterm'], addon);
  } else if (typeof exports === 'object' && typeof module === 'object') {
    /*
     * CommonJS environment
     */
    module.exports = addon(require('../../xterm'));
  } else {
    /*
     * Plain browser environment
     */
    addon(window.Terminal);
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
      this.searchHelper = new SearchHelper(this, Terminal.translateBufferLineToString);
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
      this.searchHelper = new SearchHelper(this, Terminal.translateBufferLineToString);
    }
    return (<SearchHelper>this.searchHelper).findPrevious(term);
  };
});
