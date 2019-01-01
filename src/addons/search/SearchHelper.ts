/**
 * Copyright (c) 2017 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import { ISearchHelper, ISearchAddonTerminal, ISearchOptions, ISearchResult } from './Interfaces';

const NON_WORD_CHARACTERS = ' ~!@#$%^&*()+`-=[]{}|\;:"\',./<>?';
const LINES_CACHE_TIME_TO_LIVE = 15 * 1000; // 15 secs
const CHAR_DATA_CHAR_INDEX = 1;
const CHAR_DATA_WIDTH_INDEX = 2;

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

    // The row that has isWrapped = false
    let findingRow = startRow;
    // index of beginning column that _findInLine need to scan.
    let cumulativeCols = startCol;
    // If startRow is wrapped row, scan for unwrapped row above.
    // So we can start matching on wrapped line from long unwrapped line.
    while (this._terminal._core.buffer.lines.get(findingRow).isWrapped) {
      findingRow--;
      cumulativeCols += this._terminal.cols;
    }

    // Search unwarpped row
    result = this._findInLine(term, findingRow, cumulativeCols, searchOptions);

    // Search from startRow + 1 to end, if the row is still wrapped line, increase cumulativeCols,
    // otherwise, reset it and set the new unwrapped line index.
    if (!result) {

      for (let y = startRow + 1; y < this._terminal._core.buffer.ybase + this._terminal.rows; y++) {
        // If the current line is wrapped line, increase index of column to ignore the previous scan
        // Otherwise, reset beginning column index to zero with set new unwrapped line index
        if (this._terminal._core.buffer.lines.get(y).isWrapped) {
          cumulativeCols += this._terminal.cols;
        } else {
          cumulativeCols = 0;
          findingRow = y;
        }
        // Run _findInLine at unwrapped row, start scan at cumulativeCols column index
        result = this._findInLine(term, findingRow, cumulativeCols, searchOptions);
        if (result) {
          break;
        }
      }
    }

    // Search from the top to the startRow (search the whole startRow again in
    // case startCol > 0)
    if (!result) {
      // Assume that The first line is always unwrapped line
      let findingRow = 0;
      // Scan at beginning of the line
      let cumulativeCols = 0;
      for (let y = 0; y <= startRow; y++) {
        result = this._findInLine(term, findingRow, cumulativeCols, searchOptions);
        if (result) {
          break;
        }
        // If the current line is wrapped line, increase index of beginning column
        // So we ignore the previous scan
        if (this._terminal._core.buffer.lines.get(y).isWrapped) {
          cumulativeCols += this._terminal.cols;
        } else {
          cumulativeCols = 0;
          findingRow = y;
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
    let startCol: number = this._terminal.cols;

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
      // If the line is wrapped line, increase number of columns that is needed to be scanned
      // Se we can scan on wrapped line from unwrapped line
      let cumulativeCols = this._terminal.cols;
      if (this._terminal._core.buffer.lines.get(startRow).isWrapped) {
        cumulativeCols += startCol;
      }
      for (let y = startRow - 1; y >= 0; y--) {
        result = this._findInLine(term, y, cumulativeCols, searchOptions, isReverseSearch);
        if (result) {
          break;
        }
        // If the current line is wrapped line, increase scanning range,
        // preparing for scanning on unwrapped line
        if (this._terminal._core.buffer.lines.get(y).isWrapped) {
          cumulativeCols += this._terminal.cols;
        } else {
          cumulativeCols = this._terminal.cols;
        }
      }
    }

    // Search from the bottom to startRow (search the whole startRow again in
    // case startCol > 0)
    if (!result) {
      const searchFrom = this._terminal._core.buffer.ybase + this._terminal.rows - 1;
      let cumulativeCols = this._terminal.cols;
      for (let y = searchFrom; y >= startRow; y--) {
        result = this._findInLine(term, y, cumulativeCols, searchOptions, isReverseSearch);
        if (result) {
          break;
        }
        if (this._terminal._core.buffer.lines.get(y).isWrapped) {
          cumulativeCols += this._terminal.cols;
        } else {
          cumulativeCols = this._terminal.cols;
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
   * Translates a string index back to a BufferIndex.
   * To get the correct buffer position the string must start at `startCol` 0
   * (default in translateBufferLineToString).
   * This method is similar to stringIndexToBufferIndex in Buffer.ts
   * but this method added some modification that, if it found an empty cell,
   * the method will see it as a whitespace and count it as a character.
   * The modification is added because the given string index may include
   * empty cells inside the string, which is needed to be counted.
   * The return value of this method is the same as BufferIndex
   * @param lineIndex line index the string was retrieved from
   * @param stringIndex index within the string
   * @param startCol column offset the string was retrieved from
   */
  private _stringIndexToBufferIndex(lineIndex: number, stringIndex: number): [number, number] {
    while (stringIndex) {
      const line = this._terminal._core.buffer.lines.get(lineIndex);
      if (!line) {
        return [-1, -1];
      }
      for (let i = 0; i < this._terminal.cols; ++i) {
        const charData = line.get(i);
        const char = charData[CHAR_DATA_CHAR_INDEX];
        // If found empty cell with width equals to 1, see it as whitespace
        if (charData[CHAR_DATA_CHAR_INDEX] === '' && charData[CHAR_DATA_WIDTH_INDEX] > 0) {
          stringIndex--;
        }
        stringIndex -= char.length;
        if (stringIndex < 0) {
          return [lineIndex, i];
        }
      }
      lineIndex++;
    }
    return [lineIndex, 0];
  }

  /**
   * Convert buffer index of unwrapped row to string index.
   * @param lineIndex index of terminal row that is unwrapped
   * @param bufferIndex index of terminal column on unwrapped row
   */
  private _bufferIndexToStringIndex(lineIndex: number, bufferIndex: number): number {
    let stringIndex = -1;
    const buffer = this._terminal._core.buffer;
    while (bufferIndex >= 0) {
      const line = buffer.lines.get(lineIndex);
      // Exceed index of bottom row, returned
      if (!line) {
        break;
      }

      let lineLength = this._terminal.cols;

      // At the last line, lineLength will be trimmed to remove trailing empty cells
      if (bufferIndex < lineLength) {
        // Add 1 to getTrimmedLength because if providing bufferIndex is larger than
        // converted string length, the result should be `string length`, not `string length - 1`
        // to make sure that searching range includes the last character in the string
        lineLength = line.getTrimmedLength() + 1;
      }

      for (let i = 0; i < lineLength; i++) {
        const cell = line.get(i);

        // Count number of characters from current buffer column in each cell.
        stringIndex += cell[CHAR_DATA_CHAR_INDEX].length;
        bufferIndex--;

        // If found empty cell, act like found whitespace
        if (cell[CHAR_DATA_CHAR_INDEX] === '' && cell[CHAR_DATA_WIDTH_INDEX] > 0) {
          stringIndex++;
        }

        if (bufferIndex < 0) {
          return stringIndex;
        }
      }
      lineIndex++;
    }
    return stringIndex;
  }

  /**
   * Get buffer length (number of cells) from provided string
   * @param result The search result object including term, row, and col
   */
  private _getCellLengthFromString(result: ISearchResult): number {
    const length = result.term.length;

    let strCount = 0;
    let cellCount = 0;
    let { col, row } = result;
    let rowContent = this._terminal._core.buffer.lines.get(row);

    // Count cells along with characters until the number of characters
    // exceeds string length of search result.
    while (strCount <= length) {
      strCount += rowContent.get(col)[CHAR_DATA_CHAR_INDEX].length;
      cellCount += rowContent.get(col)[CHAR_DATA_WIDTH_INDEX];
      if (strCount >= length) {
        break;
      }
      col++;

      // In case that current cell exceed total number of cells in a row
      // Begin col at 0 on the next line
      if (col >= this._terminal.cols) {
        col = 0;
        rowContent = this._terminal._core.buffer.lines.get(++row);
      }
    }
    return cellCount;
  }
  /**
   * Searches a line for a search term. Takes the provided terminal line and searches the text line, which may contain
   * subsequent terminal lines if the text is wrapped. If the provided line number is part of a wrapped text line that
   * started on an earlier line then it is skipped since it will be properly searched when the terminal line that the
   * text starts on is searched.
   *
   * The concept of searching is that:
   * Get unwarpped line as string => convert rowand col to string index => begin searching to get search result as
   * string index => convert back to buffer index (col, row) => return the result.
   * @param term The search term.
   * @param row The line to  start the search from.
   * @param col The column to start the search from.
   * @param searchOptions Search options.
   * @return The search result if it was found.
   */
  protected _findInLine(term: string, row: number, col: number, searchOptions: ISearchOptions = {}, isReverseSearch: boolean = false): ISearchResult {

    // Ignore wrapped lines, only consider on unwrapped line (first row of command string).
    if (this._terminal._core.buffer.lines.get(row).isWrapped) {
      return;
    }

    // Get unwrapped string from buffer lines
    let stringLine = this._linesCache ? this._linesCache[row] : void 0;
    if (stringLine === void 0) {
      stringLine = this.translateBufferLineToStringWithWrap(row, true);
      if (this._linesCache) {
        this._linesCache[row] = stringLine;
      }
    }

    // Check for case sensitive option
    const searchTerm = searchOptions.caseSensitive ? term : term.toLowerCase();
    const searchStringLine = searchOptions.caseSensitive ? stringLine : stringLine.toLowerCase();

    let resultIndex = -1;
    // Convert from buffer index (col, row) to string index before begin searching
    const stringIndex = this._bufferIndexToStringIndex(row, col);

    if (searchOptions.regex) {
      const searchRegex = RegExp(searchTerm, 'g');
      let foundTerm: RegExpExecArray;
      if (isReverseSearch) {
        // This loop will get the resultIndex of the _last_ regex match in the range 0..col
        while (foundTerm = searchRegex.exec(searchStringLine.slice(0, stringIndex))) {
          resultIndex = searchRegex.lastIndex - foundTerm[0].length;
          term = foundTerm[0];
          searchRegex.lastIndex -= (term.length - 1);
        }
      } else {
        foundTerm = searchRegex.exec(searchStringLine.slice(stringIndex));
        if (foundTerm && foundTerm[0].length > 0) {
          resultIndex = stringIndex + (searchRegex.lastIndex - foundTerm[0].length);
          term = foundTerm[0];
        }
      }
    } else {
      if (isReverseSearch) {
        if (stringIndex - searchTerm.length >= 0) {
          resultIndex = searchStringLine.lastIndexOf(searchTerm, stringIndex - searchTerm.length);
        }
      } else {
        resultIndex = searchStringLine.indexOf(searchTerm, stringIndex);
      }
    }

    if (resultIndex >= 0) {
      // After getting the result as string index, convert it to buffer index.
      const resultBufferIndex = this._stringIndexToBufferIndex(row, resultIndex);

      // Check for wholeword option
      if (searchOptions.wholeWord && !this._isWholeWord(resultIndex, searchStringLine, term)) {
        return;
      }

      return {
        term,
        col: resultBufferIndex[1],
        row: resultBufferIndex[0]
      };
    }
  }
  /**
   * Translates a buffer line to a string, including subsequent lines if they are wraps.
   * Wide characters will count as two columns in the resulting string. This
   * function is useful for getting the actual text underneath the raw selection
   * position.
   * @param line The line being translated.
   * @param trimRight Whether to trim -space to the right.
   */
  public translateBufferLineToStringWithWrap(lineIndex: number, trimRight: boolean): string {
    let lineString = '';
    let lineWrapsToNext: boolean;

    do {
      const nextLine = this._terminal._core.buffer.lines.get(lineIndex + 1);
      lineWrapsToNext = nextLine ? nextLine.isWrapped : false;
      // string should be cut with string index, not buffer index to support wide characters
      lineString += this._terminal._core.buffer.translateBufferLineToString(lineIndex, !lineWrapsToNext && trimRight).substring(0, this._bufferIndexToStringIndex(lineIndex, this._terminal.cols));
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
    // The selection length should be number of cell needed to be selected, not string length.
    // To support wide character
    this._terminal._core.selectionManager.setSelection(result.col, result.row, this._getCellLengthFromString(result));
    this._terminal.scrollLines(result.row - this._terminal._core.buffer.ydisp);
    return true;
  }
}
