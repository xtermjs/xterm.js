/**
 * Copyright (c) 2017 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import type { Terminal, IDisposable, ITerminalAddon, IDecoration } from '@xterm/xterm';
import type { SearchAddon as ISearchApi } from '@xterm/addon-search';
import { Emitter } from 'vs/base/common/event';
import { Disposable, dispose, MutableDisposable, toDisposable } from 'vs/base/common/lifecycle';
import { PriorityTaskQueue } from 'common/TaskQueue';

export interface ISearchOptions {
  regex?: boolean;
  wholeWord?: boolean;
  caseSensitive?: boolean;
  incremental?: boolean;
  decorations?: ISearchDecorationOptions;
  noScroll?: boolean;
}

interface ISearchDecorationOptions {
  matchBackground?: string;
  matchBorder?: string;
  matchOverviewRuler: string;
  activeMatchBackground?: string;
  activeMatchBorder?: string;
  activeMatchColorOverviewRuler: string;
}

export interface ISearchPosition {
  startCol: number;
  startRow: number;
}

export interface ISearchAddonOptions {
  highlightLimit: number;
}

export interface ISearchResult {
  term: string;
  cellCol: number;
  graphemeIndexInString: number;
  row: number;
  size: number;
  didNotYieldForThisManyRows: number;
  usedForYield: boolean;
}

interface IHighlight extends IDisposable {
  decoration: IDecoration;
  match: ISearchResult;
}

type ChunkSearchDirection = 'up'|'down';

const NON_WORD_CHARACTERS = ' ~!@#$%^&*()+`-=[]{}|\\;:"\',./<>?';

const enum Performance {

  DEFAULT_HIGHLIGHT_LIMIT = 1000,

  /**
   * Number of matches in each chunk
   */
  CHUNK_SIZE = 200,

  /**
   * Used to yield execution when CHUNK_SIZE number of mactches
   * Were not found in this number of lines
   */
  LINE_LIMIT = 100,

  /**
   * This should be high enough so not to trigger a lot of searches
   * and subsequently a lot of canceled searches which clean up their own
   * decorations and cause flickers
   */
  DEBOUNCE_TIME_WINDOW = 300,

  /**
   *  Using this mainly for resizing event
   */
  LONGER_DEBOUNCE_TIME_WINDOW = 1000,
}


export class SearchAddon extends Disposable implements ITerminalAddon , ISearchApi {
  private _terminal: Terminal | undefined;
  private _cachedSearchTerm: string | undefined;
  private _highlightedLines: Set<number> = new Set();
  private _currentMatchIndex: number = -1;
  private _matches: ISearchResult[] = [];
  private _matchesWithHighlightApplied: IHighlight[] = [];
  private _selectedDecoration: MutableDisposable<IHighlight> = this._register(new MutableDisposable());
  private _highlightLimit: number;
  private _searchOptions: ISearchOptions | undefined;
  private _debounceTimeout: number | undefined;
  private _searchCompleted: boolean = true;
  private _cancelSearchSignal: boolean = false;
  private _findPrevious: boolean = false;
  private _chunkIndex: number = 0;
  private _chunkSearchIterator: Generator<{direction: string,chunkSize: number}> | null = null;

  /**
   * translateBufferLineToStringWithWrap is a fairly expensive call.
   * We memoize the calls into an array that has a time based ttl.
   * _linesCache is also invalidated when the terminal cursor moves.
   */
  private _linesCache: (string | undefined) [] = [];

  private readonly _onDidChangeResults = this._register(new Emitter<{ resultIndex: number, resultCount: number,searchCompleted: boolean }>());
  public readonly onDidChangeResults = this._onDidChangeResults.event;

  constructor(options?: Partial<ISearchAddonOptions>) {
    super();

    this._highlightLimit = options?.highlightLimit ?? Performance.DEFAULT_HIGHLIGHT_LIMIT;
  }

