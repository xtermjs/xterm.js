/**
 * Copyright (c) 2017 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import { Terminal, IBufferLine, IDisposable, ITerminalAddon, ISelectionPosition, IDecoration } from 'xterm';

export interface ISearchOptions {
  regex?: boolean;
  wholeWord?: boolean;
  caseSensitive?: boolean;
  incremental?: boolean;
}

export interface ISearchPosition {
  startCol: number;
  startRow: number;
}

export interface ISearchResult {
  term: string;
  col: number;
  row: number;
  size: number;
}

type LineCacheEntry = [
  /**
   * The string representation of a line (as opposed to the buffer cell representation).
   */
  lineAsString: string,
  /**
   * The offsets where each line starts when the entry describes a wrapped line.
   */
  lineOffsets: number[]
];

const NON_WORD_CHARACTERS = ' ~!@#$%^&*()+`-=[]{}|\\;:"\',./<>?';
const LINES_CACHE_TIME_TO_LIVE = 15 * 1000; // 15 secs

export class SearchAddon implements ITerminalAddon {
  private _terminal: Terminal | undefined;
  private _resultDecorations: IDecoration[] = [];
  /**
   * translateBufferLineToStringWithWrap is a fairly expensive call.
   * We memoize the calls into an array that has a time based ttl.
   * _linesCache is also invalidated when the terminal cursor moves.
   */
  private _linesCache: LineCacheEntry[] | undefined;
  private _linesCacheTimeoutId = 0;
  private _cursorMoveListener: IDisposable | undefined;
  private _resizeListener: IDisposable | undefined;

  public activate(terminal: Terminal): void {
    this._terminal = terminal;
  }

  public dispose(): void { }

  /**
   * Find the next instance of the term, then scroll to and select it. If it
   * doesn't exist, do nothing.
   * @param term The search term.
   * @param searchOptions Search options.
   * @return Whether a result was found.
   */
  public findNext(term: string, searchOptions?: ISearchOptions): boolean {
    if (!this._terminal) {
      throw new Error('Cannot use addon until it has been loaded');
    }

    if (!term || term.length === 0) {
      this._terminal.clearSelection();
      return false;
    }

    let startCol = 0;
    let startRow = 0;
    let currentSelection: ISelectionPosition | undefined;
    if (this._terminal.hasSelection()) {
      const incremental = searchOptions ? searchOptions.incremental : false;
      // Start from the selection end if there is a selection
      // For incremental search, use existing row
      currentSelection = this._terminal.getSelectionPosition()!;
      startRow = incremental ? currentSelection.startRow : currentSelection.endRow;
      startCol = incremental ? currentSelection.startColumn : currentSelection.endColumn;
    }

    this._initLinesCache();

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
        // If the current line is wrapped line, increase index of column to ignore the previous scan
        // Otherwise, reset beginning column index to zero with set new unwrapped line index
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
    if (!result && currentSelection) {
      searchPosition.startRow = currentSelection.startRow;
      searchPosition.startCol = 0;
      result = this._findInLine(term, searchPosition, searchOptions);
    }

    // Set selection and scroll if a result was found
    return true;
  }

  /**
   * Find the previous instance of the term, then scroll to and select it. If it
   * doesn't exist, do nothing.
   * @param term The search term.
   * @param searchOptions Search options.
   * @return Whether a result was found.
   */
  public findPrevious(term: string, searchOptions?: ISearchOptions): boolean {
    if (!this._terminal) {
      throw new Error('Cannot use addon until it has been loaded');
    }
    this._resultDecorations.forEach(d => d.dispose());
    this._resultDecorations = [];

    if (!term || term.length === 0) {
      this._terminal.clearSelection();
      return false;
    }
    const results = [];
    for (let i = this._terminal.buffer.active.viewportY; i < this._terminal.buffer.active.viewportY + this._terminal.rows; i++) {
      const result = this._findInLine(term, { startCol: 0, startRow: i }, searchOptions);
      if (result) {
        results.push(result);
      }
    }
    for (const result of results.filter(r => !!r && r.term.length)) {
      const resultDecoration = this._showResultDecoration(result);
      if (resultDecoration) {
        // Add decoration
        this._resultDecorations.push(resultDecoration);
      }
    }
    console.log(results);
    console.log(this._resultDecorations);
    return true;
  }

  /**
   * Sets up a line cache with a ttl
   */
  private _initLinesCache(): void {
    const terminal = this._terminal!;
    if (!this._linesCache) {
      this._linesCache = new Array(terminal.buffer.active.length);
      this._cursorMoveListener = terminal.onCursorMove(() => this._destroyLinesCache());
      this._resizeListener = terminal.onResize(() => this._destroyLinesCache());
    }

    window.clearTimeout(this._linesCacheTimeoutId);
    this._linesCacheTimeoutId = window.setTimeout(() => this._destroyLinesCache(), LINES_CACHE_TIME_TO_LIVE);
  }

  private _destroyLinesCache(): void {
    this._linesCache = undefined;
    if (this._cursorMoveListener) {
      this._cursorMoveListener.dispose();
      this._cursorMoveListener = undefined;
    }
    if (this._resizeListener) {
      this._resizeListener.dispose();
      this._resizeListener = undefined;
    }
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
    return ((searchIndex === 0) || (NON_WORD_CHARACTERS.includes(line[searchIndex - 1]))) &&
      (((searchIndex + term.length) === line.length) || (NON_WORD_CHARACTERS.includes(line[searchIndex + term.length])));
  }

