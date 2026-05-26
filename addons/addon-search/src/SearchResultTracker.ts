/**
 * Copyright (c) 2017 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import type { ISearchResultChangeEvent } from '@xterm/addon-search';
import type { IDisposable } from '@xterm/xterm';
import { Emitter, type IEvent } from 'common/Event';
import { Disposable, MutableDisposable } from 'common/Lifecycle';
import type { ISearchResult } from './SearchEngine';

/**
 * Interface for managing a currently selected decoration.
 */
interface ISelectedDecoration extends IDisposable {
  match: ISearchResult;
}

/**
 * Tracks search results, manages result indexing, and fires events when results change.
 * This class provides centralized management of search result state and notifications.
 */
export class SearchResultTracker extends Disposable {
  private _searchResults: ISearchResult[] = [];
  private _resultIndexByKey = new Map<string, number>();
  private _selectedDecoration = this._register(new MutableDisposable<ISelectedDecoration>());

  private readonly _onDidChangeResults = this._register(new Emitter<ISearchResultChangeEvent>());
  public get onDidChangeResults(): IEvent<ISearchResultChangeEvent> { return this._onDidChangeResults.event; }

  /**
   * Gets the current search results.
   */
  public get searchResults(): ReadonlyArray<ISearchResult> {
    return this._searchResults;
  }

  /**
   * Gets the currently selected decoration.
   */
  public get selectedDecoration(): ISelectedDecoration | undefined {
    return this._selectedDecoration.value;
  }

  /**
   * Sets the currently selected decoration.
   */
  public set selectedDecoration(decoration: ISelectedDecoration | undefined) {
    this._selectedDecoration.value = decoration;
  }

  private _resultKey(result: ISearchResult): string {
    return `${result.row}:${result.col}:${result.size}`;
  }

  private _rebuildResultIndex(): void {
    this._resultIndexByKey.clear();
    for (let i = 0; i < this._searchResults.length; i++) {
      this._resultIndexByKey.set(this._resultKey(this._searchResults[i]), i);
    }
  }

  /**
   * Updates the search results with a new set of results.
   * @param results The new search results.
   * @param maxResults The maximum number of results to track.
   */
  public updateResults(results: ISearchResult[], maxResults: number): void {
    this._searchResults = results.length <= maxResults ? results : results.slice(0, maxResults);
    this._rebuildResultIndex();
  }

  /**
   * Clears all search results.
   */
  public clearResults(): void {
    this._searchResults = [];
    this._resultIndexByKey.clear();
  }

  /**
   * Clears the selected decoration.
   */
  public clearSelectedDecoration(): void {
    this._selectedDecoration.clear();
  }

  /**
   * Finds the index of a result in the current results array.
   * @param result The result to find.
   * @returns The index of the result, or -1 if not found.
   */
  public findResultIndex(result: ISearchResult): number {
    return this._resultIndexByKey.get(this._resultKey(result)) ?? -1;
  }

  /**
   * Fires a result change event with the current state.
   * @param hasDecorations Whether decorations are enabled.
   */
  public fireResultsChanged(hasDecorations: boolean): void {
    if (!hasDecorations) {
      return;
    }

    let resultIndex = -1;
    if (this._selectedDecoration.value) {
      resultIndex = this.findResultIndex(this._selectedDecoration.value.match);
    }

    this._onDidChangeResults.fire({
      resultIndex,
      resultCount: this._searchResults.length
    });
  }

  /**
   * Resets all state.
   */
  public reset(): void {
    this.clearSelectedDecoration();
    this.clearResults();
  }
}
