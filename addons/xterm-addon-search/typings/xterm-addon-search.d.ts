/**
 * Copyright (c) 2017 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import { Terminal, ILinkMatcherOptions, IDisposable, ITerminalAddon } from 'xterm';

declare module 'xterm-addon-search' {
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
     * still matches the term the user typed. Note that this only affects
     * `findNext`, not `findPrevious`.
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
     * The background color of a match.
     */
    matchBackground?: string;

    /**
     * The border color of a match
     */
    matchBorder?: string;

    /**
     * The overview ruler color of a match.
     */
    matchOverviewRuler: string;

    /**
     * The background color for the currently selected match.
     */
    selectedBackground?: string;

    /**
     * The border color of the currently selected match.
     */
    selectedBorder?: string;

    /**
     * The overview ruler color of the currently selected match.
     */
    selectedColorOverviewRuler: string;
  }

  /**
   * An xterm.js addon that provides search functionality.
   */
  export class SearchAddon implements ITerminalAddon {
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
     * Clears the decorations and selection
     */
    public clearDecorations(): void;
  }
}
