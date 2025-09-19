/**
 * Copyright (c) 2017 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import type { ISearchResultChangeEvent } from '@xterm/addon-search';
import type { IDisposable } from '@xterm/xterm';
import { Emitter, Event } from 'vs/base/common/event';
import { Disposable } from 'vs/base/common/lifecycle';
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
  private _selectedDecoration: ISelectedDecoration | undefined;

  private readonly _onDidChangeResults = this._register(new Emitter<ISearchResultChangeEvent>());
  public get onDidChangeResults(): Event<ISearchResultChangeEvent> { return this._onDidChangeResults.event; }

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
    return this._selectedDecoration;
  }

  /**
   * Sets the currently selected decoration.
   */
  public set selectedDecoration(decoration: ISelectedDecoration | undefined) {
    this._selectedDecoration = decoration;
  }

  /**
   * Updates the search results with a new set of results.
   * @param results The new search results.
   * @param maxResults The maximum number of results to track.
   */
  public updateResults(results: ISearchResult[], maxResults: number): void {
    this._searchResults = results.slice(0, maxResults);
  }

  /**
   * Clears all search results.
   */
  public clearResults(): void {
    this._searchResults = [];
  }

  /**
   * Clears the selected decoration.
   */
  public clearSelectedDecoration(): void {
    if (this._selectedDecoration) {
      this._selectedDecoration.dispose();
      this._selectedDecoration = undefined;
    }
  }

  /**
   * Finds the index of a result in the current results array.
   * @param result The result to find.
   * @returns The index of the result, or -1 if not found.
   */
  public findResultIndex(result: ISearchResult): number {
    for (let i = 0; i < this._searchResults.length; i++) {
      const match = this._searchResults[i];
      if (match.row === result.row && match.col === result.col && match.size === result.size) {
        return i;
      }
    }
    return -1;
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
    if (this._selectedDecoration) {
      resultIndex = this.findResultIndex(this._selectedDecoration.match);
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