  /**
   * Searches a line for a search term. Takes the provided terminal line and searches the text line, which may contain
   * subsequent terminal lines if the text is wrapped. If the provided line number is part of a wrapped text line that
   * started on an earlier line then it is skipped since it will be properly searched when the terminal line that the
   * text starts on is searched.
   * @param term The search term.
   * @param position The position to start the search.
   * @param searchOptions Search options.
   * @param isReverseSearch Whether the search should start from the right side of the terminal and search to the left.
   * @return The search result if it was found.
   */
  protected _findInLine(term: string, searchPosition: ISearchPosition, searchOptions: ISearchOptions = {}): ISearchResult | undefined {
    const terminal = this._terminal!;
    const row = searchPosition.startRow;
    const col = searchPosition.startCol;

    // Ignore wrapped lines, only consider on unwrapped line (first row of command string).
    const firstLine = terminal.buffer.active.getLine(row);
    if (firstLine?.isWrapped) {

      // This will iterate until we find the line start.
      // When we find it, we will search using the calculated start column.
      searchPosition.startRow--;
      searchPosition.startCol += terminal.cols;
      return this._findInLine(term, searchPosition, searchOptions);
    }
    let cache = this._linesCache?.[row];
    if (!cache) {
      cache = this._translateBufferLineToStringWithWrap(row, true);
      if (this._linesCache) {
        this._linesCache[row] = cache;
      }
    }
    const [stringLine, offsets] = cache;

    const offset = this._bufferColsToStringOffset(row, col);
    const searchTerm = searchOptions.caseSensitive ? term : term.toLowerCase();
    const searchStringLine = searchOptions.caseSensitive ? stringLine : stringLine.toLowerCase();

    let resultIndex = -1;
    if (searchOptions.regex) {
      const searchRegex = RegExp(searchTerm, 'g');
      const foundTerm = searchRegex.exec(searchStringLine.slice(offset));
      if (foundTerm && foundTerm[0].length > 0) {
        resultIndex = offset + (searchRegex.lastIndex - foundTerm[0].length);
        term = foundTerm[0];
      }
    } else {
      resultIndex = searchStringLine.indexOf(searchTerm, offset);
    }

    if (resultIndex >= 0) {
      if (searchOptions.wholeWord && !this._isWholeWord(resultIndex, searchStringLine, term)) {
        return;
      }

      // Adjust the row number and search index if needed since a "line" of text can span multiple rows
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
      const size = endColIndex - startColIndex + terminal.cols * (endRowOffset - startRowOffset);

      return {
        term,
        col: startColIndex,
        row: row + startRowOffset,
        size
      };
    }
  }

  private _stringLengthToBufferSize(row: number, offset: number): number {
    const line = this._terminal!.buffer.active.getLine(row);
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
    const terminal = this._terminal!;
    let lineIndex = startRow;
    let offset = 0;
    let line = terminal.buffer.active.getLine(lineIndex);
    while (cols > 0 && line) {
      for (let i = 0; i < cols && i < terminal.cols; i++) {
        const cell = line.getCell(i);
        if (!cell) {
          break;
        }
        if (cell.getWidth()) {
          offset += cell.getChars().length;
        }
      }
      lineIndex++;
      line = terminal.buffer.active.getLine(lineIndex);
      if (line && !line.isWrapped) {
        break;
      }
      cols -= terminal.cols;
    }
    return offset;
  }

  /**
   * Translates a buffer line to a string, including subsequent lines if they are wraps.
   * Wide characters will count as two columns in the resulting string. This
   * function is useful for getting the actual text underneath the raw selection
   * position.
   * @param line The line being translated.
   * @param trimRight Whether to trim whitespace to the right.
   */
  private _translateBufferLineToStringWithWrap(lineIndex: number, trimRight: boolean): LineCacheEntry {
    const terminal = this._terminal!;
    const strings = [];
    const lineOffsets = [0];
    let line = terminal.buffer.active.getLine(lineIndex);
    while (line) {
      const nextLine = terminal.buffer.active.getLine(lineIndex + 1);
      const lineWrapsToNext = nextLine ? nextLine.isWrapped : false;
      let string = line.translateToString(!lineWrapsToNext && trimRight);
      if (lineWrapsToNext && nextLine) {
        const lastCell = line.getCell(line.length - 1);
        const lastCellIsNull = lastCell && lastCell.getCode() === 0 && lastCell.getWidth() === 1;
        // a wide character wrapped to the next line
        if (lastCellIsNull && nextLine.getCell(0)?.getWidth() === 2) {
          string = string.slice(0, -1);
        }
      }
      strings.push(string);
      if (lineWrapsToNext) {
        lineOffsets.push(lineOffsets[lineOffsets.length - 1] + string.length);
      } else {
        break;
      }
      lineIndex++;
      line = nextLine;
    }
    return [strings.join(''), lineOffsets];
  }

  /**
   * Selects and scrolls to a result.
   * @param result The result to select.
   * @return Whethera result was selected.
   */
  private _showResultDecoration(result: ISearchResult | undefined): IDecoration | undefined {
    const terminal = this._terminal!;
    if (!result || result.row >= (terminal.buffer.active.viewportY + terminal.rows) || result.row < terminal.buffer.active.viewportY) {
      terminal.clearSelection();
      return;
    }
    const marker = terminal.registerMarker(undefined, result.row - 1);
    if (!marker) {
      return undefined;
    }
    const findResultDecoration = terminal.registerDecoration({ marker, width: result.size });
    findResultDecoration?.onRender((e) => {
      console.log('rendered', e, result?.term, result?.row);
      e.style.backgroundColor = 'blue';
      e.style.color = 'white';
      e.style.opacity = '60%';
      // TODO: use cell width here instead of 10
      e.style.left = `${(result.col === 0 ? 0 : result.col - 1) * 10}px`;
    });
    return findResultDecoration;
  }
}
