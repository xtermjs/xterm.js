/**
 * Copyright (c) 2017 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import type { Terminal } from '@xterm/xterm';
import type { ISearchOptions } from '@xterm/addon-search';
import type { SearchLineCache } from './SearchLineCache';

/**
 * Represents the position to start a search from.
 */
interface ISearchPosition {
  startCol: number;
  startRow: number;
}

/**
 * Represents a search result with its position and content.
 */
export interface ISearchResult {
  term: string;
  col: number;
  row: number;
  size: number;
}

/**
 * Configuration constants for the search engine functionality.
 */
const enum Constants {
  /**
   * Characters that are considered non-word characters for search boundary detection. These
   * characters are used to determine word boundaries when performing whole-word searches. Includes
   * common punctuation, symbols, and whitespace characters.
   */
  NON_WORD_CHARACTERS = ' ~!@#$%^&*()+`-=[]{}|\\;:"\',./<>?'
}

/**
 * Core search engine that handles finding text within terminal content.
 * This class is responsible for the actual search algorithms and position calculations.
 */
export class SearchEngine {
  constructor(
    private readonly _terminal: Terminal,
    private readonly _lineCache: SearchLineCache
  ) {}

  /**
   * Find the first occurrence of a term starting from a specific position.
   * @param term The search term.
   * @param startRow The row to start searching from.
   * @param startCol The column to start searching from.
   * @param searchOptions Search options.
   * @returns The search result if found, undefined otherwise.
   */
  public find(term: string, startRow: number, startCol: number, searchOptions?: ISearchOptions): ISearchResult | undefined {
    if (!term || term.length === 0) {
      this._terminal.clearSelection();
      return undefined;
    }
    if (startCol > this._terminal.cols) {
      throw new Error(`Invalid col: ${startCol} to search in terminal of ${this._terminal.cols} cols`);
    }

    this._lineCache.initLinesCache();

    const searchPosition: ISearchPosition = {
      startRow,
      startCol
    };

    // Search startRow
    let result = this._findInLine(term, searchPosition, searchOptions);
    // Search from startRow + 1 to end
    if (!result) {
      for (let y = startRow + 1; y < this._terminal.buffer.active.baseY + this._terminal.rows; y++) {
        searchPosition.startRow = y;
        searchPosition.startCol = 0;
        result = this._findInLine(term, searchPosition, searchOptions);
        if (result) {
          break;
        }
      }
    }
    return result;
  }

  /**
   * Find the next occurrence of a term with wrapping and selection management.
   * @param term The search term.
   * @param searchOptions Search options.
   * @param cachedSearchTerm The cached search term to determine incremental behavior.
   * @returns The search result if found, undefined otherwise.
   */
  public findNextWithSelection(term: string, searchOptions?: ISearchOptions, cachedSearchTerm?: string): ISearchResult | undefined {
    if (!term || term.length === 0) {
      this._terminal.clearSelection();
      return undefined;
    }

    const prevSelectedPos = this._terminal.getSelectionPosition();
    this._terminal.clearSelection();

    let startCol = 0;
    let startRow = 0;
    if (prevSelectedPos) {
      if (cachedSearchTerm === term) {
        startCol = prevSelectedPos.end.x;
        startRow = prevSelectedPos.end.y;
      } else {
        startCol = prevSelectedPos.start.x;
        startRow = prevSelectedPos.start.y;
      }
    }

    this._lineCache.initLinesCache();

    const searchPosition: ISearchPosition = {
      startRow,
      startCol
    };

    // Search startRow
    let result = this._findInLine(term, searchPosition, searchOptions);
    // Search from startRow + 1 to end
    if (!result) {
      for (let y = startRow + 1; y < this._terminal.buffer.active.baseY + this._terminal.rows; y++) {
        searchPosition.startRow = y;
        searchPosition.startCol = 0;
        result = this._findInLine(term, searchPosition, searchOptions);
        if (result) {
          break;
        }
      }
    }
    // If we hit the bottom and didn't search from the very top wrap back up
    if (!result && startRow !== 0) {
      for (let y = 0; y < startRow; y++) {
        searchPosition.startRow = y;
        searchPosition.startCol = 0;
        result = this._findInLine(term, searchPosition, searchOptions);
        if (result) {
          break;
        }
      }
    }

    // If there is only one result, wrap back and return selection if it exists.
    if (!result && prevSelectedPos) {
      searchPosition.startRow = prevSelectedPos.start.y;
      searchPosition.startCol = 0;
      result = this._findInLine(term, searchPosition, searchOptions);
    }

    return result;
  }