  public activate(terminal: Terminal): void {
    this._terminal = terminal;

    // onWriteParsed triggers on window resize too
    this._register(this._terminal.onWriteParsed(() => {
      if (this._cachedSearchTerm){
        this.findNext(this._cachedSearchTerm!,this._searchOptions,true,undefined);
      }
    }));

    this._register(toDisposable(() => this.clearDecorations()));

    this._initLinesCache();
  }


  public clearDecorations(retainCachedSearchTerm?: boolean): void {
    this._selectedDecoration.clear();
    const iterator = this._chunkDisposeDecorationGenerator(this._matchesWithHighlightApplied.reverse());
    const taskQueue = new PriorityTaskQueue();
    taskQueue.enqueue(()=> !iterator.next().done);
    this._matchesWithHighlightApplied = [];
    this._highlightedLines.clear();
    if (!retainCachedSearchTerm) {
      this._cachedSearchTerm = undefined;
    }
  }

  /**
   * The array needs to be in descending Marker ID order.
   *
   * that way we get the smallest ID fist using pop
   *
   * we need to process the smallest ID first because removeMarker in the Buffer Class
   * does an ascending linear search
   * @param matchesWithHighlightApplied
   */
  private *_chunkDisposeDecorationGenerator(matchesWithHighlightApplied: IHighlight[]): Generator{

    for (let i = matchesWithHighlightApplied.length ;i >= 0;i--){

      if (i % Performance.CHUNK_SIZE === 0){
        yield;
      }

      matchesWithHighlightApplied.pop()?.dispose();
    }
  }

  public clearActiveDecoration(): void {
    this._selectedDecoration.clear();
  }

  /**
   * Find next match of the term (from the start or the end) , then scroll to and select it. If it
   * doesn't exist, do nothing.
   * @param term The search term.
   * @param searchOptions Search options.
   * @param writeBufferChanged
   * @param findPrevious find the previous match
   * @param dontMoveCursor
   * @returns Whether a result was found.
   */
  public findNext(term: string, searchOptions?: ISearchOptions,writeBufferOrWindowResizeEvent?: boolean,findPrevious?: boolean): boolean {

    this._findPrevious = findPrevious === true;

    if (!this._terminal) {
      throw new Error('Cannot use addon until it has been loaded');
    }

    if (!term || term.length === 0) {
      this._cancelSearchSignal = true;
      this._searchCompleted=true;
      window.clearTimeout(this._debounceTimeout);
      this.clearDecorations();
      this._matches=[];
      this._currentMatchIndex=-1;
      this._fireResults();
      return false;
    }

    const didOptionsChanged = this._searchOptions ? this._didOptionsChange(this._searchOptions, searchOptions) : false;
    this._searchOptions = searchOptions;

    const freshSearch = this._cachedSearchTerm === undefined || term !== this._cachedSearchTerm || didOptionsChanged || writeBufferOrWindowResizeEvent === true;
    this._cachedSearchTerm = term;

    if (freshSearch){

      this._cancelSearchSignal = true;

      this._matches = [];

      this._searchCompleted = false;
      this._currentMatchIndex = -1;

      window.clearTimeout(this._debounceTimeout);

      this._debounceTimeout = setTimeout(()=>{

        this._cancelSearchSignal = false;
        this._findAllMatches(term);

      },writeBufferOrWindowResizeEvent === true ? Performance.LONGER_DEBOUNCE_TIME_WINDOW : Performance.DEBOUNCE_TIME_WINDOW);

      this.clearDecorations(true);
    }

    if (freshSearch === false){
      this._moveToTheNextMatch();
    }

    return this._matches.length > 0;

  }

  /**
   * Find the previous instance of the term, then scroll to and select it. If it
   * doesn't exist, do nothing.
   * @param term The search term.
   * @param searchOptions Search options.
   * @returns Whether a result was found.
   */
  public findPrevious(term: string, searchOptions?: ISearchOptions): boolean {

    return this.findNext(term,searchOptions,false,true);
  }

