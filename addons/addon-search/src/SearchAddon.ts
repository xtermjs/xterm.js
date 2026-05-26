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
  private static readonly _maxMatchCacheEntries = 16;

  private _terminal: Terminal | undefined;

  private readonly _onBeforeSearch = this._register(new Emitter<void>());
  public readonly onBeforeSearch: IEvent<void> = this._onBeforeSearch.event;

  private readonly _onAfterSearch = this._register(new Emitter<void>());
  public readonly onAfterSearch: IEvent<void> = this._onAfterSearch.event;

  private readonly _onDidChangeResults = this._register(new Emitter<ISearchResultChangeEvent>());
  public readonly onDidChangeResults: IEvent<ISearchResultChangeEvent> = this._onDidChangeResults.event;

  private readonly _bufferUpdateListener = this._register(new MutableDisposable<IDisposable>());
  private readonly _resizeListener = this._register(new MutableDisposable<IDisposable>());
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
  private readonly _matchCache = new Map<string, IMatch[] | undefined>();
  private _logicalLineCache: ILogicalLineCache | undefined;
  private readonly _selectionIndexCache = new WeakMap<IMatch[], Map<string, number>>();

  constructor(options?: Partial<ISearchAddonOptions>) {
    super();
    if (typeof options?.highlightLimit === 'number' && Number.isFinite(options.highlightLimit) && options.highlightLimit > 0) {
      this._highlightLimit = Math.floor(options.highlightLimit);
    }
  }

  public activate(terminal: Terminal): void {
    this._terminal = terminal;
    this._clearMatchCache();
    this._bufferUpdateListener.value = terminal.onWriteParsed(() => {
      this._clearMatchCache();
    });
    this._resizeListener.value = terminal.onResize(() => {
      this._clearMatchCache();
    });
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

      const matches = this._getMatches(term, searchOptions);
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
    if (
      this._resultCount === 0 &&
      this._resultIndex === -1 &&
      this._lastSearchTerm === undefined &&
      this._lastSearchOptions === undefined &&
      this._lastSearchKey === undefined &&
      this._matchDecorations.length === 0 &&
      !this._activeDecoration.value &&
      !this._resultsUpdateListener.value
    ) {
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
    const matches = this._getMatches(this._lastSearchTerm, this._lastSearchOptions);
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
    const isRegex = !!searchOptions?.regex;
    const regex = isRegex ? this._buildRegex(term, searchOptions) : undefined;
    if (isRegex && !regex) {
      return undefined;
    }
    const normalizedTerm = searchOptions?.caseSensitive ? term : term.toLowerCase();
    const matches: IMatch[] = [];
    const cols = terminal.cols;
    const logicalLines = this._getLogicalLines(cols);
    for (const logicalLine of logicalLines) {
      let matchedOffsets: number[] | undefined;
      if (isRegex) {
        regex!.lastIndex = 0;
        while (true) {
          const match = regex!.exec(logicalLine.text);
          if (!match) {
            break;
          }
          if (match[0].length === 0) {
            regex!.lastIndex++;
            continue;
          }
          const startOffset = match.index;
          const endOffset = startOffset + match[0].length;
          if (!this._isWholeWordMatch(logicalLine.text, startOffset, endOffset, searchOptions)) {
            continue;
          }
          matchedOffsets ??= [];
          matchedOffsets.push(startOffset, endOffset);
        }
      } else {
        const haystack = searchOptions?.caseSensitive ? logicalLine.text : logicalLine.text.toLowerCase();
        let searchIndex = 0;
        while (searchIndex < haystack.length) {
          const startOffset = haystack.indexOf(normalizedTerm, searchIndex);
          if (startOffset === -1) {
            break;
          }
          const endOffset = startOffset + term.length;
          if (this._isWholeWordMatch(logicalLine.text, startOffset, endOffset, searchOptions)) {
            matchedOffsets ??= [];
            matchedOffsets.push(startOffset, endOffset);
          }
          searchIndex = startOffset + 1;
        }
      }
      if (matchedOffsets && matchedOffsets.length > 0) {
        if (!logicalLine.offsetToPoint || !logicalLine.offsetToLinear) {
          const offsets = this._buildLogicalLineOffsets(logicalLine.rows, cols);
          logicalLine.offsetToPoint = offsets.offsetToPoint;
          logicalLine.offsetToLinear = offsets.offsetToLinear;
        }
        const offsetToPoint = logicalLine.offsetToPoint;
        const offsetToLinear = logicalLine.offsetToLinear;
        for (let i = 0; i < matchedOffsets.length; i += 2) {
          const startOffset = matchedOffsets[i];
          const endOffset = matchedOffsets[i + 1];
          const start = offsetToPoint[startOffset];
          const end = offsetToPoint[endOffset];
          const startLinear = offsetToLinear[startOffset];
          const endLinear = offsetToLinear[endOffset];
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
      }
    }

    return matches;
  }

  private _getMatches(term: string, searchOptions?: ISearchOptions): IMatch[] | undefined {
    const terminal = this._terminal;
    if (!terminal) {
      return undefined;
    }
    const key = `${terminal.cols}|${this._createMatchKey(term, searchOptions)}`;
    if (this._matchCache.has(key)) {
      return this._matchCache.get(key);
    }
    const matches = this._findAllMatches(term, searchOptions);
    if (!this._matchCache.has(key) && this._matchCache.size >= SearchAddon._maxMatchCacheEntries) {
      const firstKey = this._matchCache.keys().next().value;
      if (firstKey !== undefined) {
        this._matchCache.delete(firstKey);
      }
    }
    this._matchCache.set(key, matches);
    return matches;
  }

  private _clearMatchCache(): void {
    this._matchCache.clear();
    this._logicalLineCache = undefined;
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

  private _getLogicalLines(cols: number): ILogicalLineCacheEntry[] {
    if (this._logicalLineCache && this._logicalLineCache.cols === cols) {
      return this._logicalLineCache.entries;
    }
    const terminal = this._terminal;
    if (!terminal) {
      return [];
    }
    const entries: ILogicalLineCacheEntry[] = [];
    const buffer = terminal.buffer.active;
    for (let row = 0; row < buffer.length; row++) {
      const firstLine = buffer.getLine(row);
      if (!firstLine || firstLine.isWrapped) {
        continue;
      }
      const rows: number[] = [row];
      let nextRow = row + 1;
      while (nextRow < buffer.length) {
        const wrappedLine = buffer.getLine(nextRow);
        if (!wrappedLine?.isWrapped) {
          break;
        }
        rows.push(nextRow);
        nextRow++;
      }
      entries.push({
        rows,
        text: this._buildLogicalLineText(rows, cols)
      });
      row = rows[rows.length - 1];
    }
    this._logicalLineCache = { cols, entries };
    return entries;
  }

  private _buildLogicalLineText(rows: number[], cols: number): string {
    const terminal = this._terminal;
    if (!terminal) {
      return '';
    }
    const textParts: string[] = [];
    const cell = terminal.buffer.active.getNullCell();
    for (const row of rows) {
      const line = terminal.buffer.active.getLine(row);
      for (let x = 0; x < cols; x++) {
        const loadedCell = line?.getCell(x, cell);
        const width = loadedCell ? loadedCell.getWidth() : 1;
        if (width === 0) {
          continue;
        }
        textParts.push(loadedCell?.getChars() || ' ');
      }
    }
    return textParts.join('');
  }

  private _buildLogicalLineOffsets(rows: number[], cols: number): ILogicalLineOffsets {
    const terminal = this._terminal;
    if (!terminal) {
      return {
        offsetToPoint: [{ x: 0, y: rows[0] ?? 0 }],
        offsetToLinear: [0]
      };
    }

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
        const codeUnitCount = chars.length;
        for (let i = 1; i < codeUnitCount; i++) {
          offsetToPoint[currentOffset + i] = this._linearToPoint(rows, cols, linearOffset);
          offsetToLinear[currentOffset + i] = linearOffset;
        }
        currentOffset += codeUnitCount;
        linearOffset += width;
        offsetToPoint[currentOffset] = this._linearToPoint(rows, cols, linearOffset);
        offsetToLinear[currentOffset] = linearOffset;
      }
    }

    return {
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
    let indexMap = this._selectionIndexCache.get(matches);
    if (!indexMap) {
      indexMap = new Map<string, number>();
      for (let i = 0; i < matches.length; i++) {
        indexMap.set(`${matches[i].startY}:${matches[i].startX}`, i);
      }
      this._selectionIndexCache.set(matches, indexMap);
    }
    return indexMap.get(`${selection.start.y}:${selection.start.x}`) ?? -1;
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
    return `${this._createMatchKey(term, searchOptions)}|${direction}`;
  }

  private _createMatchKey(term: string, searchOptions: ISearchOptions | undefined): string {
    const flags =
      (searchOptions?.caseSensitive ? 1 : 0) |
      (searchOptions?.regex ? 2 : 0) |
      (searchOptions?.wholeWord ? 4 : 0);
    return `${term}|${flags}`;
  }
}

interface ILogicalLineCacheEntry {
  rows: number[];
  text: string;
  offsetToPoint?: IPoint[];
  offsetToLinear?: number[];
}

interface ILogicalLineCache {
  cols: number;
  entries: ILogicalLineCacheEntry[];
}

interface ILogicalLineOffsets {
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
  if (value.length === 0) {
    return false;
  }
  const code = value.charCodeAt(0);
  return (
    (code >= 48 && code <= 57) || // 0-9
    (code >= 65 && code <= 90) || // A-Z
    (code >= 97 && code <= 122) || // a-z
    code === 95 // _
  );
}
