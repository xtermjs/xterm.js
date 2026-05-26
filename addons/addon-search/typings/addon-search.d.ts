/**
 * Copyright (c) 2017 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import { Terminal, ITerminalAddon, IEvent } from '@xterm/xterm';

declare module '@xterm/addon-search' {
  /**
   * Options for a search.
   */
  export interface ISearchOptions {
    /**
     * Whether the search term is a regex.
     */
    regex?: boolean;

    /**
     * Whether to search for a whole word, the result is only valid if it's
     * surrounded in "non-word" characters such as `_`, `(`, `)` or space.
     */
    wholeWord?: boolean;

    /**
     * Whether the search is case sensitive.
     */
    caseSensitive?: boolean;

    /**
     * Whether to do an incremental search, this will expand the selection if it
     * still matches the term the user typed.
     */
    incremental?: boolean;

    /**
     * When set, will highlight all instances of the word on search and show
     * them in the overview ruler if it's enabled.
     */
    decorations?: ISearchDecorationOptions;
  }

  /**
   * Options for showing decorations when searching.
   */
  interface ISearchDecorationOptions {
    /**
     * The background color of a match, this must use #RRGGBB format.
     */
    matchBackground?: string;

    /**
     * The border color of a match.
     */
    matchBorder?: string;

    /**
     * The overview ruler color of a match.
     */
    matchOverviewRuler?: string;

    /**
     * The background color for the currently active match, this must use #RRGGBB format.
     */
    activeMatchBackground?: string;

    /**
     * The border color of the currently active match.
     */
    activeMatchBorder?: string;

    /**
     * The overview ruler color of the currently active match.
     */
    activeMatchColorOverviewRuler?: string;
  }

  /**
   * Event data fired when search results change.
   */
  export interface ISearchResultChangeEvent {
    /**
     * The index of the currently active result within tracked highlights, or -1 when
     * the active match is not in the tracked result set.
     */
    resultIndex: number;

    /**
     * The number of tracked search results (capped by `highlightLimit` when decorations are enabled).
     */
    resultCount: number;
  }

  /**
   * Options for the search addon.
   */
  export interface ISearchAddonOptions {
    /**
     * Max number of matches highlighted when decorations are enabled.
     * Defaults to 1000. Invalid values fall back to the default.
     */
    highlightLimit?: number;
  }

  /**
   * An xterm.js addon that provides search functionality.
   */
  export class SearchAddon implements ITerminalAddon {

    /**
     * Creates a new search addon.
     * @param options Options for the search addon.
     */
    constructor(options?: Partial<ISearchAddonOptions>);

    /**
     * Activates the addon
     * @param terminal The terminal the addon is being loaded in.
     */
    public activate(terminal: Terminal): void;

    /**
     * Disposes the addon.
     */
    public dispose(): void;

    /**
     * Search forwards for the next result that matches the search term and
     * options.
     * @param term The search term.
     * @param searchOptions The options for the search.
     */
    public findNext(term: string, searchOptions?: ISearchOptions): boolean;

    /**
     * Search backwards for the previous result that matches the search term and
     * options.
     * @param term The search term.
     * @param searchOptions The options for the search.
     */
    public findPrevious(term: string, searchOptions?: ISearchOptions): boolean;

    /**
     * Clears highlight decorations and tracked results.
     */
    public clearDecorations(): void;

    /**
     * Clears the active result decoration, this decoration is applied on top of the selection so
     * removing it will reveal the selection underneath. This is intended to be called on the search
     * textarea's `blur` event.
     */
    public clearActiveDecoration(): void;

    /**
     * Fires after a search is performed.
     */
    readonly onAfterSearch: IEvent<void>;

    /**
     * Fires before a search is performed.
     */
    readonly onBeforeSearch: IEvent<void>;

    /**
     * When decorations are enabled, fires when the search results change.
     */
    readonly onDidChangeResults: IEvent<ISearchResultChangeEvent>;
  }
}
