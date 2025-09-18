/**
 * Copyright (c) 2017 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import type { ISearchOptions } from '@xterm/addon-search';

/**
 * Manages search state including cached search terms, options tracking, and validation.
 * This class provides a centralized way to handle search state consistency and option changes.
 */
export class SearchState {
  private _cachedSearchTerm: string | undefined;
  private _lastSearchOptions: ISearchOptions | undefined;

  /**
   * Gets the currently cached search term.
   */
  public get cachedSearchTerm(): string | undefined {
    return this._cachedSearchTerm;
  }

  /**
   * Sets the cached search term.
   */
  public set cachedSearchTerm(term: string | undefined) {
    this._cachedSearchTerm = term;
  }

  /**
   * Gets the last search options used.
   */
  public get lastSearchOptions(): ISearchOptions | undefined {
    return this._lastSearchOptions;
  }

  /**
   * Sets the last search options used.
   */
  public set lastSearchOptions(options: ISearchOptions | undefined) {
    this._lastSearchOptions = options;
  }

  /**
   * Validates a search term to ensure it's not empty or invalid.
   * @param term The search term to validate.
   * @returns true if the term is valid for searching.
   */
  public isValidSearchTerm(term: string): boolean {
    return !!(term && term.length > 0);
  }

  /**
   * Determines if search options have changed compared to the last search.
   * @param newOptions The new search options to compare.
   * @returns true if the options have changed.
   */
  public didOptionsChange(newOptions?: ISearchOptions): boolean {
    if (!this._lastSearchOptions) {
      return true;
    }
    if (!newOptions) {
      return false;
    }
    if (this._lastSearchOptions.caseSensitive !== newOptions.caseSensitive) {
      return true;
    }
    if (this._lastSearchOptions.regex !== newOptions.regex) {
      return true;
    }
    if (this._lastSearchOptions.wholeWord !== newOptions.wholeWord) {
      return true;
    }
    return false;
  }

  /**
   * Determines if a new search should trigger highlighting updates.
   * @param term The search term.
   * @param options The search options.
   * @returns true if highlighting should be updated.
   */
  public shouldUpdateHighlighting(term: string, options?: ISearchOptions): boolean {
    if (!options?.decorations) {
      return false;
    }
    return this._cachedSearchTerm === undefined ||
           term !== this._cachedSearchTerm ||
           this.didOptionsChange(options);
  }

  /**
   * Clears the cached search term.
   */
  public clearCachedTerm(): void {
    this._cachedSearchTerm = undefined;
  }

  /**
   * Resets all state.
   */
  public reset(): void {
    this._cachedSearchTerm = undefined;
    this._lastSearchOptions = undefined;
  }
}
