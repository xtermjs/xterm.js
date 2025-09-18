/**
 * Copyright (c) 2017 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import type { Terminal, IDisposable, ITerminalAddon, IDecoration } from '@xterm/xterm';
import type { SearchAddon as ISearchApi, ISearchOptions, ISearchDecorationOptions, ISearchAddonOptions, ISearchResultChangeEvent } from '@xterm/addon-search';
import { Emitter, Event } from 'vs/base/common/event';
import { Disposable, dispose, MutableDisposable, toDisposable } from 'vs/base/common/lifecycle';
import { disposableTimeout } from 'vs/base/common/async';
import { SearchLineCache } from './SearchLineCache';

interface IInternalSearchOptions {
  noScroll: boolean;
}

interface ISearchPosition {
  startCol: number;
  startRow: number;
}

interface ISearchResult {
  term: string;
  col: number;
  row: number;
  size: number;
}

interface IHighlight extends IDisposable {
  decoration: IDecoration;
  match: ISearchResult;
}

interface IMultiHighlight extends IDisposable {
  decorations: IDecoration[];
  match: ISearchResult;
}

/**
 * Configuration constants for the search addon functionality.
 */
const enum Constants {
  /**
   * Characters that are considered non-word characters for search boundary detection. These
   * characters are used to determine word boundaries when performing whole-word searches. Includes
   * common punctuation, symbols, and whitespace characters.
   */
  NON_WORD_CHARACTERS = ' ~!@#$%^&*()+`-=[]{}|\\;:"\',./<>?',

  /**
   * Default maximum number of search results to highlight simultaneously. This limit prevents
   * performance degradation when searching for very common terms that would result in excessive
   * highlighting decorations.
   */
  DEFAULT_HIGHLIGHT_LIMIT = 1000
}

export class SearchAddon extends Disposable implements ITerminalAddon, ISearchApi {
  private _terminal: Terminal | undefined;
  private _cachedSearchTerm: string | undefined;
  private _highlightedLines: Set<number> = new Set();
  private _highlightDecorations: IHighlight[] = [];
  private _searchResultsWithHighlight: ISearchResult[] = [];
  private _selectedDecoration = this._register(new MutableDisposable<IMultiHighlight>());
  private _highlightLimit: number;
  private _lastSearchOptions: ISearchOptions | undefined;
  private _highlightTimeout = this._register(new MutableDisposable<IDisposable>());
  private _lineCache = this._register(new MutableDisposable<SearchLineCache>());

  private readonly _onDidChangeResults = this._register(new Emitter<ISearchResultChangeEvent>());
  public get onDidChangeResults(): Event<ISearchResultChangeEvent> { return this._onDidChangeResults.event; }

  constructor(options?: Partial<ISearchAddonOptions>) {
    super();

    this._highlightLimit = options?.highlightLimit ?? Constants.DEFAULT_HIGHLIGHT_LIMIT;
  }

  public activate(terminal: Terminal): void {
    this._terminal = terminal;
    this._lineCache.value = new SearchLineCache(terminal);
    this._register(this._terminal.onWriteParsed(() => this._updateMatches()));
    this._register(this._terminal.onResize(() => this._updateMatches()));
    this._register(toDisposable(() => this.clearDecorations()));
  }

  private _updateMatches(): void {
    this._highlightTimeout.clear();
    if (this._cachedSearchTerm && this._lastSearchOptions?.decorations) {
      this._highlightTimeout.value = disposableTimeout(() => {
        const term = this._cachedSearchTerm;
        this._cachedSearchTerm = undefined;
        this.findPrevious(term!, { ...this._lastSearchOptions, incremental: true }, { noScroll: true });
      }, 200);
    }
  }

  public clearDecorations(retainCachedSearchTerm?: boolean): void {
    this._selectedDecoration.clear();
    dispose(this._highlightDecorations);
    this._highlightDecorations = [];
    this._searchResultsWithHighlight = [];
    this._highlightedLines.clear();
    if (!retainCachedSearchTerm) {
      this._cachedSearchTerm = undefined;
    }
  }

  public clearActiveDecoration(): void {
    this._selectedDecoration.clear();
  }

