/**
 * Copyright (c) 2017 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import { ISearchHelper, ISearchAddonTerminal, ISearchOptions, ISearchResult } from './Interfaces';

const NON_WORD_CHARACTERS = ' ~!@#$%^&*()+`-=[]{}|\;:"\',./<>?';
const LINES_CACHE_TIME_TO_LIVE = 15 * 1000; // 15 secs

/**
 * A class that knows how to search the terminal and how to display the results.
 */
export class SearchHelper implements ISearchHelper {
  /**
   * translateBufferLineToStringWithWrap is a fairly expensive call.
   * We memoize the calls into an array that has a time based ttl.
   * _linesCache is also invalidated when the terminal cursor moves.
   */
  private _linesCache: string[] = null;
  private _linesCacheTimeoutId = 0;

  constructor(private _terminal: ISearchAddonTerminal) {
    this._destroyLinesCache = this._destroyLinesCache.bind(this);
  }

  /**
   * Find the next instance of the term, then scroll to and select it. If it
   * doesn't exist, do nothing.
   * @param term The search term.
   * @param searchOptions Search options.
   * @return Whether a result was found.
   */
  public findNext(term: string, searchOptions?: ISearchOptions): boolean {
    const selectionManager = this._terminal._core.selectionManager;
    const {incremental} = searchOptions;
    let result: ISearchResult;

    if (!term || term.length === 0) {
      selectionManager.clearSelection();
      return false;
    }

    let startCol: number = 0;
    let startRow = this._terminal._core.buffer.ydisp;

    if (selectionManager.selectionEnd) {
      // Start from the selection end if there is a selection
      // For incremental search, use existing row
      if (this._terminal.getSelection().length !== 0) {
        startRow = incremental ? selectionManager.selectionStart[1] : selectionManager.selectionEnd[1];
        startCol = incremental ? selectionManager.selectionStart[0] : selectionManager.selectionEnd[0];
      }
    }

    this._initLinesCache();

    // Search startRow
    result = this._findInLine(term, startRow, startCol, searchOptions);

    // Search from startRow + 1 to end
    if (!result) {
      for (let y = startRow + 1; y < this._terminal._core.buffer.ybase + this._terminal.rows; y++) {
        result = this._findInLine(term, y, 0, searchOptions);
        if (result) {
          break;
        }
      }
    }

    // Search from the top to the startRow (search the whole startRow again in
    // case startCol > 0)
    if (!result) {
      for (let y = 0; y <= startRow; y++) {
        result = this._findInLine(term, y, 0, searchOptions);
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
   * @param term The search term.
   * @param searchOptions Search options.
   * @return Whether a result was found.
   */
  public findPrevious(term: string, searchOptions?: ISearchOptions): boolean {
    const selectionManager = this._terminal._core.selectionManager;
    let result: ISearchResult;

    if (!term || term.length === 0) {
      selectionManager.clearSelection();
      return false;
    }

    const isReverseSearch = true;
    let startRow = this._terminal._core.buffer.ydisp;
    let startCol: number = this._terminal._core.buffer.lines.get(startRow).length;

    if (selectionManager.selectionStart) {
      // Start from the selection start if there is a selection
      if (this._terminal.getSelection().length !== 0) {
        startRow = selectionManager.selectionStart[1];
        startCol = selectionManager.selectionStart[0];
      }
    }

    this._initLinesCache();

    // Search startRow
    result = this._findInLine(term, startRow, startCol, searchOptions, isReverseSearch);

    // Search from startRow - 1 to top
    if (!result) {
      for (let y = startRow - 1; y >= 0; y--) {
        result = this._findInLine(term, y, this._terminal._core.buffer.lines.get(y).length, searchOptions, isReverseSearch);
        if (result) {
          break;
        }
      }
    }

    // Search from the bottom to startRow (search the whole startRow again in
    // case startCol > 0)
    if (!result) {
      const searchFrom = this._terminal._core.buffer.ybase + this._terminal.rows - 1;
      for (let y = searchFrom; y >= startRow; y--) {
        result = this._findInLine(term, y, this._terminal._core.buffer.lines.get(y).length, searchOptions, isReverseSearch);
        if (result) {
          break;
        }
      }
    }

    // Set selection and scroll if a result was found
    return this._selectResult(result);
  }

  /**
   * Sets up a line cache with a ttl
   */
  private _initLinesCache(): void {
    if (!this._linesCache) {
      this._linesCache = new Array(this._terminal._core.buffer.length);
      this._terminal.on('cursormove', this._destroyLinesCache);
    }

    window.clearTimeout(this._linesCacheTimeoutId);
    this._linesCacheTimeoutId = window.setTimeout(() => this._destroyLinesCache(), LINES_CACHE_TIME_TO_LIVE);
  }

  private _destroyLinesCache(): void {
    this._linesCache = null;
    this._terminal.off('cursormove', this._destroyLinesCache);
    if (this._linesCacheTimeoutId) {
      window.clearTimeout(this._linesCacheTimeoutId);
      this._linesCacheTimeoutId = 0;
    }
  }

  /**
   * A found substring is a whole word if it doesn't have an alphanumeric character directly adjacent to it.
   * @param searchIndex starting indext of the potential whole word substring
   * @param line entire string in which the potential whole word was found
   * @param term the substring that starts at searchIndex
   */
  private _isWholeWord(searchIndex: number, line: string, term: string): boolean {
    return (((searchIndex === 0) || (NON_WORD_CHARACTERS.indexOf(line[searchIndex - 1]) !== -1)) &&
        (((searchIndex + term.length) === line.length) || (NON_WORD_CHARACTERS.indexOf(line[searchIndex + term.length]) !== -1)));
  }

  /**
   * Searches a line for a search term. Takes the provided terminal line and searches the text line, which may contain
   * subsequent terminal lines if the text is wrapped. If the provided line number is part of a wrapped text line that
   * started on an earlier line then it is skipped since it will be properly searched when the terminal line that the
   * text starts on is searched.
   * @param term The search term.
   * @param row The line to  start the search from.
   * @param col The column to start the search from.
   * @param searchOptions Search options.
   * @return The search result if it was found.
   */
  protected _findInLine(term: string, row: number, col: number, searchOptions: ISearchOptions = {}, isReverseSearch: boolean = false): ISearchResult {
    if (this._terminal._core.buffer.lines.get(row).isWrapped) {
      return;
    }

    let stringLine = this._linesCache ? this._linesCache[row] : void 0;
    if (stringLine === void 0) {
      stringLine = this.translateBufferLineToStringWithWrap(row, true);
      if (this._linesCache) {
        this._linesCache[row] = stringLine;
      }
    }

    const searchTerm = searchOptions.caseSensitive ? term : term.toLowerCase();
    const searchStringLine = searchOptions.caseSensitive ? stringLine : stringLine.toLowerCase();

    let resultIndex = -1;
    if (searchOptions.regex) {
      const searchRegex = RegExp(searchTerm, 'g');
      let foundTerm: RegExpExecArray;
      if (isReverseSearch) {
        // This loop will get the resultIndex of the _last_ regex match in the range 0..col
        while (foundTerm = searchRegex.exec(searchStringLine.slice(0, col))) {
          resultIndex = searchRegex.lastIndex - foundTerm[0].length;
          term = foundTerm[0];
          searchRegex.lastIndex -= (term.length - 1);
        }
      } else {
        foundTerm = searchRegex.exec(searchStringLine.slice(col));
        if (foundTerm && foundTerm[0].length > 0) {
          resultIndex = col + (searchRegex.lastIndex - foundTerm[0].length);
          term = foundTerm[0];
        }
      }
    } else {
      if (isReverseSearch) {
        if (col - searchTerm.length >= 0) {
          resultIndex = searchStringLine.lastIndexOf(searchTerm, col - searchTerm.length);
        }
      } else {
        resultIndex = searchStringLine.indexOf(searchTerm, col);
      }
    }

    if (resultIndex >= 0) {
      // Adjust the row number and search index if needed since a "line" of text can span multiple rows
      if (resultIndex >= this._terminal.cols) {
        row += Math.floor(resultIndex / this._terminal.cols);
        resultIndex = resultIndex % this._terminal.cols;
      }
      if (searchOptions.wholeWord && !this._isWholeWord(resultIndex, searchStringLine, term)) {
        return;
      }

      const line = this._terminal._core.buffer.lines.get(row);

      for (let i = 0; i < resultIndex; i++) {
        const charData = line.get(i);
        // Adjust the searchIndex to normalize emoji into single chars
        const char = charData[1/*CHAR_DATA_CHAR_INDEX*/];
        if (char.length > 1) {
          resultIndex -= char.length - 1;
        }
        // Adjust the searchIndex for empty characters following wide unicode
        // chars (eg. CJK)
        const charWidth = charData[2/*CHAR_DATA_WIDTH_INDEX*/];
        if (charWidth === 0) {
          resultIndex++;
        }
      }
      return {
        term,
        col: resultIndex,
        row
      };
    }
  }
  /**
   * Translates a buffer line to a string, including subsequent lines if they are wraps.
   * Wide characters will count as two columns in the resulting string. This
   * function is useful for getting the actual text underneath the raw selection
   * position.
   * @param line The line being translated.
   * @param trimRight Whether to trim whitespace to the right.
   */
  public translateBufferLineToStringWithWrap(lineIndex: number, trimRight: boolean): string {
    let lineString = '';
    let lineWrapsToNext: boolean;

    do {
      const nextLine = this._terminal._core.buffer.lines.get(lineIndex + 1);
      lineWrapsToNext = nextLine ? nextLine.isWrapped : false;
      lineString += this._terminal._core.buffer.translateBufferLineToString(lineIndex, !lineWrapsToNext && trimRight).substring(0, this._terminal.cols);
      lineIndex++;
    } while (lineWrapsToNext);

    return lineString;
  }

  /**
   * Selects and scrolls to a result.
   * @param result The result to select.
   * @return Whethera result was selected.
   */
  private _selectResult(result: ISearchResult): boolean {
    if (!result) {
      this._terminal.clearSelection();
      return false;
    }
    this._terminal._core.selectionManager.setSelection(result.col, result.row, result.term.length);
    this._terminal.scrollLines(result.row - this._terminal._core.buffer.ydisp);
    return true;
  }
}