  private _moveToTheNextMatch(): void{

    if (this._matches.length > 0){

      this._currentMatchIndex =   this._findPrevious ?  this._currentMatchIndex - 1  : this._currentMatchIndex + 1;

      if (this._currentMatchIndex === -2){
        // this case occurs with findPrevious on fresh search
        this._currentMatchIndex = 0;
      } else  if (this._currentMatchIndex === -1){
        this._currentMatchIndex = this._matches.length - 1;
      } else {
        this._currentMatchIndex %= this._matches.length;
      }

      this._selectResult(this._matches[this._currentMatchIndex]);

    } else {
      this._currentMatchIndex=-1;
    }

    this._fireResults();
  }

  private _findAllMatches(term: string): void {

    this._chunkSearchIterator = this._chunkSearchGenerator(term);
    this._chunkIndex = 0;
    const taskQueue = new PriorityTaskQueue();
    taskQueue.enqueue(()=> this._iterate());
  }
  /**
   * Search for term and returns once Performance.Chunk_SIZE or Performance.LINE_LIMIT is exceeded
   */
  private _iterate(): boolean{

    const iteratorResult = this._chunkSearchIterator!.next();

    if (this._chunkIndex ===0){
      this._moveToTheNextMatch();
    }

    if (iteratorResult.done === false){
      const { direction,chunkSize } = iteratorResult.value;

      const startIndex = direction === 'down' ? this._matches.length - chunkSize : 0;
      const endIndex = direction ==='down' ? this._matches.length : chunkSize;

      this._highlightChunk(startIndex,endIndex);
      // adjust match index with the growing result
      if (direction==='up' && this._chunkIndex !== 0){
        this._currentMatchIndex += chunkSize;
        this._fireResults();
      }
      this._chunkIndex++;
      return true;
    }

    if (iteratorResult.value !== false){ // search finished without being cancelled

      const { direction,chunkSize } = iteratorResult.value;

      const startIndex = direction === 'down' ? this._matches.length - chunkSize : 0;
      const endIndex = direction ==='down' ? this._matches.length : chunkSize;

      this._highlightChunk(startIndex,endIndex);

      if (direction==='up' && this._chunkIndex !== 0){
        this._currentMatchIndex += chunkSize;
      }
      this._searchCompleted = true;
      this._fireResults();
      return false;
    }
    return false;

  }
  private _fireResults(): void {
    // since the we changed the code to be asynchronous findNext no longer return whether or not
    // match was found
    // hence we cant test for searchs without decoration
    // that is why i am removing this condition here.
    // if (this._searchOptions?.decorations){
    this._onDidChangeResults.fire({ resultIndex:this._currentMatchIndex, resultCount: this._matches.length,searchCompleted: this._searchCompleted });
    // }
  }
  private *_chunkSearchGenerator(term: string): Generator<{direction: string,chunkSize: number}>{

    const rowIndex =   this._terminal!.buffer.active.viewportY;

    let searchDirection: ChunkSearchDirection = 'down';

    let downDirectionLastResult = this._find(term, rowIndex, 0,'down',0);
    let upDirectionLastResult = this._find(term, rowIndex - 1, this._terminal!.cols,'up',0);


    let yieldForReachingMaxRowScans = false;

    searchDirection =  downDirectionLastResult !== undefined ? 'down' : 'up';

    let currentChunkMatches: ISearchResult[] = [];

    while (downDirectionLastResult !== undefined || upDirectionLastResult !== undefined) {

      if (this._cancelSearchSignal === true){
        return false;
      }

      if (downDirectionLastResult !== undefined && searchDirection==='down'){

        // we need two variable to check for yield on exceeding max row scans
        // didNotYieldForThisManyRows for the current exection
        // and usedForYield for the next time we are given execution
        if (downDirectionLastResult.didNotYieldForThisManyRows < Performance.LINE_LIMIT){
          if (downDirectionLastResult.usedForYield === false){
            currentChunkMatches.push(downDirectionLastResult);
          }

          downDirectionLastResult = this._find(
            term,
            downDirectionLastResult.row,
            downDirectionLastResult.graphemeIndexInString + this._getNumberOfGraphemes(downDirectionLastResult.term),
            'down',
            downDirectionLastResult.didNotYieldForThisManyRows
          );

        } else {
          yieldForReachingMaxRowScans = true;
          downDirectionLastResult.didNotYieldForThisManyRows = 0;
          downDirectionLastResult.usedForYield = true;
        }

      } else if (upDirectionLastResult !== undefined && searchDirection === 'up'){

        if (upDirectionLastResult.didNotYieldForThisManyRows < Performance.LINE_LIMIT){
          if (upDirectionLastResult.usedForYield === false){
            currentChunkMatches.push(upDirectionLastResult);
          }

          upDirectionLastResult = this._find(
            term,
            upDirectionLastResult.row,
            upDirectionLastResult.graphemeIndexInString - this._getNumberOfGraphemes(upDirectionLastResult.term),
            'up',
            upDirectionLastResult.didNotYieldForThisManyRows
          );
        } else {
          yieldForReachingMaxRowScans = true;
          upDirectionLastResult.didNotYieldForThisManyRows=0;
          upDirectionLastResult.usedForYield = true;
        }

      }

      if (this._matches.length + currentChunkMatches.length >= this._highlightLimit) {

        if (searchDirection==='down'){
          this._matches.push(...currentChunkMatches);

        } else {
          currentChunkMatches.reverse();
          this._matches.unshift(...currentChunkMatches);// bad for performance just used temoprarly

        }

        const doneReturn = { direction:searchDirection,chunkSize:currentChunkMatches.length };

        currentChunkMatches=[];

        return doneReturn;
      }

      if (
        (currentChunkMatches.length > 0 && currentChunkMatches.length % Performance.CHUNK_SIZE === 0) ||
        (downDirectionLastResult === undefined && searchDirection === 'down') ||
        (upDirectionLastResult === undefined && searchDirection ==='up') ||
        yieldForReachingMaxRowScans
      )
      {
        yieldForReachingMaxRowScans = false;
        if (searchDirection==='down'){
          this._matches.push(...currentChunkMatches);

        } else {
          currentChunkMatches.reverse();
          this._matches.unshift(...currentChunkMatches);// bad for performance just used temoprarly

        }

        const yieldReturn = { direction:searchDirection,chunkSize:currentChunkMatches.length };

        currentChunkMatches=[];

        yield yieldReturn;

        searchDirection = searchDirection === 'down' ? 'up':'down';

      }

    }
    return true;
  }

