/**
 * Copyright (c) 2017 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import type { Terminal, IDisposable, ITerminalAddon } from '@xterm/xterm';
import type { SearchAddon as ISearchApi, ISearchOptions, ISearchAddonOptions, ISearchResultChangeEvent, ISearchDecorationOptions } from '@xterm/addon-search';
import { Emitter, type IEvent } from 'common/Event';
import { Disposable, MutableDisposable, toDisposable } from 'common/Lifecycle';

export class SearchAddon extends Disposable implements ITerminalAddon, ISearchApi {
  private static readonly _defaultHighlightLimit = 1000;

  private _terminal: Terminal | undefined;

  private readonly _onBeforeSearch = this._register(new Emitter<void>());
  public readonly onBeforeSearch: IEvent<void> = this._onBeforeSearch.event;

  private readonly _onAfterSearch = this._register(new Emitter<void>());
  public readonly onAfterSearch: IEvent<void> = this._onAfterSearch.event;

  private readonly _onDidChangeResults = this._register(new Emitter<ISearchResultChangeEvent>());
  public readonly onDidChangeResults: IEvent<ISearchResultChangeEvent> = this._onDidChangeResults.event;

  private readonly _resultsUpdateListener = this._register(new MutableDisposable<IDisposable>());

  private readonly _matchDecorations: IDisposable[] = [];
  private readonly _activeDecoration = this._register(new MutableDisposable<IDisposable>());

  private _highlightLimit = SearchAddon._defaultHighlightLimit;
  private _lastSearchTerm: string | undefined;
  private _lastSearchOptions: ISearchOptions | undefined;
  private _lastDirection: 'next' | 'previous' = 'next';
  private _lastSearchKey: string | undefined;
  private _resultCount = 0;
  private _resultIndex = -1;

  constructor(options?: Partial<ISearchAddonOptions>) {
    super();
    if (typeof options?.highlightLimit === 'number' && Number.isFinite(options.highlightLimit) && options.highlightLimit > 0) {
      this._highlightLimit = Math.floor(options.highlightLimit);
    }
  }

  public activate(terminal: Terminal): void {
    this._terminal = terminal;
  }

  public findNext(term: string, searchOptions?: ISearchOptions): boolean {
    return this._find(term, searchOptions, 'next');
  }

  public findPrevious(term: string, searchOptions?: ISearchOptions): boolean {
    return this._find(term, searchOptions, 'previous');
  }

  public clearDecorations(): void {
    this._disposeDecorations();
    this._resultsUpdateListener.clear();
    this._resultCount = 0;
    this._resultIndex = -1;
  }

  public clearActiveDecoration(): void {
    this._activeDecoration.clear();
  }

  private _find(term: string, searchOptions: ISearchOptions | undefined, direction: 'next' | 'previous'): boolean {
    this._onBeforeSearch.fire();
    try {
      const terminal = this._terminal;
      if (!terminal || term.length === 0) {
        this._clearStateOnFailedSearch(term, searchOptions, direction);
        return false;
      }

      const matches = this._findAllMatches(term, searchOptions);
      if (matches === undefined || matches.length === 0) {
        this._clearStateOnFailedSearch(term, searchOptions, direction);
        return false;
      }

      const nextIndex = this._resolveResultIndex(matches, term, searchOptions, direction);
      const activeMatch = matches[nextIndex];
      terminal.select(activeMatch.startX, activeMatch.startY, activeMatch.cellLength);
      terminal.scrollToLine(activeMatch.startY);

      if (searchOptions?.decorations) {
        this._resultCount = matches.length;
        this._resultIndex = nextIndex < this._resultCount ? nextIndex : -1;
        this._lastSearchTerm = term;
        this._lastSearchOptions = searchOptions;
        this._lastDirection = direction;
        this._lastSearchKey = this._createSearchKey(term, searchOptions, direction);
        this._registerResultRefreshListener();
        this._refreshDecorations(matches, searchOptions.decorations, activeMatch);
        this._onDidChangeResults.fire({ resultCount: this._resultCount, resultIndex: this._resultIndex });
      } else {
        this._disposeDecorations();
        this._resultsUpdateListener.clear();
        this._resultCount = 0;
        this._resultIndex = -1;
        this._lastSearchTerm = undefined;
        this._lastSearchOptions = undefined;
        this._lastSearchKey = undefined;
      }

      return true;
    } finally {
      this._onAfterSearch.fire();
    }
  }

  private _clearStateOnFailedSearch(term: string, searchOptions: ISearchOptions | undefined, direction: 'next' | 'previous'): void {
    if (searchOptions?.decorations) {
      this._lastSearchTerm = term;
      this._lastSearchOptions = searchOptions;
      this._lastDirection = direction;
      this._lastSearchKey = this._createSearchKey(term, searchOptions, direction);
      this._registerResultRefreshListener();
      this._disposeDecorations();
      this._resultCount = 0;
      this._resultIndex = -1;
      this._onDidChangeResults.fire({ resultCount: 0, resultIndex: -1 });
      return;
    }
    this._disposeDecorations();
    this._resultsUpdateListener.clear();
    this._resultCount = 0;
    this._resultIndex = -1;
    this._lastSearchTerm = undefined;
    this._lastSearchOptions = undefined;
    this._lastSearchKey = undefined;
  }

  private _registerResultRefreshListener(): void {
    if (this._resultsUpdateListener.value) {
      return;
    }
    const terminal = this._terminal;
    if (!terminal) {
      return;
    }
    this._resultsUpdateListener.value = terminal.onWriteParsed(() => {
      this._refreshResultsAfterBufferChange();
    });
  }

  private _refreshResultsAfterBufferChange(): void {
    const terminal = this._terminal;
    if (!terminal || !this._lastSearchTerm || !this._lastSearchOptions?.decorations) {
      return;
    }
    const matches = this._findAllMatches(this._lastSearchTerm, this._lastSearchOptions);
    if (!matches || matches.length === 0) {
      this._disposeDecorations();
      this._resultCount = 0;
      this._resultIndex = -1;
      this._onDidChangeResults.fire({ resultCount: 0, resultIndex: -1 });
      return;
    }

    this._resultCount = matches.length;
    this._resultIndex = this._findIndexFromSelection(matches);
    const activeMatch = this._resultIndex === -1 ? undefined : matches[this._resultIndex];
    this._refreshDecorations(matches, this._lastSearchOptions.decorations, activeMatch);
    this._onDidChangeResults.fire({ resultCount: this._resultCount, resultIndex: this._resultIndex });
  }

  private _findAllMatches(term: string, searchOptions?: ISearchOptions): IMatch[] | undefined {
    const terminal = this._terminal;
    if (!terminal) {
      return undefined;
    }
    const regex = this._buildRegex(term, searchOptions);
    if (!regex) {
      return undefined;
    }
    const matches: IMatch[] = [];
    const buffer = terminal.buffer.active;
    const cols = terminal.cols;

    for (let row = 0; row < buffer.length; row++) {
      const firstLine = buffer.getLine(row);
      if (!firstLine || firstLine.isWrapped) {
        continue;
      }

      const lineRows: number[] = [row];
      let nextRow = row + 1;
      while (nextRow < buffer.length) {
        const wrappedLine = buffer.getLine(nextRow);
        if (!wrappedLine?.isWrapped) {
          break;
        }
        lineRows.push(nextRow);
        nextRow++;
      }

      const logicalLine = this._buildLogicalLine(lineRows, cols);
      regex.lastIndex = 0;
      while (true) {
        const match = regex.exec(logicalLine.text);
        if (!match) {
          break;
        }
        if (match[0].length === 0) {
          regex.lastIndex++;
          continue;
        }
        const startOffset = match.index;
        const endOffset = startOffset + match[0].length;
        if (!this._isWholeWordMatch(logicalLine.text, startOffset, endOffset, searchOptions)) {
          continue;
        }
        const start = logicalLine.offsetToPoint[startOffset];
        const end = logicalLine.offsetToPoint[endOffset];
        const startLinear = logicalLine.offsetToLinear[startOffset];
        const endLinear = logicalLine.offsetToLinear[endOffset];
        matches.push({
          startX: start.x,
          startY: start.y,
          endX: end.x,
          endY: end.y,
          cellLength: Math.max(1, endLinear - startLinear)
        });
        if (matches.length >= this._highlightLimit) {
          return matches;
        }
      }

      row = lineRows[lineRows.length - 1];
    }

    return matches;
  }

  private _buildRegex(term: string, searchOptions?: ISearchOptions): RegExp | undefined {
    const flags = searchOptions?.caseSensitive ? 'g' : 'gi';
    if (searchOptions?.regex) {
      try {
        return new RegExp(term, flags);
      } catch {
        return undefined;
      }
    }
    return new RegExp(escapeRegExp(term), flags);
  }

  private _buildLogicalLine(rows: number[], cols: number): ILogicalLine {
    const terminal = this._terminal;
    if (!terminal) {
      return {
        text: '',
        offsetToPoint: [{ x: 0, y: rows[0] ?? 0 }],
        offsetToLinear: [0]
      };
    }

    const textParts: string[] = [];
    const offsetToPoint: IPoint[] = [];
    const offsetToLinear: number[] = [];
    let currentOffset = 0;
    let linearOffset = 0;
    offsetToPoint[0] = this._linearToPoint(rows, cols, 0);
    offsetToLinear[0] = 0;

    const cell = terminal.buffer.active.getNullCell();
    for (const row of rows) {
      const line = terminal.buffer.active.getLine(row);
      for (let x = 0; x < cols; x++) {
        const loadedCell = line?.getCell(x, cell);
        const width = loadedCell ? loadedCell.getWidth() : 1;
        if (width === 0) {
          continue;
        }
        const chars = loadedCell?.getChars() || ' ';
        textParts.push(chars);
        const codeUnitCount = chars.length;
        for (let i = 1; i < codeUnitCount; i++) {
          offsetToPoint[currentOffset + i] = this._linearToPoint(rows, cols, linearOffset);
          offsetToLinear[currentOffset + i] = linearOffset;
        }
        currentOffset += codeUnitCount;
        linearOffset += Math.max(1, width);
        offsetToPoint[currentOffset] = this._linearToPoint(rows, cols, linearOffset);
        offsetToLinear[currentOffset] = linearOffset;
      }
    }

    return {
      text: textParts.join(''),
      offsetToPoint,
      offsetToLinear
    };
  }

  private _linearToPoint(rows: number[], cols: number, linear: number): IPoint {
    if (rows.length === 0) {
      return { x: 0, y: 0 };
    }
    const rowOffset = Math.floor(linear / cols);
    const col = linear % cols;
    if (rowOffset >= rows.length) {
      return { x: cols, y: rows[rows.length - 1] };
    }
    return { x: col, y: rows[rowOffset] };
  }

  private _isWholeWordMatch(text: string, startOffset: number, endOffset: number, searchOptions: ISearchOptions | undefined): boolean {
    if (!searchOptions?.wholeWord) {
      return true;
    }
    const left = startOffset === 0 ? '' : text[startOffset - 1];
    const right = endOffset >= text.length ? '' : text[endOffset];
    return !isWordChar(left) && !isWordChar(right);
  }

  private _resolveResultIndex(matches: IMatch[], term: string, searchOptions: ISearchOptions | undefined, direction: 'next' | 'previous'): number {
    const currentSelectionIndex = this._findIndexFromSelection(matches);
    const currentSearchKey = this._createSearchKey(term, searchOptions, direction);
    const isIncrementalUpdate = !!searchOptions?.incremental && this._lastSearchKey !== undefined && this._lastSearchKey !== currentSearchKey;

    if (isIncrementalUpdate && currentSelectionIndex !== -1) {
      return currentSelectionIndex;
    }

    if (currentSelectionIndex !== -1) {
      if (direction === 'next') {
        return (currentSelectionIndex + 1) % matches.length;
      }
      return (currentSelectionIndex + matches.length - 1) % matches.length;
    }

    if (direction === 'next') {
      return 0;
    }
    return matches.length - 1;
  }

  private _findIndexFromSelection(matches: IMatch[]): number {
    const terminal = this._terminal;
    const selection = terminal?.getSelectionPosition();
    if (!selection) {
      return -1;
    }
    const x = selection.start.x;
    const y = selection.start.y;
    for (let i = 0; i < matches.length; i++) {
      if (matches[i].startX === x && matches[i].startY === y) {
        return i;
      }
    }
    return -1;
  }

  private _refreshDecorations(matches: IMatch[], decorationOptions: ISearchDecorationOptions, activeMatch: IMatch | undefined): void {
    const terminal = this._terminal;
    if (!terminal) {
      return;
    }
    this._disposeDecorations();

    const cursorLine = terminal.buffer.active.baseY + terminal.buffer.active.cursorY;
    for (const match of matches) {
      const marker = terminal.registerMarker(match.startY - cursorLine);
      const width = Math.max(1, Math.min(match.cellLength, terminal.cols - match.startX));
      const decoration = terminal.registerDecoration({
        marker,
        x: match.startX,
        width,
        backgroundColor: decorationOptions.matchBackground,
        layer: 'bottom',
        overviewRulerOptions: decorationOptions.matchOverviewRuler ? { color: decorationOptions.matchOverviewRuler } : undefined
      });
      if (!decoration) {
        continue;
      }
      if (decorationOptions.matchBorder) {
        const border = decorationOptions.matchBorder;
        this._matchDecorations.push(decoration.onRender(element => {
          element.style.outline = `1px solid ${border}`;
        }));
      }
      this._matchDecorations.push(decoration);
    }

    if (!activeMatch) {
      this._activeDecoration.clear();
      return;
    }
    const marker = terminal.registerMarker(activeMatch.startY - cursorLine);
    const width = Math.max(1, Math.min(activeMatch.cellLength, terminal.cols - activeMatch.startX));
    const activeDecoration = terminal.registerDecoration({
      marker,
      x: activeMatch.startX,
      width,
      backgroundColor: decorationOptions.activeMatchBackground,
      layer: 'top',
      overviewRulerOptions: decorationOptions.activeMatchColorOverviewRuler ? { color: decorationOptions.activeMatchColorOverviewRuler } : undefined
    });
    if (!activeDecoration) {
      this._activeDecoration.clear();
      return;
    }
    const disposables: IDisposable[] = [activeDecoration];
    if (decorationOptions.activeMatchBorder) {
      const border = decorationOptions.activeMatchBorder;
      disposables.push(activeDecoration.onRender(element => {
        element.style.outline = `1px solid ${border}`;
      }));
    }
    this._activeDecoration.value = toDisposable(() => {
      for (const disposable of disposables) {
        disposable.dispose();
      }
    });
  }

  private _disposeDecorations(): void {
    this._activeDecoration.clear();
    while (this._matchDecorations.length > 0) {
      this._matchDecorations.pop()!.dispose();
    }
  }

  private _createSearchKey(term: string, searchOptions: ISearchOptions | undefined, direction: 'next' | 'previous'): string {
    return JSON.stringify({
      term,
      direction,
      caseSensitive: !!searchOptions?.caseSensitive,
      regex: !!searchOptions?.regex,
      wholeWord: !!searchOptions?.wholeWord
    });
  }
}

interface ILogicalLine {
  text: string;
  offsetToPoint: IPoint[];
  offsetToLinear: number[];
}

interface IPoint {
  x: number;
  y: number;
}

interface IMatch {
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  cellLength: number;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function isWordChar(value: string): boolean {
  return /^[0-9A-Za-z_]$/.test(value);
}
