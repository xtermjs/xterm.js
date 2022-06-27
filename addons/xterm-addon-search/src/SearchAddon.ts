/**
 * Copyright (c) 2017 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import { Terminal, IDisposable, ITerminalAddon, ISelectionPosition, IDecoration } from 'xterm';
import { EventEmitter } from 'common/EventEmitter';

export interface ISearchOptions {
  regex?: boolean;
  wholeWord?: boolean;
  caseSensitive?: boolean;
  incremental?: boolean;
  decorations?: ISearchDecorationOptions;
  noScroll?: boolean;
}

interface ISearchDecorationOptions {
  matchBackground?: string;
  matchBorder?: string;
  matchOverviewRuler: string;
  activeMatchBackground?: string;
  activeMatchBorder?: string;
  activeMatchColorOverviewRuler: string;
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
  private _cachedSearchTerm: string | undefined;
  private _selectedDecoration: IDecoration | undefined;
  private _resultDecorations: Map<number, IDecoration[]> | undefined;
  private _searchResults: Map<string, ISearchResult> | undefined;
  private _onDataDisposable: IDisposable | undefined;
  private _onResizeDisposable: IDisposable | undefined;
  private _lastSearchOptions: ISearchOptions | undefined;
  private _highlightTimeout: number | undefined;
  /**
   * translateBufferLineToStringWithWrap is a fairly expensive call.
   * We memoize the calls into an array that has a time based ttl.
   * _linesCache is also invalidated when the terminal cursor moves.
   */
  private _linesCache: LineCacheEntry[] | undefined;
  private _linesCacheTimeoutId = 0;
  private _cursorMoveListener: IDisposable | undefined;
  private _resizeListener: IDisposable | undefined;

  private _resultIndex: number | undefined;

  private readonly _onDidChangeResults = new EventEmitter<{ resultIndex: number, resultCount: number } | undefined>();
  public readonly onDidChangeResults = this._onDidChangeResults.event;

  public activate(terminal: Terminal): void {
    this._terminal = terminal;
    this._onDataDisposable = this._terminal.onWriteParsed(() => this._updateMatches());
    this._onResizeDisposable = this._terminal.onResize(() => this._updateMatches());
  }

  private _updateMatches(): void {
    if (this._highlightTimeout) {
      window.clearTimeout(this._highlightTimeout);
    }
    if (this._cachedSearchTerm && this._lastSearchOptions?.decorations) {
      this._highlightTimeout = setTimeout(() => {
        this.findPrevious(this._cachedSearchTerm!, { ...this._lastSearchOptions, incremental: true, noScroll: true });
        this._resultIndex = this._searchResults ? this._searchResults.size - 1 : -1;
        this._onDidChangeResults.fire({ resultIndex: this._resultIndex, resultCount: this._searchResults?.size ?? -1 });
      }, 200);
    }
  }

  public dispose(): void {
    this.clearDecorations();
    this._onDataDisposable?.dispose();
    this._onResizeDisposable?.dispose();
  }

  public clearDecorations(retainCachedSearchTerm?: boolean): void {
    this._selectedDecoration?.dispose();
    this._searchResults?.clear();
    this._resultDecorations?.forEach(decorations => {
      for (const d of decorations) {
        d.dispose();
      }
    });
    this._resultDecorations?.clear();
    this._searchResults = undefined;
    this._resultDecorations = undefined;
    if (!retainCachedSearchTerm) {
      this._cachedSearchTerm = undefined;
    }
  }

  public clearActiveDecoration(): void {
    this._selectedDecoration?.dispose();
    this._selectedDecoration = undefined;
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
    this._lastSearchOptions = searchOptions;
    if (searchOptions?.decorations) {
      if (this._resultIndex !== undefined || this._cachedSearchTerm === undefined || term !== this._cachedSearchTerm) {
        this._highlightAllMatches(term, searchOptions);
      }
    }
    return this._fireResults(term, this._findNextAndSelect(term, searchOptions), searchOptions);
  }

  private _highlightAllMatches(term: string, searchOptions: ISearchOptions): void {
    if (!this._terminal) {
      throw new Error('Cannot use addon until it has been loaded');
    }
    if (!term || term.length === 0) {
      this.clearDecorations();
      return;
    }
    searchOptions = searchOptions || {};

    // new search, clear out the old decorations
    this.clearDecorations(true);
    this._searchResults = new Map<string, ISearchResult>();
    this._resultDecorations = new Map<number, IDecoration[]>();
    const resultDecorations = this._resultDecorations;
    let result = this._find(term, 0, 0, searchOptions);
    while (result && !this._searchResults.get(`${result.row}-${result.col}`)) {
      this._searchResults.set(`${result.row}-${result.col}`, result);
      result = this._find(
        term,
        result.col + result.term.length >= this._terminal.cols ? result.row + 1 : result.row,
        result.col + result.term.length >= this._terminal.cols ? 0 : result.col + 1,
        searchOptions
      );
      if (this._searchResults.size > 1000) {
        this.clearDecorations();
        this._resultIndex = undefined;
        return;
      }
    }
    this._searchResults.forEach(result => {
      const resultDecoration = this._createResultDecoration(result, searchOptions.decorations!);
      if (resultDecoration) {
        const decorationsForLine = resultDecorations.get(resultDecoration.marker.line) || [];
        decorationsForLine.push(resultDecoration);
        resultDecorations.set(resultDecoration.marker.line, decorationsForLine);
      }
    });
  }

  private _find(term: string, startRow: number, startCol: number, searchOptions?: ISearchOptions): ISearchResult | undefined {
    if (!this._terminal || !term || term.length === 0) {
      this._terminal?.clearSelection();
      this.clearDecorations();
      return undefined;
    }
    if (startCol > this._terminal.cols) {
      throw new Error(`Invalid col: ${startCol} to search in terminal of ${this._terminal.cols} cols`);
    }

    let result: ISearchResult | undefined = undefined;

    this._initLinesCache();

    const searchPosition: ISearchPosition = {
      startRow,
      startCol
    };

    // Search startRow
    result = this._findInLine(term, searchPosition, searchOptions);
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
    return result;
  }

  private _findNextAndSelect(term: string, searchOptions?: ISearchOptions): boolean {
    if (!this._terminal || !term || term.length === 0) {
      this._terminal?.clearSelection();
      this.clearDecorations();
      this._cachedSearchTerm = undefined;
      this._resultIndex = -1;
      return false;
    }

    if (this._cachedSearchTerm !== term) {
      this._resultIndex = undefined;
      this._terminal.clearSelection();
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

    if (this._searchResults) {
      if (this._searchResults.size === 0) {
        this._resultIndex = -1;
      } else if (this._resultIndex === undefined) {
        this._resultIndex = 0;
      } else {
        this._resultIndex++;
        if (this._resultIndex >= this._searchResults.size) {
          this._resultIndex = 0;
        }
      }
    }
    // Set selection and scroll if a result was found
    return this._selectResult(result, searchOptions?.decorations, searchOptions?.noScroll);
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
    this._lastSearchOptions = searchOptions;
    if (searchOptions?.decorations) {
      if (this._resultIndex !== undefined || this._cachedSearchTerm === undefined || term !== this._cachedSearchTerm) {
        this._highlightAllMatches(term, searchOptions);
      }
    }
    return this._fireResults(term, this._findPreviousAndSelect(term, searchOptions), searchOptions);
  }

  private _fireResults(term: string, found: boolean, searchOptions?: ISearchOptions): boolean {
    if (searchOptions?.decorations) {
      if (this._resultIndex !== undefined && this._searchResults?.size !== undefined) {
        this._onDidChangeResults.fire({ resultIndex: this._resultIndex, resultCount: this._searchResults.size });
      } else {
        this._onDidChangeResults.fire(undefined);
      }
    }
    this._cachedSearchTerm = term;
    return found;
  }

  private _findPreviousAndSelect(term: string, searchOptions?: ISearchOptions): boolean {
    if (!this._terminal) {
      throw new Error('Cannot use addon until it has been loaded');
    }
    let result: ISearchResult | undefined;
    if (!this._terminal || !term || term.length === 0) {
      result = undefined;
      this._terminal?.clearSelection();
      this.clearDecorations();
      this._resultIndex = -1;
      return false;
    }

    if (this._cachedSearchTerm !== term) {
      this._resultIndex = undefined;
      this._terminal.clearSelection();
    }

    let startRow = this._terminal.buffer.active.baseY + this._terminal.rows;
    let startCol = this._terminal.cols;
    const isReverseSearch = true;

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
      result = this._findInLine(term, searchPosition, searchOptions, false);
      const isOldResultHighlighted = result && result.row === startRow && result.col === startCol;
      if (!isOldResultHighlighted) {
        // If selection was not able to be expanded to the right, then try reverse search
        if (currentSelection) {
          searchPosition.startRow = currentSelection.endRow;
          searchPosition.startCol = currentSelection.endColumn;
        }
        result = this._findInLine(term, searchPosition, searchOptions, true);
      }
    } else {
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
    if (!result && startRow !== (this._terminal.buffer.active.baseY + this._terminal.rows)) {
      for (let y = (this._terminal.buffer.active.baseY + this._terminal.rows); y >= startRow; y--) {
        searchPosition.startRow = y;
        result = this._findInLine(term, searchPosition, searchOptions, isReverseSearch);
        if (result) {
          break;
        }
      }
    }

    if (this._searchResults) {
      if (this._searchResults.size === 0) {
        this._resultIndex = -1;
      } else if (this._resultIndex === undefined || this._resultIndex < 0) {
        this._resultIndex = this._searchResults.size - 1;
      } else {
        this._resultIndex--;
        if (this._resultIndex === -1) {
          this._resultIndex = this._searchResults.size - 1;
        }
      }
    }

    // If there is only one result, return true.
    if (!result && currentSelection) return true;

    // Set selection and scroll if a result was found
    return this._selectResult(result, searchOptions?.decorations, searchOptions?.noScroll);
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
          // Treat null characters as whitespace to align with the translateToString API
          offset += cell.getCode() === 0 ? 1 : cell.getChars().length;
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
  private _selectResult(result: ISearchResult | undefined, options?: ISearchDecorationOptions, noScroll?: boolean): boolean {
    const terminal = this._terminal!;
    this.clearActiveDecoration();
    if (!result) {
      terminal.clearSelection();
      return false;
    }
    terminal.select(result.col, result.row, result.size);
    if (options) {
      const marker = terminal.registerMarker(-terminal.buffer.active.baseY - terminal.buffer.active.cursorY + result.row);
      if (marker) {
        this._selectedDecoration = terminal.registerDecoration({
          marker,
          x: result.col,
          width: result.size,
          backgroundColor: options.activeMatchBackground,
          layer: 'top',
          overviewRulerOptions: {
            color: options.activeMatchColorOverviewRuler
          }
        });
        this._selectedDecoration?.onRender((e) => this._applyStyles(e, options.activeMatchBorder, true));
        this._selectedDecoration?.onDispose(() => marker.dispose());
      }
    }

    if (!noScroll) {
      // If it is not in the viewport then we scroll else it just gets selected
      if (result.row >= (terminal.buffer.active.viewportY + terminal.rows) || result.row < terminal.buffer.active.viewportY) {
        let scroll = result.row - terminal.buffer.active.viewportY;
        scroll -= Math.floor(terminal.rows / 2);
        terminal.scrollLines(scroll);
      }
    }
    return true;
  }

  /**
   * Applies styles to the decoration when it is rendered
   * @param element the decoration's element
   * @param backgroundColor the background color to apply
   * @param borderColor the border color to apply
   * @returns
   */
  private _applyStyles(element: HTMLElement, borderColor: string | undefined, isActiveResult: boolean): void {
    if (element.clientWidth <= 0) {
      return;
    }
    if (!element.classList.contains('xterm-find-result-decoration')) {
      element.classList.add('xterm-find-result-decoration');
      if (borderColor) {
        element.style.outline = `1px solid ${borderColor}`;
      }
    }
    if (isActiveResult) {
      element.classList.add('xterm-find-active-result-decoration');
    }
  }

  /**
   * Creates a decoration for the result and applies styles
   * @param result the search result for which to create the decoration
   * @param options the options for the decoration
   * @returns the {@link IDecoration} or undefined if the marker has already been disposed of
   */
  private _createResultDecoration(result: ISearchResult, options: ISearchDecorationOptions): IDecoration | undefined {
    const terminal = this._terminal!;
    const marker = terminal.registerMarker(-terminal.buffer.active.baseY - terminal.buffer.active.cursorY + result.row);
    if (!marker) {
      return undefined;
    }
    const findResultDecoration = terminal.registerDecoration({
      marker,
      x: result.col,
      width: result.size,
      backgroundColor: options.matchBackground,
      overviewRulerOptions: this._resultDecorations?.get(marker.line) ? undefined : {
        color: options.matchOverviewRuler,
        position: 'center'
      }
    });
    findResultDecoration?.onRender((e) => this._applyStyles(e, options.matchBorder, false));
    findResultDecoration?.onDispose(() => marker.dispose());
    return findResultDecoration;
  }
}