  private _highlightChunk(startIndex: number,endIndex: number): void{

    for (let i=startIndex; i < endIndex ;i++) {

      const match = this._matches[i];
      const decoration = this._createResultDecoration(match);

      if (decoration) {
        this._highlightedLines.add(decoration.marker.line);
        this._matchesWithHighlightApplied.push({ decoration, match, dispose() { decoration.dispose(); } });
      }
    }

  }


  private _find(term: string, startRow: number, startCol: number,direction: ChunkSearchDirection,didNotYieldForThisManyRows: number): ISearchResult | undefined {
    if (!this._terminal || !term || term.length === 0) {
      return undefined;
    }
    if (startCol > this._terminal.cols) {
      throw new Error(`Invalid col: ${startCol} to search in terminal of ${this._terminal.cols} cols`);
    }


    let out: ISearchResult | undefined = undefined;

    if (direction==='down'){
      const resultAtRowAndToTheRightOfColumn = this._findInLine(term, { startRow:startRow,startCol: startCol },false);

      let resultAtOtherRowsScanColumnsLeftToRight: ISearchResult | undefined = undefined;
      let numberOfRowsSearched = 0;

      if (resultAtRowAndToTheRightOfColumn === undefined ){

        for (let y = startRow + 1; y < this._terminal.buffer.active.baseY + this._terminal.rows; y++) {

          resultAtOtherRowsScanColumnsLeftToRight = this._findInLine(term, { startRow:y,startCol: 0 },false);
          if (resultAtOtherRowsScanColumnsLeftToRight) {
            resultAtOtherRowsScanColumnsLeftToRight.didNotYieldForThisManyRows = numberOfRowsSearched + didNotYieldForThisManyRows ;
            break;
          }

          numberOfRowsSearched++;
          if (numberOfRowsSearched + didNotYieldForThisManyRows >= Performance.LINE_LIMIT){
            return { term:'-1',row: y, cellCol: 0 ,graphemeIndexInString: 0,size:-1, didNotYieldForThisManyRows: Performance.LINE_LIMIT,usedForYield: true };
          }
        }
      }
      out = resultAtRowAndToTheRightOfColumn !== undefined ? resultAtRowAndToTheRightOfColumn : resultAtOtherRowsScanColumnsLeftToRight;
    }
    else {

      const resultAtRowAndToTheLeftOfColumn = this._findInLine(term, { startRow:startRow,startCol: startCol },true);

      let resultAtOtherRowsScanColumnsRightToLeft: ISearchResult | undefined = undefined;
      let numberOfRowsSearched = 0;

      if (resultAtRowAndToTheLeftOfColumn === undefined){

        for (let y = startRow - 1; y >= 0; y--) {

          const stringLine = this._getRow(y);

          for (let j = stringLine.length; j >= 0 ; j-- ){
            resultAtOtherRowsScanColumnsRightToLeft = this._findInLine(term, { startRow: y,startCol: j },true);
            if (resultAtOtherRowsScanColumnsRightToLeft) {
              resultAtOtherRowsScanColumnsRightToLeft.didNotYieldForThisManyRows = numberOfRowsSearched + didNotYieldForThisManyRows;
              y = -1;// break outer loop
              break;
            }
          }
          numberOfRowsSearched++;
          if (numberOfRowsSearched + didNotYieldForThisManyRows >= Performance.LINE_LIMIT){
            return { term:'-1', row: y, cellCol: this._terminal.cols, graphemeIndexInString:this._terminal.cols, size: -1, didNotYieldForThisManyRows: Performance.LINE_LIMIT, usedForYield: true };
          }
        }
      }
      out = resultAtRowAndToTheLeftOfColumn !== undefined ? resultAtRowAndToTheLeftOfColumn : resultAtOtherRowsScanColumnsRightToLeft;
    }

    return out;
  }

