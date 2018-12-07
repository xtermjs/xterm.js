/**
 * Copyright (c) 2017 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import { ISearchHelper, ISearchAddonTerminal, ISearchOptions, ISearchResult, ISearchIndex } from './Interfaces';
const nonWordCharacters = ' ~!@#$%^&*()+`-=[]{}|\;:"\',./<>?';
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
   * @param term The search term.
   * @param searchOptions Search options.
   * @return Whether a result was found.
   */
  public findNext(term: string, searchOptions?: ISearchOptions): boolean {
    if (!term || term.length === 0) {
      return false;
    }

    let result: ISearchResult;
    let startRow = this._terminal._core.buffer.ydisp;
    let startCol: number = 0;
    if (this._terminal._core.selectionManager.selectionEnd) {
      // Start from the selection end if there is a selection
      if (this._terminal.getSelection().length !== 0) {
        startRow = this._terminal._core.selectionManager.selectionEnd[1];
        startCol = this._terminal._core.selectionManager.selectionEnd[0];
      }
    }

    // Search from ydisp + 1 to end
    for (let y = startRow; y < this._terminal._core.buffer.ybase + this._terminal.rows; y++) {
      result = this._findInLine(term, {row: y, col: startCol}, searchOptions);
      if (result) {
        break;
      }
      startCol = 0;
    }

    // Search from the top to the current ydisp
    if (!result) {
      for (let y = 0; y < startRow; y++) {
        startCol = 0;
        result = this._findInLine(term, {row: y, col: startCol}, searchOptions);
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
    if (!term || term.length === 0) {
      return false;
    }
    const isReverseSearch = true;
    let result: ISearchResult;
    let startRow = this._terminal._core.buffer.ydisp;
    let startCol: number = this._terminal._core.buffer.lines.get(startRow).length;

    if (this._terminal._core.selectionManager.selectionStart) {
      // Start from the selection end if there is a selection
      if (this._terminal.getSelection().length !== 0) {
        startRow = this._terminal._core.selectionManager.selectionStart[1];
        startCol = this._terminal._core.selectionManager.selectionStart[0];
      }
    }

    // Search from ydisp + 1 to end
    for (let y = startRow; y >= 0; y--) {
      result = this._findInLine(term, {row: y, col: startCol}, searchOptions, isReverseSearch);
      if (result) {
        break;
      }
      startCol = y > 0 ? this._terminal._core.buffer.lines.get(y - 1).length : 0;
    }

    // Search from the top to the current ydisp
    if (!result) {
      const searchFrom = this._terminal._core.buffer.ybase + this._terminal.rows - 1;
      for (let y = searchFrom; y > startRow; y--) {
        startCol = this._terminal._core.buffer.lines.get(y).length;
        result = this._findInLine(term, {row: y, col: startCol}, searchOptions, isReverseSearch);
        if (result) {
          break;
        }
      }
    }

    // Set selection and scroll if a result was found
    return this._selectResult(result);
  }

  /**
   * A found substring is a whole word if it doesn't have an alphanumeric character directly adjacent to it.
   * @param searchIndex starting indext of the potential whole word substring
   * @param line entire string in which the potential whole word was found
   * @param term the substring that starts at searchIndex
   */
  private _isWholeWord(searchIndex: number, line: string, term: string): boolean {
    return (((searchIndex === 0) || (nonWordCharacters.indexOf(line[searchIndex - 1]) !== -1)) &&
        (((searchIndex + term.length) === line.length) || (nonWordCharacters.indexOf(line[searchIndex + term.length]) !== -1)));
  }

  /**
   * Searches a line for a search term. Takes the provided terminal line and searches the text line, which may contain
   * subsequent terminal lines if the text is wrapped. If the provided line number is part of a wrapped text line that
   * started on an earlier line then it is skipped since it will be properly searched when the terminal line that the
   * text starts on is searched.
   * @param term The search term.
   * @param y The line to search.
   * @param searchOptions Search options.
   * @return The search result if it was found.
   */
  protected _findInLine(term: string, searchIndex: ISearchIndex, searchOptions: ISearchOptions = {}, isReverseSearch: boolean = false): ISearchResult {
    if (this._terminal._core.buffer.lines.get(searchIndex.row).isWrapped) {
      return;
    }

    const stringLine = this.translateBufferLineToStringWithWrap(searchIndex.row, true);
    const searchTerm = searchOptions.caseSensitive ? term : term.toLowerCase();
    const searchStringLine = searchOptions.caseSensitive ? stringLine : stringLine.toLowerCase();

    let resultIndex = -1;
    if (searchOptions.regex) {
      const searchRegex = RegExp(searchTerm, 'g');
      let foundTerm: RegExpExecArray;
      if (isReverseSearch) {
        while (foundTerm = searchRegex.exec(searchStringLine.slice(0, searchIndex.col))) {
          resultIndex = searchRegex.lastIndex - foundTerm[0].length;
          term = foundTerm[0];
          searchRegex.lastIndex -= (term.length - 1);
        }
      } else {
        foundTerm = searchRegex.exec(searchStringLine.slice(searchIndex.col));
        if (foundTerm && foundTerm[0].length > 0) {
          resultIndex = searchIndex.col + (searchRegex.lastIndex - foundTerm[0].length);
          term = foundTerm[0];
        }
      }
    } else {
      if (isReverseSearch) {
        resultIndex = searchStringLine.lastIndexOf(searchTerm, searchIndex.col - searchTerm.length);
      } else {
        resultIndex = searchStringLine.indexOf(searchTerm, searchIndex.col);
      }
    }

    if (resultIndex >= 0) {
      // Adjust the row number and search index if needed since a "line" of text can span multiple rows
      if (resultIndex >= this._terminal.cols) {
        searchIndex.row += Math.floor(resultIndex / this._terminal.cols);
        resultIndex = resultIndex % this._terminal.cols;
      }
      if (searchOptions.wholeWord && !this._isWholeWord(resultIndex, searchStringLine, term)) {
        return;
      }

      const line = this._terminal._core.buffer.lines.get(searchIndex.row);

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
        row: searchIndex.row
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
