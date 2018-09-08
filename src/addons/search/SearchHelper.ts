/**
 * Copyright (c) 2017 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import { ISearchHelper, ISearchAddonTerminal, ISearchOptions, ISearchResult } from './Interfaces';

/**
 * A class that knows how to search the terminal and how to display the results.
 */
export class SearchHelper implements ISearchHelper {
  constructor(private _terminal: ISearchAddonTerminal) {
    // TODO: Search for multiple instances on 1 line
    // TODO: Don't use the actual selection, instead use a "find selection" so multiple instances can be highlighted
    // TODO: Highlight other instances in the viewport
  }

  /**
   * Find the next instance of the term, then scroll to and select it. If it
   * doesn't exist, do nothing.
   * @param term Tne search term.
   * @param searchOptions Search options.
   * @return Whether a result was found.
   */
  public findNext(term: string, searchOptions?: ISearchOptions): boolean {
    if (!term || term.length === 0) {
      return false;
    }

    let result: ISearchResult;

    let startRow = this._terminal._core.buffer.ydisp;
    if (this._terminal._core.selectionManager.selectionEnd) {
      // Start from the selection end if there is a selection
      startRow = this._terminal._core.selectionManager.selectionEnd[1];
    }

    // Search from ydisp + 1 to end
    for (let y = startRow + 1; y < this._terminal._core.buffer.ybase + this._terminal.rows; y++) {
      result = this._findInLine(term, y, searchOptions);
      if (result) {
        break;
      }
    }

    // Search from the top to the current ydisp
    if (!result) {
      for (let y = 0; y < startRow; y++) {
        result = this._findInLine(term, y, searchOptions);
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
   * @param searchOptions Search options.
   * @return Whether a result was found.
   */
  public findPrevious(term: string, searchOptions?: ISearchOptions): boolean {
    if (!term || term.length === 0) {
      return false;
    }

    let result: ISearchResult;

    let startRow = this._terminal._core.buffer.ydisp;
    if (this._terminal._core.selectionManager.selectionStart) {
      // Start from the selection end if there is a selection
      startRow = this._terminal._core.selectionManager.selectionStart[1];
    }

    // Search from ydisp + 1 to end
    for (let y = startRow - 1; y >= 0; y--) {
      result = this._findInLine(term, y, searchOptions);
      if (result) {
        break;
      }
    }

    // Search from the top to the current ydisp
    if (!result) {
      for (let y = this._terminal._core.buffer.ybase + this._terminal.rows - 1; y > startRow; y--) {
        result = this._findInLine(term, y, searchOptions);
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
   * @param term The search term.
   * @param y The line to search.
   * @param searchOptions Search options.
   * @return The search result if it was found.
   */
  protected _findInLine(term: string, y: number, searchOptions: ISearchOptions = {}): ISearchResult {
    const lowerStringLine = this._terminal._core.buffer.translateBufferLineToString(y, true).toLowerCase();
    const lowerTerm = term.toLowerCase();
    let searchIndex = -1;
    if (searchOptions.regex) {
      const searchRegex = RegExp(lowerTerm, 'g');
      const foundTerm = searchRegex.exec(lowerStringLine);
      if (foundTerm) {
        searchIndex = searchRegex.lastIndex - foundTerm[0].length;
        term = foundTerm[0];
      }
    } else {
      searchIndex = lowerStringLine.indexOf(lowerTerm);
    }
    if (searchIndex >= 0) {
      const line = this._terminal._core.buffer.lines.get(y);
      for (let i = 0; i < searchIndex; i++) {
        const charData = line.get(i);
        // Adjust the searchIndex to normalize emoji into single chars
        const char = charData[1/*CHAR_DATA_CHAR_INDEX*/];
        if (char.length > 1) {
          searchIndex -= char.length - 1;
        }
        // Adjust the searchIndex for empty characters following wide unicode
        // chars (eg. CJK)
        const charWidth = charData[2/*CHAR_DATA_WIDTH_INDEX*/];
        if (charWidth === 0) {
          searchIndex++;
        }
      }
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
    this._terminal._core.selectionManager.setSelection(result.col, result.row, result.term.length);
    this._terminal.scrollLines(result.row - this._terminal._core.buffer.ydisp);
    return true;
  }
}