  /**
   * Find the previous occurrence of a term with wrapping and selection management.
   * @param term The search term.
   * @param searchOptions Search options.
   * @param cachedSearchTerm The cached search term to determine if expansion should occur.
   * @returns The search result if found, undefined otherwise.
   */
  public findPreviousWithSelection(term: string, searchOptions?: ISearchOptions, cachedSearchTerm?: string): ISearchResult | undefined {
    if (!term || term.length === 0) {
      this._terminal.clearSelection();
      return undefined;
    }

    const prevSelectedPos = this._terminal.getSelectionPosition();
    this._terminal.clearSelection();

    let startRow = this._terminal.buffer.active.baseY + this._terminal.rows - 1;
    let startCol = this._terminal.cols;
    const isReverseSearch = true;

    this._lineCache.initLinesCache();
    const searchPosition: ISearchPosition = {
      startRow,
      startCol
    };

    let result: ISearchResult | undefined;
    if (prevSelectedPos) {
      searchPosition.startRow = startRow = prevSelectedPos.start.y;
      searchPosition.startCol = startCol = prevSelectedPos.start.x;
      if (cachedSearchTerm !== term) {
        // Try to expand selection to right first.
        result = this._findInLine(term, searchPosition, searchOptions, false);
        if (!result) {
          // If selection was not able to be expanded to the right, then try reverse search
          searchPosition.startRow = startRow = prevSelectedPos.end.y;
          searchPosition.startCol = startCol = prevSelectedPos.end.x;
        }
      }
    }

    if (!result) {
      result = this._findInLine(term, searchPosition, searchOptions, isReverseSearch);
    }

    // Search from startRow - 1 to top
    if (!result) {
      searchPosition.startCol = Math.max(searchPosition.startCol, this._terminal.cols);
      for (let y = startRow - 1; y >= 0; y--) {
        searchPosition.startRow = y;
        result = this._findInLine(term, searchPosition, searchOptions, isReverseSearch);
        if (result) {
          break;
        }
      }
    }
    // If we hit the top and didn't search from the very bottom wrap back down
    if (!result && startRow !== (this._terminal.buffer.active.baseY + this._terminal.rows - 1)) {
      for (let y = (this._terminal.buffer.active.baseY + this._terminal.rows - 1); y >= startRow; y--) {
        searchPosition.startRow = y;
        result = this._findInLine(term, searchPosition, searchOptions, isReverseSearch);
        if (result) {
          break;
        }
      }
    }

    return result;
  }

  /**
   * A found substring is a whole word if it doesn't have an alphanumeric character directly
   * adjacent to it.
   * @param searchIndex starting index of the potential whole word substring
   * @param line entire string in which the potential whole word was found
   * @param term the substring that starts at searchIndex
   */
  private _isWholeWord(searchIndex: number, line: string, term: string): boolean {
    return ((searchIndex === 0) || (Constants.NON_WORD_CHARACTERS.includes(line[searchIndex - 1]))) &&
      (((searchIndex + term.length) === line.length) || (Constants.NON_WORD_CHARACTERS.includes(line[searchIndex + term.length])));
  }

