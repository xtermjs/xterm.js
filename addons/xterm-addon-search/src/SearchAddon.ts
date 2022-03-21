/**
 * Copyright (c) 2017 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import { Terminal, IDisposable, ITerminalAddon, ISelectionPosition, IDecoration } from 'xterm';

export interface ISearchOptions {
  regex?: boolean;
  wholeWord?: boolean;
  caseSensitive?: boolean;
  incremental?: boolean;
  decorations?: IDecorationColor;
}

interface IDecorationColor {
  matchColor: string;
  selectedColor: string;
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
  private _result: ISearchResult | undefined;
  private _dataChanged: boolean = false;
  private _cachedSearchTerm: string | undefined;
  private _selectedDecoration: IDecoration | undefined;
  private _resultDecorations: Map<number, IDecoration[]> = new Map<number, IDecoration[]>();
  private _searchResults:  Map<string, ISearchResult> = new Map();
  private _onDataDisposable: IDisposable | undefined;
  private _addToPrior: boolean = false;
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
    this._onDataDisposable = this._terminal.onData(() => this._dataChanged = true);
  }

  public dispose(): void {
    this.clear();
    this._onDataDisposable?.dispose();
  }

  public clear(): void {
    this._selectedDecoration?.dispose();
    this._terminal?.clearSelection();
    this._searchResults.clear();
    this._resultDecorations.forEach(decorations => decorations.forEach(d=> d.dispose()));
    this._resultDecorations.clear();
    this._cachedSearchTerm = undefined;
    this._dataChanged = true;
  }

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
    return searchOptions?.decorations ? this._highlightAllMatches(term, searchOptions, 'next') : this._findAndSelectNext(term, searchOptions);
  }

  private _highlightAllMatches(term: string, searchOptions: ISearchOptions, type: 'next' | 'previous'): boolean {
    if (!this._terminal) {
      throw new Error('cannot find all matches with no terminal');
    }
    if (!term || term.length === 0) {
      this.clear();
      return false;
    }
    searchOptions = searchOptions || {};
    if (term === this._cachedSearchTerm) {
      if (!this._dataChanged) {
        return this._findAndSelectNext(term, searchOptions);
      }
      this._addToPrior = true;
    } else {
      // new search, clear out the old decorations
      this._resultDecorations.forEach(decorations => decorations.forEach(d=> d.dispose()));
      this._resultDecorations.clear();
      this._searchResults.clear();
    }
    if (!this._terminal.options.overviewRulerWidth) {
      this._terminal.options.overviewRulerWidth = 10;
    }
    searchOptions.incremental = false;
    let found = type === 'next' ? this._findAndSelectNext(term, searchOptions) : this._findAndSelectPrevious(term, searchOptions);
    while (found && (!this._result || !this._searchResults.get(`${this._result.row}-${this._result.col}`))) {
      if (this._result) {
        this._searchResults.set(`${this._result.row}-${this._result.col}`, this._result);
      }
      found = type === 'next' ? this._findAndSelectNext(term, searchOptions) : this._findAndSelectPrevious(term, searchOptions);
    }
    this._searchResults.forEach(result => {
      const resultDecoration = this._createResultDecoration(result, searchOptions.decorations);
      if (resultDecoration) {
        const decorationsForLine = this._resultDecorations.get(resultDecoration.marker.line) || [];
        decorationsForLine.push(resultDecoration);
        this._resultDecorations.set(resultDecoration.marker.line, decorationsForLine);
      }
    });
    if (this._dataChanged) {
      this._dataChanged = false;
    }
    if (this._addToPrior) {
      this._addToPrior = false;
    }
    if (this._searchResults.size > 0) {
      this._cachedSearchTerm = term;
    }
    return this._searchResults.size > 0;
  }

  private _findAndSelectNext(term: string, searchOptions?: ISearchOptions): boolean {
    if (!this._terminal || !term || term.length === 0) {
      this._result = undefined;
      this._terminal?.clearSelection();
      this.clear();
      return false;
    }

    let startCol = 0;
    let startRow = 0;
    if (searchOptions?.decorations && this._addToPrior) {
      // set start row and col to avoid redoing work
      const key = Array.from(this._searchResults.keys()).pop()?.split('-');
      if (key?.length === 2) {
        startRow = Number.parseInt(key[0]);
        startCol = Number.parseInt(key[1]) + 1;
      }
    }
    let currentSelection: ISelectionPosition | undefined;
    if (this._terminal.hasSelection()) {
      const incremental = searchOptions ? searchOptions.incremental : false;
      // Start from the selection end if there is a selection
      // For incremental search, use existing row
      currentSelection = this._terminal.getSelectionPosition()!;
      startRow = incremental ? currentSelection.startRow : currentSelection.endRow;
      startCol = incremental ? currentSelection.startColumn : currentSelection.endColumn;
    } else if (!startRow) {
      startRow = this._terminal.buffer.active.cursorY;
      startCol = this._terminal.buffer.active.cursorX;
    }

    this._initLinesCache();

    const searchPosition: ISearchPosition = {
      startRow,
      startCol
    };

    // Search startRow
    this._result = this._findInLine(term, searchPosition, searchOptions);
    // Search from startRow + 1 to end
    if (!this._result) {

      for (let y = startRow + 1; y < this._terminal.buffer.active.baseY + this._terminal.rows; y++) {
        searchPosition.startRow = y;
        searchPosition.startCol = 0;
        // If the current line is wrapped line, increase index of column to ignore the previous scan
        // Otherwise, reset beginning column index to zero with set new unwrapped line index
        this._result = this._findInLine(term, searchPosition, searchOptions);
        if (this._result) {
          break;
        }
      }
    }
    // If we hit the bottom and didn't search from the very top wrap back up
    if (!this._result && startRow !== 0) {
      for (let y = 0; y < startRow; y++) {
        searchPosition.startRow = y;
        searchPosition.startCol = 0;
        this._result = this._findInLine(term, searchPosition, searchOptions);
        if (this._result) {
          break;
        }
      }
    }

    // If there is only one result, wrap back and return selection if it exists.
    if (!this._result && currentSelection) {
      searchPosition.startRow = currentSelection.startRow;
      searchPosition.startCol = 0;
      this._result = this._findInLine(term, searchPosition, searchOptions);
    }

    // Set selection and scroll if a result was found
    return this._selectResult(this._result, searchOptions?.decorations);
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
    return searchOptions?.decorations ? this._highlightAllMatches(term, searchOptions, 'previous') : this._findAndSelectPrevious(term, searchOptions);
  }

  private _findAndSelectPrevious(term: string, searchOptions?: ISearchOptions): boolean {
    if (!this._terminal) {
      throw new Error('Cannot use addon until it has been loaded');
    }

    if (!this._terminal || !term || term.length === 0) {
      this._result = undefined;
      this._terminal?.clearSelection();
      this.clear();
      return false;
    }

    let startRow = this._terminal.buffer.active.baseY + this._terminal.rows;
    let startCol = this._terminal.cols;
    const isReverseSearch = true;
    // if (searchOptions?.highlightAllMatches && this._addToPrior) {
    //   // set start row and col to avoid redoing work
    //   // TODO: fix this will mess with the order that they're iterated through
    //   const key = Array.from(this._searchResults.keys()).pop()?.split('-');
    //   if (key?.length === 2) {
    //     startRow = Number.parseInt(key[0]);
    //     startCol = Number.parseInt(key[1]) + 1;
    //   }
    // }

    const incremental = searchOptions ? searchOptions.incremental : false;
    let currentSelection: ISelectionPosition | undefined;
    if (this._terminal.hasSelection()) {
      currentSelection = this._terminal.getSelectionPosition()!;
      // Start from selection start if there is a selection
      startRow = currentSelection.startRow;
      startCol = currentSelection.startColumn;
    }

    this._initLinesCache();
    const searchPosition: ISearchPosition = {
      startRow,
      startCol
    };

    if (incremental) {
      // Try to expand selection to right first.
      this._result = this._findInLine(term, searchPosition, searchOptions, false);
      const isOldResultHighlighted = this._result && this._result.row === startRow && this._result.col === startCol;
      if (!isOldResultHighlighted) {
        // If selection was not able to be expanded to the right, then try reverse search
        if (currentSelection) {
          searchPosition.startRow = currentSelection.endRow;
          searchPosition.startCol = currentSelection.endColumn;
        }
        this._result = this._findInLine(term, searchPosition, searchOptions, true);
      }
    } else {
      this._result = this._findInLine(term, searchPosition, searchOptions, isReverseSearch);
    }

    // Search from startRow - 1 to top
    if (!this._result) {
      searchPosition.startCol = Math.max(searchPosition.startCol, this._terminal.cols);
      for (let y = startRow - 1; y >= 0; y--) {
        searchPosition.startRow = y;
        this._result = this._findInLine(term, searchPosition, searchOptions, isReverseSearch);
        if (this._result) {
          break;
        }
      }
    }
    // If we hit the top and didn't search from the very bottom wrap back down
    if (!this._result && startRow !== (this._terminal.buffer.active.baseY + this._terminal.rows)) {
      for (let y = (this._terminal.buffer.active.baseY + this._terminal.rows); y >= startRow; y--) {
        searchPosition.startRow = y;
        this._result = this._findInLine(term, searchPosition, searchOptions, isReverseSearch);
        if (this._result) {
          break;
        }
      }
    }

    // If there is only one result, return true.
    if (!this._result && currentSelection) return true;

    // Set selection and scroll if a this._result was found
    return this._selectResult(this._result, searchOptions?.decorations);
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
  protected _findInLine(term: string, searchPosition: ISearchPosition, searchOptions: ISearchOptions = {}, isReverseSearch: boolean = false): ISearchResult | undefined {
    const terminal = this._terminal!;
    const row = searchPosition.startRow;
    const col = searchPosition.startCol;

    // Ignore wrapped lines, only consider on unwrapped line (first row of command string).
    const firstLine = terminal.buffer.active.getLine(row);
    if (firstLine?.isWrapped) {
      if (isReverseSearch) {
        searchPosition.startCol += terminal.cols;
        return;
      }

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
   * @return Whether a result was selected.
   */
  private _selectResult(result: ISearchResult | undefined, decorations?: IDecorationColor): boolean {
    const terminal = this._terminal!;
    this._selectedDecoration?.dispose();
    if (!result) {
      terminal.clearSelection();
      return false;
    }
    terminal.select(result.col, result.row, result.size);
    if (decorations?.selectedColor) {
      const marker = terminal.registerMarker(-terminal.buffer.active.baseY - terminal.buffer.active.cursorY + result.row);
      if (marker) {
        this._selectedDecoration = terminal.registerDecoration({ marker, overviewRulerOptions: { color: decorations.selectedColor } });
        this._selectedDecoration?.onRender((e) => this._applyStyles(e, decorations.selectedColor, result));
      }
    }

    // If it is not in the viewport then we scroll else it just gets selected
    if (result.row >= (terminal.buffer.active.viewportY + terminal.rows) || result.row < terminal.buffer.active.viewportY) {
      let scroll = result.row - terminal.buffer.active.viewportY;
      scroll -= Math.floor(terminal.rows / 2);
      terminal.scrollLines(scroll);
    }
    return true;
  }

  /**
   * Applies styles to the decoration when it is rendered
   * @param element the decoration's element
   * @param color the color to apply
   * @param result the search result associated with the decoration
   * @returns
   */
  private _applyStyles(element: HTMLElement, color: string, result: ISearchResult): void {
    if (element.clientWidth <= 0) {
      return;
    }
    if (!element.classList.contains('xterm-find-result-decoration')) {
      element.classList.add('xterm-find-result-decoration');
      // decoration's clientWidth = actualCellWidth
      element.style.left = `${element.clientWidth * result.col}px`;
      element.style.width = `${element.clientWidth * result.term.length}px`;
      element.style.backgroundColor = color;
    }
  }

  /**
   * Creates a decoration for the result and applies styles
   * @param result the search result for which to create the decoration
   * @param color the color to use for the decoration
   * @returns the {@link IDecoration} or undefined if the marker has already been disposed of
   */
  private _createResultDecoration(result: ISearchResult, decorations?: IDecorationColor): IDecoration | undefined {
    const terminal = this._terminal!;
    const marker = terminal.registerMarker(-terminal.buffer.active.baseY - terminal.buffer.active.cursorY + result.row);
    if (!marker || !decorations?.matchColor) {
      return undefined;
    }
    const findResultDecoration = terminal.registerDecoration(
      { marker,
        overviewRulerOptions: this._resultDecorations.get(marker.line) && !this._dataChanged ? undefined : { color: decorations.matchColor, position: 'center' }
      });
    findResultDecoration?.onRender((e) => this._applyStyles(e, decorations.matchColor, result));
    return findResultDecoration;
  }
}