  /**
   * Find the next instance of the term, then scroll to and select it. If it
   * doesn't exist, do nothing.
   * @param term The search term.
   * @param searchOptions Search options.
   * @returns Whether a result was found.
   */
  public findNext(term: string, searchOptions?: ISearchOptions, internalSearchOptions?: IInternalSearchOptions): boolean {
    if (!this._terminal) {
      throw new Error('Cannot use addon until it has been loaded');
    }
    const didOptionsChanged = this._lastSearchOptions ? this._didOptionsChange(this._lastSearchOptions, searchOptions) : true;
    this._lastSearchOptions = searchOptions;
    if (searchOptions?.decorations) {
      if (this._cachedSearchTerm === undefined || term !== this._cachedSearchTerm || didOptionsChanged) {
        this._highlightAllMatches(term, searchOptions);
      }
    }

    const found = this._findNextAndSelect(term, searchOptions, internalSearchOptions);
    this._fireResults(searchOptions);
    this._cachedSearchTerm = term;

    return found;
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

    let prevResult: ISearchResult | undefined = undefined;
    let result = this._find(term, 0, 0, searchOptions);
    while (result && (prevResult?.row !== result.row || prevResult?.col !== result.col)) {
      if (this._searchResultsWithHighlight.length >= this._highlightLimit) {
        break;
      }
      prevResult = result;
      this._searchResultsWithHighlight.push(prevResult);
      result = this._find(
        term,
        prevResult.col + prevResult.term.length >= this._terminal.cols ? prevResult.row + 1 : prevResult.row,
        prevResult.col + prevResult.term.length >= this._terminal.cols ? 0 : prevResult.col + 1,
        searchOptions
      );
    }
    for (const match of this._searchResultsWithHighlight) {
      const decorations = this._createResultDecorations(match, searchOptions.decorations!, false);
      if (decorations) {
        for (const decoration of decorations) {
          this._storeDecoration(decoration, match);
        }
      }
    }
  }