  /**
   * Searches a line for a search term. Takes the provided terminal line and searches the text line,
   * which may contain subsequent terminal lines if the text is wrapped. If the provided line number
   * is part of a wrapped text line that started on an earlier line then it is skipped since it will
   * be properly searched when the terminal line that the text starts on is searched.
   * @param term The search term.
   * @param searchPosition The position to start the search.
   * @param searchOptions Search options.
   * @param isReverseSearch Whether the search should start from the right side of the terminal and
   * search to the left.
   * @returns The search result if it was found.
   */
  private _findInLine(term: string, searchPosition: ISearchPosition, searchOptions: ISearchOptions = {}, isReverseSearch: boolean = false): ISearchResult | undefined {
    const row = searchPosition.startRow;
    const col = searchPosition.startCol;

    // Ignore wrapped lines, only consider on unwrapped line (first row of command string).
    const firstLine = this._terminal.buffer.active.getLine(row);
    if (firstLine?.isWrapped) {
      if (isReverseSearch) {
        searchPosition.startCol += this._terminal.cols;
        return;
      }

      // This will iterate until we find the line start.
      // When we find it, we will search using the calculated start column.
      searchPosition.startRow--;
      searchPosition.startCol += this._terminal.cols;
      return this._findInLine(term, searchPosition, searchOptions);
    }
    let cache = this._lineCache.getLineFromCache(row);
    if (!cache) {
      cache = this._lineCache.translateBufferLineToStringWithWrap(row, true);
      this._lineCache.setLineInCache(row, cache);
    }
    const [stringLine, offsets] = cache;

    const offset = this._bufferColsToStringOffset(row, col);
    let searchTerm = term;
    let searchStringLine = stringLine;
    if (!searchOptions.regex) {
      searchTerm = searchOptions.caseSensitive ? term : term.toLowerCase();
      searchStringLine = searchOptions.caseSensitive ? stringLine : stringLine.toLowerCase();
    }

    let resultIndex = -1;
    if (searchOptions.regex) {
      const searchRegex = RegExp(searchTerm, searchOptions.caseSensitive ? 'g' : 'gi');
      let foundTerm: RegExpExecArray | null;
      if (isReverseSearch) {
        // This loop will get the resultIndex of the _last_ regex match in the range 0..offset
        while (foundTerm = searchRegex.exec(searchStringLine.slice(0, offset))) {
          resultIndex = searchRegex.lastIndex - foundTerm[0].length;
          term = foundTerm[0];
          searchRegex.lastIndex -= (term.length - 1);
        }
      } else {
        foundTerm = searchRegex.exec(searchStringLine.slice(offset));
        if (foundTerm && foundTerm[0].length > 0) {
          resultIndex = offset + (searchRegex.lastIndex - foundTerm[0].length);
          term = foundTerm[0];
        }
      }
    } else {
      if (isReverseSearch) {
        if (offset - searchTerm.length >= 0) {
          resultIndex = searchStringLine.lastIndexOf(searchTerm, offset - searchTerm.length);
        }
      } else {
        resultIndex = searchStringLine.indexOf(searchTerm, offset);
      }
    }

    if (resultIndex >= 0) {
      if (searchOptions.wholeWord && !this._isWholeWord(resultIndex, searchStringLine, term)) {
        return;
      }

      // Adjust the row number and search index if needed since a "line" of text can span multiple
      // rows
      let startRowOffset = 0;
      while (startRowOffset < offsets.length - 1 && resultIndex >= offsets[startRowOffset + 1]) {
        startRowOffset++;
      }
      let endRowOffset = startRowOffset;
      while (endRowOffset < offsets.length - 1 && resultIndex + term.length >= offsets[endRowOffset + 1]) {
        endRowOffset++;
      }
      const startColOffset = resultIndex - offsets[startRowOffset];
      const endColOffset = resultIndex + term.length - offsets[endRowOffset];
      const startColIndex = this._stringLengthToBufferSize(row + startRowOffset, startColOffset);
      const endColIndex = this._stringLengthToBufferSize(row + endRowOffset, endColOffset);
      const size = endColIndex - startColIndex + this._terminal.cols * (endRowOffset - startRowOffset);

      return {
        term,
        col: startColIndex,
        row: row + startRowOffset,
        size
      };
    }
  }

  private _stringLengthToBufferSize(row: number, offset: number): number {
    const line = this._terminal.buffer.active.getLine(row);
    if (!line) {
      return 0;
    }
    for (let i = 0; i < offset; i++) {
      const cell = line.getCell(i);
      if (!cell) {
        break;
      }
      // Adjust the searchIndex to normalize emoji into single chars
      const char = cell.getChars();
      if (char.length > 1) {
        offset -= char.length - 1;
      }
      // Adjust the searchIndex for empty characters following wide unicode
      // chars (eg. CJK)
      const nextCell = line.getCell(i + 1);
      if (nextCell && nextCell.getWidth() === 0) {
        offset++;
      }
    }
    return offset;
  }

  private _bufferColsToStringOffset(startRow: number, cols: number): number {
    let lineIndex = startRow;
    let offset = 0;
    let line = this._terminal.buffer.active.getLine(lineIndex);
    while (cols > 0 && line) {
      for (let i = 0; i < cols && i < this._terminal.cols; i++) {
        const cell = line.getCell(i);
        if (!cell) {
          break;
        }
        if (cell.getWidth()) {
          // Treat null characters as whitespace to align with the translateToString API
          offset += cell.getCode() === 0 ? 1 : cell.getChars().length;
        }
      }
      lineIndex++;
      line = this._terminal.buffer.active.getLine(lineIndex);
      if (line && !line.isWrapped) {
        break;
      }
      cols -= this._terminal.cols;
    }
    return offset;
  }
}
