/**
 * Copyright (c) 2017 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import type { Terminal, IDisposable, IDecoration } from '@xterm/xterm';
import type { ISearchDecorationOptions } from '@xterm/addon-search';
import { dispose, Disposable, toDisposable } from 'vs/base/common/lifecycle';
import type { ISearchResult } from './SearchEngine';

/**
 * Interface for managing a highlight decoration.
 */
interface IHighlight extends IDisposable {
  decoration: IDecoration;
  match: ISearchResult;
}

/**
 * Interface for managing multiple decorations for a single match.
 */
interface IMultiHighlight extends IDisposable {
  decorations: IDecoration[];
  match: ISearchResult;
}

/**
 * Manages visual decorations for search results including highlighting and active selection
 * indicators. This class handles the creation, styling, and disposal of search-related decorations.
 */
export class DecorationManager extends Disposable {
  private _highlightDecorations: IHighlight[] = [];
  private _highlightedLines: Set<number> = new Set();

  constructor(private readonly _terminal: Terminal) {
    super();
    this._register(toDisposable(() => this.clearHighlightDecorations()));
  }

  /**
   * Creates decorations for all provided search results.
   * @param results The search results to create decorations for.
   * @param options The decoration options.
   */
  public createHighlightDecorations(results: ISearchResult[], options: ISearchDecorationOptions): void {
    this.clearHighlightDecorations();

    for (const match of results) {
      const decorations = this._createResultDecorations(match, options, false);
      if (decorations) {
        for (const decoration of decorations) {
          this._storeDecoration(decoration, match);
        }
      }
    }
  }

  /**
   * Creates decorations for the currently active search result.
   * @param result The active search result.
   * @param options The decoration options.
   * @returns The multi-highlight decoration or undefined if creation failed.
   */
  public createActiveDecoration(result: ISearchResult, options: ISearchDecorationOptions): IMultiHighlight | undefined {
    const decorations = this._createResultDecorations(result, options, true);
    if (decorations) {
      return { decorations, match: result, dispose() { dispose(decorations); } };
    }
    return undefined;
  }

  /**
   * Clears all highlight decorations.
   */
  public clearHighlightDecorations(): void {
    dispose(this._highlightDecorations);
    this._highlightDecorations = [];
    this._highlightedLines.clear();
  }

  /**
   * Stores a decoration and tracks it for management.
   * @param decoration The decoration to store.
   * @param match The search result this decoration represents.
   */
  private _storeDecoration(decoration: IDecoration, match: ISearchResult): void {
    this._highlightedLines.add(decoration.marker.line);
    this._highlightDecorations.push({ decoration, match, dispose() { decoration.dispose(); } });
  }

  /**
   * Applies styles to the decoration when it is rendered.
   * @param element The decoration's element.
   * @param borderColor The border color to apply.
   * @param isActiveResult Whether the element is part of the active search result.
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
   * @param isActiveResult whether this is the currently active result
   * @returns the decorations or undefined if the marker has already been disposed of
   */
  private _createResultDecorations(result: ISearchResult, options: ISearchDecorationOptions, isActiveResult: boolean): IDecoration[] | undefined {
    // Gather decoration ranges for this match as it could wrap
    const decorationRanges: [number, number, number][] = [];
    let currentCol = result.col;
    let remainingSize = result.size;
    let markerOffset = -this._terminal.buffer.active.baseY - this._terminal.buffer.active.cursorY + result.row;
    while (remainingSize > 0) {
      const amountThisRow = Math.min(this._terminal.cols - currentCol, remainingSize);
      decorationRanges.push([markerOffset, currentCol, amountThisRow]);
      currentCol = 0;
      remainingSize -= amountThisRow;
      markerOffset++;
    }

    // Create the decorations
    const decorations: IDecoration[] = [];
    for (const range of decorationRanges) {
      const marker = this._terminal.registerMarker(range[0]);
      const decoration = this._terminal.registerDecoration({
        marker,
        x: range[1],
        width: range[2],
        layer: isActiveResult ? 'top' : 'bottom',
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