  private _getRow(row: number): any{
    let cache = this._linesCache?.[row];

    if (!cache) {
      cache = this._terminal!.buffer.active.getLine(row)?.translateToString(true) ?? '';
      this._linesCache[row] = cache;
    }

    return cache;
  }

  /**
   * Searches a line for a search term. Takes the provided terminal line and searches the text line,
   * which may contain subsequent terminal lines if the text is wrapped. If the provided line number
   * is part of a wrapped text line that started on an earlier line then it is skipped since it will
   * be properly searched when the terminal line that the text starts on is searched.
   * @param term The search term.
   * @param searchPosition The position to start the search.
   * @param isReverseSearch Whether the search should start from the right side of the terminal and
   * search to the left.
   * @returns The search result if it was found.
   */
  protected _findInLine(term: string, searchPosition: ISearchPosition,scanRightToLeft: boolean): ISearchResult | undefined {
    const row = searchPosition.startRow;
    const col = searchPosition.startCol;

    const stringLine = this._getRow(row);

    let searchTerm = term;
    let searchStringLine = stringLine;

    if (!this._searchOptions?.regex){
      searchTerm = this._searchOptions?.caseSensitive ? term : term.toLowerCase();
      searchStringLine = this._searchOptions?.caseSensitive ? stringLine : stringLine.toLowerCase();
    }

    let resultIndex = -1;
    if (this._searchOptions?.regex) {
      const searchRegex = RegExp(searchTerm, this._searchOptions?.caseSensitive ? 'g' : 'gi');
      let foundTerm: RegExpExecArray | null;
      if (scanRightToLeft === false){
        foundTerm= searchRegex.exec(searchStringLine.slice(col));
        if (foundTerm && foundTerm[0].length > 0) {
          resultIndex = col + (searchRegex.lastIndex - foundTerm[0].length);
          term = foundTerm[0];
        }

      } else {
        // This loop will get the resultIndex of the _last_ regex match in the range 0..offset
        while ( foundTerm = searchRegex.exec(searchStringLine.slice(0, col))) {
          resultIndex = searchRegex.lastIndex - foundTerm[0].length;
          term = foundTerm[0];
          searchRegex.lastIndex -= (term.length - 1);
        }
      }

    } else {

      if (scanRightToLeft === false) {
        resultIndex = searchStringLine.indexOf(searchTerm, col);

      } else {
        resultIndex = searchStringLine.substring(0,col).lastIndexOf(searchTerm);

      }
    }


    if (resultIndex >= 0) {

      if (this._searchOptions?.wholeWord && !this._isWholeWord(resultIndex, searchStringLine, term)) {
        return;
      }
      const col = this._getNumberOfBufferCellsOccupied(stringLine.substring(0,resultIndex));
      return {
        term,
        cellCol: col ,
        graphemeIndexInString: resultIndex,
        row: row,
        size: this._getNumberOfBufferCellsOccupied(term),
        didNotYieldForThisManyRows:0, // does not matter
        usedForYield:false
      };


    }
  }

