/**
 * Copyright (c) 2017 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import type { Terminal, IDisposable, ITerminalAddon } from '@xterm/xterm';
import type { SearchAddon as ISearchApi, ISearchOptions, ISearchAddonOptions, ISearchResultChangeEvent } from '@xterm/addon-search';
import { Emitter, Event } from 'vs/base/common/event';
import { Disposable, MutableDisposable, toDisposable } from 'vs/base/common/lifecycle';
import { disposableTimeout } from 'vs/base/common/async';
import { SearchLineCache } from './SearchLineCache';
import { SearchState } from './SearchState';
import { SearchEngine, type ISearchResult } from './SearchEngine';
import { DecorationManager } from './DecorationManager';
import { SearchResultTracker } from './SearchResultTracker';

interface IInternalSearchOptions {
  noScroll: boolean;
}

/**
 * Configuration constants for the search addon functionality.
 */
const enum Constants {
  /**
   * Default maximum number of search results to highlight simultaneously. This limit prevents
   * performance degradation when searching for very common terms that would result in excessive
   * highlighting decorations.
   */
  DEFAULT_HIGHLIGHT_LIMIT = 1000
}

export class SearchAddon extends Disposable implements ITerminalAddon, ISearchApi {
  private _terminal: Terminal | undefined;
  private _highlightLimit: number;
  private _highlightTimeout = this._register(new MutableDisposable<IDisposable>());
  private _lineCache = this._register(new MutableDisposable<SearchLineCache>());

  // Component instances
  private _state = new SearchState();
  private _engine: SearchEngine | undefined;
  private _decorationManager: DecorationManager | undefined;
  private _resultTracker = this._register(new SearchResultTracker());

  private readonly _onAfterSearch = this._register(new Emitter<void>());
  public readonly onAfterSearch = this._onAfterSearch.event;
  private readonly _onBeforeSearch = this._register(new Emitter<void>());
  public readonly onBeforeSearch = this._onBeforeSearch.event;

  public get onDidChangeResults(): Event<ISearchResultChangeEvent> {
    return this._resultTracker.onDidChangeResults;
  }

  constructor(options?: Partial<ISearchAddonOptions>) {
    super();

    this._highlightLimit = options?.highlightLimit ?? Constants.DEFAULT_HIGHLIGHT_LIMIT;
  }

  public activate(terminal: Terminal): void {
    this._terminal = terminal;
    this._lineCache.value = new SearchLineCache(terminal);
    this._engine = new SearchEngine(terminal, this._lineCache.value);
    this._decorationManager = new DecorationManager(terminal);
    this._register(this._terminal.onWriteParsed(() => this._updateMatches()));
    this._register(this._terminal.onResize(() => this._updateMatches()));
    this._register(toDisposable(() => this.clearDecorations()));
  }

  private _updateMatches(): void {
    this._highlightTimeout.clear();
    if (this._state.cachedSearchTerm && this._state.lastSearchOptions?.decorations) {
      this._highlightTimeout.value = disposableTimeout(() => {
        const term = this._state.cachedSearchTerm;
        this._state.clearCachedTerm();
        this.findPrevious(term!, { ...this._state.lastSearchOptions, incremental: true }, { noScroll: true });
      }, 200);
    }
  }

  public clearDecorations(retainCachedSearchTerm?: boolean): void {
    this._resultTracker.clearSelectedDecoration();
    this._decorationManager?.clearHighlightDecorations();
    this._resultTracker.clearResults();
    if (!retainCachedSearchTerm) {
      this._state.clearCachedTerm();
    }
  }

  public clearActiveDecoration(): void {
    this._resultTracker.clearSelectedDecoration();
  }

  /**
   * Find the next instance of the term, then scroll to and select it. If it
   * doesn't exist, do nothing.
   * @param term The search term.
   * @param searchOptions Search options.
   * @returns Whether a result was found.
   */
  public findNext(term: string, searchOptions?: ISearchOptions, internalSearchOptions?: IInternalSearchOptions): boolean {
    if (!this._terminal || !this._engine) {
      throw new Error('Cannot use addon until it has been loaded');
    }

    this._onBeforeSearch.fire();

    this._state.lastSearchOptions = searchOptions;

    if (this._state.shouldUpdateHighlighting(term, searchOptions)) {
      this._highlightAllMatches(term, searchOptions!);
    }

    const found = this._findNextAndSelect(term, searchOptions, internalSearchOptions);
    this._fireResults(searchOptions);
    this._state.cachedSearchTerm = term;

    this._onAfterSearch.fire();

    return found;
  }

