/**
 * Copyright (c) 2017 The xterm.js authors. All rights reserved.
 * @license MIT
 */

// import { ITerminal } from '../../Interfaces';
// import { translateBufferLineToString } from '../../utils/BufferLine';

interface ISearchResult {
  term: string;
  col: number;
  row: number;
}

/**
 * A class that knows how to search the terminal and how to display the results.
 */
export class SearchHelper {
  constructor(private _terminal: any) {
    // TODO: Search for multiple instances on 1 line
    // TODO: Don't use the actual selection, instead use a "find selection" so multiple instances can be highlighted
    // TODO: Highlight other instances in the viewport
    // TODO: Support regex, case sensitivity, etc.
  }

  /**
   * Find the next instance of the term, then scroll to and select it. If it
   * doesn't exist, do nothing.
   * @param term Tne search term.
   * @return Whether a result was found.
   */
  public findNext(term: string): boolean {
    if (!term || term.length === 0) {
      return false;
    }

    let result: ISearchResult;

    let startRow = this._terminal.buffer.ydisp;
    if (this._terminal.selectionManager.selectionEnd) {
      // Start from the selection end if there is a selection
      startRow = this._terminal.selectionManager.selectionEnd[1];
    }

    // Search from ydisp + 1 to end
    for (let y = startRow + 1; y < this._terminal.buffer.ybase + this._terminal.rows; y++) {
      result = this._findInLine(term, y);
      if (result) {
        break;
      }
    }

    // Search from the top to the current ydisp
    if (!result) {
      for (let y = 0; y < startRow; y++) {
        result = this._findInLine(term, y);
        if (result) {
          break;
        }
      }
    }

    // Set selection and scroll if a result was found
    return this._selectResult(result);
  }

  /**
   * Find the previous instance of the term, then scroll to and select it. If it
   * doesn't exist, do nothing.
   * @param term Tne search term.
   * @return Whether a result was found.
   */
  public findPrevious(term: string): boolean {
    if (!term || term.length === 0) {
      return false;
    }

    let result: ISearchResult;

    let startRow = this._terminal.buffer.ydisp;
    if (this._terminal.selectionManager.selectionStart) {
      // Start from the selection end if there is a selection
      startRow = this._terminal.selectionManager.selectionStart[1];
    }

    // Search from ydisp + 1 to end
    for (let y = startRow - 1; y >= 0; y--) {
      result = this._findInLine(term, y);
      if (result) {
        break;
      }
    }

    // Search from the top to the current ydisp
    if (!result) {
      for (let y = this._terminal.buffer.ybase + this._terminal.rows - 1; y > startRow; y--) {
        result = this._findInLine(term, y);
        if (result) {
          break;
        }
      }
    }

    // Set selection and scroll if a result was found
    return this._selectResult(result);
  }

  /**
   * Searches a line for a search term.
   * @param term Tne search term.
   * @param y The line to search.
   * @return The search result if it was found.
   */
  private _findInLine(term: string, y: number): ISearchResult {
    const lowerStringLine = this._terminal.buffer.translateBufferLineToString(y, true).toLowerCase();
    const lowerTerm = term.toLowerCase();
    const searchIndex = lowerStringLine.indexOf(lowerTerm);
    if (searchIndex >= 0) {
      return {
        term,
        col: searchIndex,
        row: y
      };
    }
  }

  /**
   * Selects and scrolls to a result.
   * @param result The result to select.
   * @return Whethera result was selected.
   */
  private _selectResult(result: ISearchResult): boolean {
    if (!result) {
      return false;
    }
    this._terminal.selectionManager.setSelection(result.col, result.row, result.term.length);
    this._terminal.scrollLines(result.row - this._terminal.buffer.ydisp, false);
    return true;
  }
}