  private _isWideGrapheme(char: string,nextChar: string): boolean {
    const codePoint = char.codePointAt(0);

    if (codePoint === undefined){
      return false;
    }
    // Check CJK Unified Ideographs
    if (codePoint >= 0x4E00 && codePoint <= 0x9FFF) return true;

    // Check Fullwidth and Halfwidth Forms
    if (codePoint >= 0xFF01 && codePoint <= 0xFF60) return true;

    // Check additional wide characters (e.g., CJK Compatibility Ideographs)
    if (codePoint >= 0xF900 && codePoint <= 0xFAFF) return true;

    // surrogates
    if (codePoint>= 0xD800 && codePoint<= 0xDBFF){

      const scalar = ((char.codePointAt(0)! - 0xD800) * 0x400) + (nextChar.codePointAt(0)! - 0xDC00) + 0x10000;
      if (
        (scalar >= 0x1F300 && scalar <= 0x1F5FF) || // Miscellaneous Symbols and Pictographs
        (scalar >= 0x1F600 && scalar <= 0x1F64F) || // Emoticons
        (scalar >= 0x1F680 && scalar <= 0x1F6FF) || // Transport and Map Symbols
        (scalar >= 0x1F700 && scalar <= 0x1F77F) || // Alchemical Symbols
        (scalar >= 0x1F900 && scalar <= 0x1F9FF) || // Supplemental Symbols and Pictographs
        (scalar >= 0x1FA70 && scalar <= 0x1FAFF) || // Symbols and Pictographs Extended-A
        (scalar >= 0x2600 && scalar <= 0x26FF) ||   // Miscellaneous Symbols
        (scalar >= 0x2700 && scalar <= 0x27BF)      // Dingbats
      ) {
        return true;
      }
    }


    return false;
  }

