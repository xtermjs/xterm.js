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
    if (startCol >= this._terminal.cols) {
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
        if (this._isRowCoveredByEarlierSearch(y)) {
          continue;
        }
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
        if (this._isRowCoveredByEarlierSearch(y)) {
          continue;
        }
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
        // Row 0 is never skipped: it can be a continuation whose line start was trimmed from the
        // scrollback, and nothing earlier in this loop has searched it.
        if (y > 0 && this._isRowCoveredByEarlierSearch(y)) {
          continue;
        }
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
    const startCol = this._terminal.cols;
    const isReverseSearch = true;

    this._lineCache.initLinesCache();
    const searchPosition: ISearchPosition = {
      startRow,
      startCol
    };

    let result: ISearchResult | undefined;
    if (prevSelectedPos) {
      searchPosition.startRow = startRow = prevSelectedPos.start.y;
      searchPosition.startCol = prevSelectedPos.start.x;
      if (cachedSearchTerm !== term) {
        // Try to expand selection to right first.
        result = this._findInLine(term, searchPosition, searchOptions, false);
        if (!result) {
          // If selection was not able to be expanded to the right, then try reverse search
          searchPosition.startRow = startRow = prevSelectedPos.end.y;
          searchPosition.startCol = prevSelectedPos.end.x;
        }
      }
    }

    result ??= this._findInLine(term, searchPosition, searchOptions, isReverseSearch);

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
   * `_isWholeWord` gated on the option, so a rejected hit can be stepped past instead of ending
   * the scan.
   */
  private _satisfiesWholeWord(searchIndex: number, line: string, term: string, searchOptions: ISearchOptions): boolean {
    return !searchOptions.wholeWord || this._isWholeWord(searchIndex, line, term);
  }

  /**
   * Whether an earlier `_findInLine` in this same call already scanned this row's line from an
   * equal or lower offset, which makes rescanning it pure O(rows^2) work on one long line. Sound
   * for every option because `_findInLine` returns the first accepted match at or after its
   * offset, which is monotone in that offset. Only valid once such a search has happened — the
   * wrap-around loop starts at row 0, whose line start may have been trimmed from the scrollback.
   */
  private _isRowCoveredByEarlierSearch(row: number): boolean {
    return this._terminal.buffer.active.getLine(row)?.isWrapped === true;
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
    // Ignore wrapped lines, only consider on unwrapped line (first row of command string).
    if (isReverseSearch) {
      // Reverse search never rewinds: its caller carries startCol down the rows of the line. Row 0
      // is searched even when wrapped, since its line start may have been trimmed from the
      // scrollback.
      if (searchPosition.startRow > 0 && this._terminal.buffer.active.getLine(searchPosition.startRow)?.isWrapped) {
        searchPosition.startCol += this._terminal.cols;
        return;
      }
    } else {
      // A loop rather than recursion: one frame per wrapped row overflows the stack on a line long
      // enough to fill the scrollback. Bounded at row 0 because after a reflow the buffer's ring
      // holds stale entries at negative indices, so `getLine(-1)` answers with a wrapped line.
      while (searchPosition.startRow > 0 && this._terminal.buffer.active.getLine(searchPosition.startRow)?.isWrapped) {
        searchPosition.startRow--;
        searchPosition.startCol += this._terminal.cols;
      }
    }
    const row = searchPosition.startRow;
    const col = searchPosition.startCol;

    let cache = this._lineCache.getLineFromCache(row);
    if (!cache) {
      cache = this._lineCache.translateBufferLineToStringWithWrap(row, true);
      this._lineCache.setLineInCache(row, cache);
    }
    const [stringLine, offsets] = cache;

    const offset = this._bufferColsToStringOffset(row, col, offsets);
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
          const matchIndex = searchRegex.lastIndex - foundTerm[0].length;
          if (foundTerm[0].length > 0 && this._satisfiesWholeWord(matchIndex, searchStringLine, foundTerm[0], searchOptions)) {
            resultIndex = matchIndex;
            term = foundTerm[0];
          }
          searchRegex.lastIndex = matchIndex + 1;
        }
      } else {
        // Driven over the whole line from `offset` rather than over `slice(offset)`: a slice
        // re-anchors ^ and \b at whatever column the row happened to wrap at, and only
        // first-accepted-match-at-or-after-offset is monotone in `offset`, which is what lets
        // `_isRowCoveredByEarlierSearch` skip a wrapped row an earlier scan already covered.
        searchRegex.lastIndex = offset;
        while (foundTerm = searchRegex.exec(searchStringLine)) {
          const matchIndex = searchRegex.lastIndex - foundTerm[0].length;
          if (foundTerm[0].length > 0 && this._satisfiesWholeWord(matchIndex, searchStringLine, foundTerm[0], searchOptions)) {
            resultIndex = matchIndex;
            term = foundTerm[0];
            break;
          }
          // A zero-length or rejected match would otherwise repeat forever.
          searchRegex.lastIndex = matchIndex + 1;
        }
      }
    } else if (isReverseSearch) {
      let matchIndex = offset - searchTerm.length >= 0 ? searchStringLine.lastIndexOf(searchTerm, offset - searchTerm.length) : -1;
      // `lastIndexOf` clamps a negative fromIndex to 0, so index 0 has to end the walk.
      while (matchIndex >= 0 && !this._satisfiesWholeWord(matchIndex, searchStringLine, searchTerm, searchOptions)) {
        matchIndex = matchIndex > 0 ? searchStringLine.lastIndexOf(searchTerm, matchIndex - 1) : -1;
      }
      resultIndex = matchIndex;
    } else {
      let matchIndex = searchStringLine.indexOf(searchTerm, offset);
      while (matchIndex >= 0 && !this._satisfiesWholeWord(matchIndex, searchStringLine, searchTerm, searchOptions)) {
        matchIndex = searchStringLine.indexOf(searchTerm, matchIndex + 1);
      }
      resultIndex = matchIndex;
    }

    if (resultIndex >= 0) {
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

  /**
   * `cols` counts from the start of the logical line, so summing the cells of every row before the
   * resume point costs O(line) per call and the highlight-all pass makes one call per match.
   * `lineOffsets` already holds the string offset each wrapped row starts at — the same map used
   * above to turn a match index back into a row — so only the last, partial row needs cells. It is
   * also the map the row a match lands on is read from, which the cell sum disagreed with by one
   * for a row whose trailing cell is the null placeholder of a wide character that wrapped.
   */
  private _bufferColsToStringOffset(startRow: number, cols: number, lineOffsets: number[]): number {
    const rowsBack = Math.min(Math.floor(cols / this._terminal.cols), lineOffsets.length - 1);
    let offset = lineOffsets[rowsBack];
    const line = this._terminal.buffer.active.getLine(startRow + rowsBack);
    if (line) {
      const colsInRow = Math.min(cols - rowsBack * this._terminal.cols, this._terminal.cols);
      for (let i = 0; i < colsInRow; i++) {
        const cell = line.getCell(i);
        if (!cell) {
          break;
        }
        if (cell.getWidth()) {
          // Treat null characters as whitespace to align with the translateToString API
          offset += cell.getCode() === 0 ? 1 : cell.getChars().length;
        }
      }
    }
    return offset;
  }
}