  private _highlightAllMatches(term: string, searchOptions: ISearchOptions): void {
    if (!this._terminal || !this._engine || !this._decorationManager) {
      throw new Error('Cannot use addon until it has been loaded');
    }
    if (!this._state.isValidSearchTerm(term)) {
      this.clearDecorations();
      return;
    }

    // new search, clear out the old decorations
    this.clearDecorations(true);

    const results: ISearchResult[] = [];
    let prevResult: ISearchResult | undefined = undefined;
    let result = this._engine.find(term, 0, 0, searchOptions);

    while (result && (prevResult?.row !== result.row || prevResult?.col !== result.col)) {
      if (results.length >= this._highlightLimit) {
        break;
      }
      prevResult = result;
      results.push(prevResult);
      result = this._engine.find(
        term,
        prevResult.col + prevResult.term.length >= this._terminal.cols ? prevResult.row + 1 : prevResult.row,
        prevResult.col + prevResult.term.length >= this._terminal.cols ? 0 : prevResult.col + 1,
        searchOptions
      );
    }

    this._resultTracker.updateResults(results, this._highlightLimit);
    if (searchOptions.decorations) {
      this._decorationManager.createHighlightDecorations(results, searchOptions.decorations);
    }
  }

  private _findNextAndSelect(term: string, searchOptions?: ISearchOptions, internalSearchOptions?: IInternalSearchOptions): boolean {
    if (!this._terminal || !this._engine) {
      return false;
    }
    if (!this._state.isValidSearchTerm(term)) {
      this._terminal.clearSelection();
      this.clearDecorations();
      return false;
    }

    const result = this._engine.findNextWithSelection(term, searchOptions, this._state.cachedSearchTerm);
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
    if (!this._terminal || !this._engine) {
      throw new Error('Cannot use addon until it has been loaded');
    }

    this._onBeforeSearch.fire();

    this._state.lastSearchOptions = searchOptions;

    if (this._state.shouldUpdateHighlighting(term, searchOptions)) {
      this._highlightAllMatches(term, searchOptions!);
    }

    const found = this._findPreviousAndSelect(term, searchOptions, internalSearchOptions);
    this._fireResults(searchOptions);
    this._state.cachedSearchTerm = term;

    this._onAfterSearch.fire();

    return found;
  }

  private _fireResults(searchOptions?: ISearchOptions): void {
    this._resultTracker.fireResultsChanged(!!searchOptions?.decorations);
  }

  private _findPreviousAndSelect(term: string, searchOptions?: ISearchOptions, internalSearchOptions?: IInternalSearchOptions): boolean {
    if (!this._terminal || !this._engine) {
      return false;
    }
    if (!this._state.isValidSearchTerm(term)) {
      this._terminal.clearSelection();
      this.clearDecorations();
      return false;
    }

    const result = this._engine.findPreviousWithSelection(term, searchOptions, this._state.cachedSearchTerm);
    return this._selectResult(result, searchOptions?.decorations, internalSearchOptions?.noScroll);
  }

  /**
   * Selects and scrolls to a result.
   * @param result The result to select.
   * @returns Whether a result was selected.
   */
  private _selectResult(result: ISearchResult | undefined, options?: any, noScroll?: boolean): boolean {
    if (!this._terminal || !this._decorationManager) {
      return false;
    }

    this._resultTracker.clearSelectedDecoration();
    if (!result) {
      this._terminal.clearSelection();
      return false;
    }

    this._terminal.select(result.col, result.row, result.size);
    if (options) {
      const activeDecoration = this._decorationManager.createActiveDecoration(result, options);
      if (activeDecoration) {
        this._resultTracker.selectedDecoration = activeDecoration;
      }
    }

    if (!noScroll) {
      // If it is not in the viewport then we scroll else it just gets selected
      if (result.row >= (this._terminal.buffer.active.viewportY + this._terminal.rows) || result.row < this._terminal.buffer.active.viewportY) {
        let scroll = result.row - this._terminal.buffer.active.viewportY;
        scroll -= Math.floor(this._terminal.rows / 2);
        this._terminal.scrollLines(scroll);
      }
    }
    return true;
  }
}