  private _getNumberOfBufferCellsOccupied(str: string): number{

    let wide = 0;
    const numberOfGraphemes = this._getNumberOfGraphemes(str);

    for (let i=0;i<str.length;i++){
      if (this._isWideGrapheme(str[i],i+1 < str.length ? str[i+1]:'')){
        wide++;
      }
    }
    return numberOfGraphemes + wide;
  }
  /**
   * Unlike sting.length which returns the number of UTF-16 chunks (2 Bytes)
   * this returns number of graphemes
   * So a surrugate pair (i.e. a pair of UTF-16 (i.e 2 * 2 Bytes === 4 Bytes)) is counted as one.
   * we need this since indexOf works the number of graphemes
   */
  private _getNumberOfGraphemes(str: string): number{
    return Array.from(str).length;
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

  /**
   * Register listerner to clear the cache when things change
   */
  private _initLinesCache(): void {
    if (this._terminal) {
      this._terminal.onLineFeed(() => {
        if (this._linesCache?.length !== 0) {
          this._destroyLinesCache();
        }

      });
      this._terminal.onCursorMove(() => {
        if (this._linesCache?.length !== 0) {
          this._destroyLinesCache();
        }
      });
      this._terminal.onResize(() => {
        if (this._linesCache?.length !== 0) {
          this._destroyLinesCache();
        }
      });
    }
  }

  private _destroyLinesCache(): void {
    this._linesCache = [];
  }

  /**
   * A found substring is a whole word if it doesn't have an alphanumeric character directly
   * adjacent to it.
   * @param searchIndex starting indext of the potential whole word substring
   * @param line entire string in which the potential whole word was found
   * @param term the substring that starts at searchIndex
   */
  private _isWholeWord(searchIndex: number, line: string, term: string): boolean {
    return ((searchIndex === 0) || (NON_WORD_CHARACTERS.includes(line[searchIndex - 1]))) &&
      (((searchIndex + term.length) === line.length) || (NON_WORD_CHARACTERS.includes(line[searchIndex + term.length])));
  }



  /**
   * Selects and scrolls to a result.
   * @param result The result to select.
   * @returns Whether a result was selected.
   */
  private _selectResult(result: ISearchResult | undefined): boolean {
    const terminal = this._terminal!;
    this._selectedDecoration.clear();
    if (!result) {
      terminal.clearSelection();
      return false;
    }
    terminal.select(result.cellCol, result.row, result.size);
    if (this._searchOptions?.decorations) {
      const marker = terminal.registerMarker(-terminal.buffer.active.baseY - terminal.buffer.active.cursorY + result.row);
      if (marker) {
        const decoration = terminal.registerDecoration({
          marker,
          x: result.cellCol,
          width: result.size,
          backgroundColor: this._searchOptions?.decorations.activeMatchBackground,
          layer: 'top',
          overviewRulerOptions: {
            color: this._searchOptions?.decorations.activeMatchColorOverviewRuler
          }
        });
        if (decoration) {
          const disposables: IDisposable[] = [];
          disposables.push(marker);
          disposables.push(decoration.onRender((e) => this._applyStyles(e, this._searchOptions?.decorations?.activeMatchBorder, true)));
          disposables.push(decoration.onDispose(() => dispose(disposables)));
          this._selectedDecoration.value = { decoration, match: result, dispose() { decoration.dispose(); } };
        }
      }
    }

    if (!this._searchOptions?.noScroll) {
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
  private _createResultDecoration(result: ISearchResult): IDecoration | undefined {
    const terminal = this._terminal!;
    const marker = terminal.registerMarker(-terminal.buffer.active.baseY - terminal.buffer.active.cursorY + result.row);
    if (!marker) {
      return undefined;
    }
    const findResultDecoration = terminal.registerDecoration({
      marker,
      x: result.cellCol,
      width: result.size,
      backgroundColor: this._searchOptions?.decorations?.matchBackground,
      overviewRulerOptions: this._highlightedLines.has(marker.line) ? undefined : {
        color: this._searchOptions?.decorations?.matchOverviewRuler ?? 'red',// just temporary
        position: 'center'
      }
    });
    if (findResultDecoration) {
      const disposables: IDisposable[] = [];
      disposables.push(marker);
      disposables.push(findResultDecoration.onRender((e) => this._applyStyles(e, this._searchOptions?.decorations?.matchBorder, false)));
      disposables.push(findResultDecoration.onDispose(() => dispose(disposables)));
    }
    return findResultDecoration;
  }
}