  private _storeDecoration(decoration: IDecoration, match: ISearchResult): void {
    this._highlightedLines.add(decoration.marker.line);
    this._highlightDecorations.push({ decoration, match, dispose() { decoration.dispose(); } });
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

    this._lineCache.value!.initLinesCache();

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

  private _findNextAndSelect(term: string, searchOptions?: ISearchOptions, internalSearchOptions?: IInternalSearchOptions): boolean {
    if (!this._terminal || !term || term.length === 0) {
      this._terminal?.clearSelection();
      this.clearDecorations();
      return false;
    }

    const prevSelectedPos = this._terminal.getSelectionPosition();
    this._terminal.clearSelection();

    let startCol = 0;
    let startRow = 0;
    if (prevSelectedPos) {
      if (this._cachedSearchTerm === term) {
        startCol = prevSelectedPos.end.x;
        startRow = prevSelectedPos.end.y;
      } else {
        startCol = prevSelectedPos.start.x;
        startRow = prevSelectedPos.start.y;
      }
    }

    this._lineCache.value!.initLinesCache();

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
    if (!result && prevSelectedPos) {
      searchPosition.startRow = prevSelectedPos.start.y;
      searchPosition.startCol = 0;
      result = this._findInLine(term, searchPosition, searchOptions);
    }

    // Set selection and scroll if a result was found
    return this._selectResult(result, searchOptions?.decorations, internalSearchOptions?.noScroll);
  }
  /**
   * Find the previous instance of the term, then scroll to and select it. If it
   * doesn't exist, do nothing.
   * @param term The search term.
   * @param searchOptions Search options.
   * @returns Whether a result was found.
   */
  public findPrevious(term: string, searchOptions?: ISearchOptions, internalSearchOptions?: IInternalSearchOptions): boolean {
    if (!this._terminal) {
      throw new Error('Cannot use addon until it has been loaded');
    }
    const didOptionsChanged = this._lastSearchOptions ? this._didOptionsChange(this._lastSearchOptions, searchOptions) : true;
    this._lastSearchOptions = searchOptions;
    if (searchOptions?.decorations) {
      if (this._cachedSearchTerm === undefined || term !== this._cachedSearchTerm || didOptionsChanged) {
        this._highlightAllMatches(term, searchOptions);
      }
    }

    const found = this._findPreviousAndSelect(term, searchOptions, internalSearchOptions);
    this._fireResults(searchOptions);
    this._cachedSearchTerm = term;

    return found;
  }

  private _didOptionsChange(lastSearchOptions: ISearchOptions, searchOptions?: ISearchOptions): boolean {
    if (!searchOptions) {
      return false;
    }
    if (lastSearchOptions.caseSensitive !== searchOptions.caseSensitive) {
      return true;
    }
    if (lastSearchOptions.regex !== searchOptions.regex) {
      return true;
    }
    if (lastSearchOptions.wholeWord !== searchOptions.wholeWord) {
      return true;
    }
    return false;
  }

  private _fireResults(searchOptions?: ISearchOptions): void {
    if (searchOptions?.decorations) {
      let resultIndex = -1;
      if (this._selectedDecoration.value) {
        const selectedMatch = this._selectedDecoration.value.match;
        for (let i = 0; i < this._searchResultsWithHighlight.length; i++) {
          const match = this._searchResultsWithHighlight[i];
          if (match.row === selectedMatch.row && match.col === selectedMatch.col && match.size === selectedMatch.size) {
            resultIndex = i;
            break;
          }
        }
      }
      this._onDidChangeResults.fire({ resultIndex, resultCount: this._searchResultsWithHighlight.length });
    }
  }

  private _findPreviousAndSelect(term: string, searchOptions?: ISearchOptions, internalSearchOptions?: IInternalSearchOptions): boolean {
    if (!this._terminal) {
      throw new Error('Cannot use addon until it has been loaded');
    }
    if (!this._terminal || !term || term.length === 0) {
      this._terminal?.clearSelection();
      this.clearDecorations();
      return false;
    }

    const prevSelectedPos = this._terminal.getSelectionPosition();
    this._terminal.clearSelection();

    let startRow = this._terminal.buffer.active.baseY + this._terminal.rows - 1;
    let startCol = this._terminal.cols;
    const isReverseSearch = true;

    this._lineCache.value!.initLinesCache();
    const searchPosition: ISearchPosition = {
      startRow,
      startCol
    };

    let result: ISearchResult | undefined;
    if (prevSelectedPos) {
      searchPosition.startRow = startRow = prevSelectedPos.start.y;
      searchPosition.startCol = startCol = prevSelectedPos.start.x;
      if (this._cachedSearchTerm !== term) {
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

    // Set selection and scroll if a result was found
    return this._selectResult(result, searchOptions?.decorations, internalSearchOptions?.noScroll);
  }



  /**
   * A found substring is a whole word if it doesn't have an alphanumeric character directly
   * adjacent to it.
   * @param searchIndex starting indext of the potential whole word substring
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
    let cache = this._lineCache.value!.getLineFromCache(row);
    if (!cache) {
      cache = this._lineCache.value!.translateBufferLineToStringWithWrap(row, true);
      this._lineCache.value!.setLineInCache(row, cache);
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
   * Selects and scrolls to a result.
   * @param result The result to select.
   * @returns Whether a result was selected.
   */
  private _selectResult(result: ISearchResult | undefined, options?: ISearchDecorationOptions, noScroll?: boolean): boolean {
    const terminal = this._terminal!;
    this._selectedDecoration.clear();
    if (!result) {
      terminal.clearSelection();
      return false;
    }
    terminal.select(result.col, result.row, result.size);
    if (options) {
      const decorations = this._createResultDecorations(result, options, true);
      if (decorations) {
        this._selectedDecoration.value = { decorations, match: result, dispose() { dispose(decorations); } };
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
   * Applies styles to the decoration when it is rendered.
   * @param element The decoration's element.
   * @param borderColor The border color to apply.
   * @param isActiveResult Whether the element is part of the active search result.
   * @returns
   */
  private _applyStyles(element: HTMLElement, borderColor: string | undefined, isActiveResult: boolean): void {
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
  private _createResultDecorations(result: ISearchResult, options: ISearchDecorationOptions, isActiveResult: boolean): IDecoration[] | undefined {
    const terminal = this._terminal!;

    // Gather decoration ranges for this match as it could wrap
    const decorationRanges: [number, number, number][] = [];
    let currentCol = result.col;
    let remainingSize = result.size;
    let markerOffset = -terminal.buffer.active.baseY - terminal.buffer.active.cursorY + result.row;
    while (remainingSize > 0) {
      const amountThisRow = Math.min(terminal.cols - currentCol, remainingSize);
      decorationRanges.push([markerOffset, currentCol, amountThisRow]);
      currentCol = 0;
      remainingSize -= amountThisRow;
      markerOffset++;
    }

    // Create the decorations
    const decorations: IDecoration[] = [];
    for (const range of decorationRanges) {
      const marker = terminal.registerMarker(range[0]);
      const decoration = terminal.registerDecoration({
        marker,
        x: range[1],
        width: range[2],
        backgroundColor: isActiveResult ? options.activeMatchBackground : options.matchBackground,
        overviewRulerOptions: this._highlightedLines.has(marker.line) ? undefined : {
          color: isActiveResult ? options.activeMatchColorOverviewRuler : options.matchOverviewRuler,
          position: 'center'
        }
      });
      if (decoration) {
        const disposables: IDisposable[] = [];
        disposables.push(marker);
        disposables.push(decoration.onRender((e) => this._applyStyles(e, isActiveResult ? options.activeMatchBorder : options.matchBorder, false)));
        disposables.push(decoration.onDispose(() => dispose(disposables)));
        decorations.push(decoration);
      }
    }

    return decorations.length === 0 ? undefined : decorations;
  }
}
