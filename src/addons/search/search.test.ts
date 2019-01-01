/**
 * Copyright (c) 2018 The xterm.js authors. All rights reserved.
 * @license MIT
 */
declare var require: any;

import { assert, expect } from 'chai';
import * as search from './search';
import { SearchHelper } from './SearchHelper';
import { ISearchOptions, ISearchResult } from './Interfaces';

class MockTerminalPlain {}

class MockTerminal {
  private _core: any;
  public searchHelper: TestSearchHelper;
  public cols: number;
  constructor(options: any) {
    this._core = new (require('../../../lib/Terminal')).Terminal(options);
    this.searchHelper = new TestSearchHelper(this as any);
    this.cols = options.cols;
  }
  get core(): any {
    return this._core;
  }
  pushWriteData(): void {
    this._core._innerWrite();
  }
}

class TestSearchHelper extends SearchHelper {
  public findInLine(term: string, rowNumber: number, searchOptions?: ISearchOptions): ISearchResult {
    return this._findInLine(term, rowNumber, 0, searchOptions);
  }
  public findFromIndex(term: string, row: number, col: number, searchOptions?: ISearchOptions, isReverseSearch?: boolean): ISearchResult {
    return this._findInLine(term, row, col, searchOptions, isReverseSearch);
  }
}

describe('search addon', () => {
  describe('apply', () => {
    it('should register findNext and findPrevious', () => {
      search.apply(<any>MockTerminalPlain);
      assert.equal(typeof (<any>MockTerminalPlain).prototype.findNext, 'function');
      assert.equal(typeof (<any>MockTerminalPlain).prototype.findPrevious, 'function');
    });
  });
  describe('find', () => {
    it('Searchhelper - should find correct position', () => {
      search.apply(<any>MockTerminal);
      const term = new MockTerminal({cols: 20, rows: 3});
      term.core.write('Hello World\r\ntest\n123....hello');
      term.pushWriteData();
      const hello0 = term.searchHelper.findInLine('Hello', 0);
      const hello1 = term.searchHelper.findInLine('Hello', 1);
      const hello2 = term.searchHelper.findInLine('Hello', 2);
      expect(hello0).eql({col: 0, row: 0, term: 'Hello'});
      expect(hello1).eql(undefined);
      expect(hello2).eql({col: 11, row: 2, term: 'Hello'});
    });
    it('should find search term accross line wrap', () => {
      search.apply(<any>MockTerminal);
      const term = new MockTerminal({cols: 10, rows: 5});
      term.core.write('texttextHellotext\r\n');
      term.core.write('texttexttextHellotext         goodbye');
      term.pushWriteData();
      /*
        texttextHe
        llotext
        texttextte
        xtHellotex
        t         (these spaces included intentionally)
        goodbye
      */

      const hello0 = term.searchHelper.findInLine('Hello', 0);
      const hello1 = term.searchHelper.findInLine('Hello', 1);
      const hello2 = term.searchHelper.findInLine('Hello', 2);
      const hello3 = term.searchHelper.findInLine('Hello', 3);
      const llo = term.searchHelper.findInLine('llo', 1);
      const goodbye = term.searchHelper.findInLine('goodbye', 2);
      expect(hello0).eql({col: 8, row: 0, term: 'Hello'});
      expect(hello1).eql(undefined);
      expect(hello2).eql({col: 2, row: 3, term: 'Hello'});
      expect(hello3).eql(undefined);
      expect(llo).eql(undefined);
      expect(goodbye).eql({col: 0, row: 5, term: 'goodbye'});
      term.core.resize(9, 5);
      const hello0Resize = term.searchHelper.findInLine('Hello', 0);
      expect(hello0Resize).eql({col: 8, row: 0, term: 'Hello'});
    });
    it('should respect search regex', () => {
      search.apply(<any>MockTerminal);
      const term = new MockTerminal({cols: 10, rows: 4});
      term.core.write('abcdefghijklmnopqrstuvwxyz\r\n~/dev  ');
      /*
        abcdefghij
        klmnopqrst
        uvwxyz
        ~/dev
      */
      term.pushWriteData();
      const searchOptions = {
        regex: true,
        wholeWord: false,
        caseSensitive: false
      };
      const hello0 = term.searchHelper.findInLine('dee*', 0, searchOptions);
      const hello1 = term.searchHelper.findInLine('jkk*', 0, searchOptions);
      const hello2 = term.searchHelper.findInLine('mnn*', 1, searchOptions);
      const tilda0 = term.searchHelper.findInLine('^~', 3, searchOptions);
      const tilda1 = term.searchHelper.findInLine('^[~]', 3, searchOptions);
      const tilda2 = term.searchHelper.findInLine('^\\~', 3, searchOptions);
      expect(hello0).eql({col: 3, row: 0, term: 'de'});
      expect(hello1).eql({col: 9, row: 0, term: 'jk'});
      expect(hello2).eql(undefined);
      expect(tilda0).eql({col: 0, row: 3, term: '~'});
      expect(tilda1).eql({col: 0, row: 3, term: '~'});
      expect(tilda2).eql({col: 0, row: 3, term: '~'});
    });
    it('should not select empty lines', () => {
      search.apply(<any>MockTerminal);
      const term = new MockTerminal({cols: 20, rows: 3});
      const line = term.searchHelper.findInLine('^.*$', 0, { regex: true });
      expect(line).eql(undefined);
    });
    it('should respect case sensitive', function(): void {
      search.apply(<any>MockTerminal);
      const term = new MockTerminal({cols: 20, rows: 4});
      term.core.write('Hello World\r\n123....hello\r\nmoreTestHello');
      term.pushWriteData();
      const searchOptions = {
        regex: false,
        wholeWord: false,
        caseSensitive: true
      };
      const hello0 = term.searchHelper.findInLine('Hello', 0, searchOptions);
      const hello1 = term.searchHelper.findInLine('Hello', 1, searchOptions);
      const hello2 = term.searchHelper.findInLine('Hello', 2, searchOptions);
      expect(hello0).eql({col: 0, row: 0, term: 'Hello'});
      expect(hello1).eql(undefined);
      expect(hello2).eql({col: 8, row: 2, term: 'Hello'});
    });
    it('should respect case sensitive + regex', function(): void {
      search.apply(<any>MockTerminal);
      const term = new MockTerminal({cols: 20, rows: 4});
      term.core.write('hellohello\r\nHelloHello');
      term.pushWriteData();

      /**
       * hellohello
       * HelloHello
       */

      const searchOptions = {
        regex: true,
        wholeWord: false,
        caseSensitive: true
      };
      const hello0 = term.searchHelper.findInLine('Hello', 0, searchOptions);
      const hello1 = term.searchHelper.findInLine('Hello$', 0, searchOptions);
      const hello2 = term.searchHelper.findInLine('Hello', 1, searchOptions);
      const hello3 = term.searchHelper.findInLine('Hello$', 1, searchOptions);
      expect(hello0).eql(undefined);
      expect(hello1).eql(undefined);
      expect(hello2).eql({col: 0, row: 1, term: 'Hello'});
      expect(hello3).eql({col: 5, row: 1, term: 'Hello'});
    });
    it('should respect whole-word search option', function(): void {
      search.apply(<any>MockTerminal);
      const term = new MockTerminal({cols: 20, rows: 5});
      term.core.write('Hello World\r\nWorld Hello\r\nWorldHelloWorld\r\nHelloWorld\r\nWorldHello');
      term.pushWriteData();
      const searchOptions = {
        regex: false,
        wholeWord: true,
        caseSensitive: false
      };
      const hello0 = term.searchHelper.findInLine('Hello', 0, searchOptions);
      const hello1 = term.searchHelper.findInLine('Hello', 1, searchOptions);
      const hello2 = term.searchHelper.findInLine('Hello', 2, searchOptions);
      const hello3 = term.searchHelper.findInLine('Hello', 3, searchOptions);
      const hello4 = term.searchHelper.findInLine('Hello', 4, searchOptions);
      expect(hello0).eql({col: 0, row: 0, term: 'Hello'});
      expect(hello1).eql({col: 6, row: 1, term: 'Hello'});
      expect(hello2).eql(undefined);
      expect(hello3).eql(undefined);
      expect(hello4).eql(undefined);
    });
    it('should respect whole-word + case sensitive search options', function(): void {
      search.apply(<any>MockTerminal);
      const term = new MockTerminal({cols: 20, rows: 5});
      term.core.write('Hello World\r\nHelloWorld');
      term.pushWriteData();
      const searchOptions = {
        regex: false,
        wholeWord: true,
        caseSensitive: true
      };
      const hello0 = term.searchHelper.findInLine('Hello', 0, searchOptions);
      const hello1 = term.searchHelper.findInLine('hello', 0, searchOptions);
      const hello2 = term.searchHelper.findInLine('Hello', 1, searchOptions);
      const hello3 = term.searchHelper.findInLine('hello', 1, searchOptions);
      expect(hello0).eql({col: 0, row: 0, term: 'Hello'});
      expect(hello1).eql(undefined);
      expect(hello2).eql(undefined);
      expect(hello3).eql(undefined);
    });
    it('should respect whole-word + regex search options', function(): void {
      search.apply(<any>MockTerminal);
      const term = new MockTerminal({cols: 20, rows: 5});
      term.core.write('Hello World Hello\r\nHelloWorldHello');
      term.pushWriteData();
      const searchOptions = {
        regex: true,
        wholeWord: true,
        caseSensitive: false
      };
      const hello0 = term.searchHelper.findInLine('Hello', 0, searchOptions);
      const hello1 = term.searchHelper.findInLine('Hello$', 0, searchOptions);
      const hello2 = term.searchHelper.findInLine('Hello', 1, searchOptions);
      const hello3 = term.searchHelper.findInLine('Hello$', 1, searchOptions);
      expect(hello0).eql({col: 0, row: 0, term: 'hello'});
      expect(hello1).eql({col: 12, row: 0, term: 'hello'});
      expect(hello2).eql(undefined);
      expect(hello3).eql(undefined);
    });
    it('should respect all search options', function(): void {
      search.apply(<any>MockTerminal);
      const term = new MockTerminal({cols: 20, rows: 5});
      term.core.write('Hello World Hello\r\nHelloWorldHello');
      term.pushWriteData();
      const searchOptions = {
        regex: true,
        wholeWord: true,
        caseSensitive: true
      };
      const hello0 = term.searchHelper.findInLine('Hello', 0, searchOptions);
      const hello1 = term.searchHelper.findInLine('Hello$', 0, searchOptions);
      const hello2 = term.searchHelper.findInLine('hello', 0, searchOptions);
      const hello3 = term.searchHelper.findInLine('hello$', 0, searchOptions);
      const hello4 = term.searchHelper.findInLine('hello', 1, searchOptions);
      const hello5 = term.searchHelper.findInLine('hello$', 1, searchOptions);
      expect(hello0).eql({col: 0, row: 0, term: 'Hello'});
      expect(hello1).eql({col: 12, row: 0, term: 'Hello'});
      expect(hello2).eql(undefined);
      expect(hello3).eql(undefined);
      expect(hello4).eql(undefined);
      expect(hello5).eql(undefined);
    });
    it('should find multiple matches in line', function(): void {
      search.apply(<any>MockTerminal);
      const term = new MockTerminal({cols: 20, rows: 5});
      term.core.write('helloooo helloooo\r\naaaAAaaAAA');
      term.pushWriteData();
      const searchOptions = {
        regex: false,
        wholeWord: false,
        caseSensitive: false
      };
      const find0 = term.searchHelper.findFromIndex('hello', 0, 0, searchOptions);
      const find1 = term.searchHelper.findFromIndex('hello', 0, find0.col + find0.term.length, searchOptions);
      const find2 = term.searchHelper.findFromIndex('aaaa', 1, 0, searchOptions);
      const find3 = term.searchHelper.findFromIndex('aaaa', 1, find2.col + find2.term.length, searchOptions);
      const find4 = term.searchHelper.findFromIndex('aaaa', 1, find3.col + find3.term.length, searchOptions);
      expect(find0).eql({col: 0, row: 0, term: 'hello'});
      expect(find1).eql({col: 9, row: 0, term: 'hello'});
      expect(find2).eql({col: 0, row: 1, term: 'aaaa'});
      expect(find3).eql({col: 4, row: 1, term: 'aaaa'});
      expect(find4).eql(undefined);
    });
    it('should find multiple matches in line - reverse search', function(): void {
      search.apply(<any>MockTerminal);
      const term = new MockTerminal({cols: 20, rows: 5});
      term.core.write('it is what it is');
      term.pushWriteData();
      const searchOptions = {
        regex: false,
        wholeWord: false,
        caseSensitive: false
      };
      const isReverseSearch = true;
      const find0 = term.searchHelper.findFromIndex('is', 0, 16, searchOptions, isReverseSearch);
      const find1 = term.searchHelper.findFromIndex('is', 0, find0.col, searchOptions, isReverseSearch);
      const find2 = term.searchHelper.findFromIndex('it', 0, 16, searchOptions, isReverseSearch);
      const find3 = term.searchHelper.findFromIndex('it', 0, find2.col, searchOptions, isReverseSearch);
      expect(find0).eql({col: 14, row: 0, term: 'is'});
      expect(find1).eql({col: 3, row: 0, term: 'is'});
      expect(find2).eql({col: 11, row: 0, term: 'it'});
      expect(find3).eql({col: 0, row: 0, term: 'it'});
    });
    it('should find multiple matches in line - reverse search with regex', function(): void {
      search.apply(<any>MockTerminal);
      const term = new MockTerminal({cols: 20, rows: 5});
      term.core.write('zzzABCzzzzABCABC');
      term.pushWriteData();
      const searchOptions = {
        regex: true,
        wholeWord: false,
        caseSensitive: true
      };
      const isReverseSearch = true;
      const find0 = term.searchHelper.findFromIndex('[A-Z]{3}', 0, 16, searchOptions, isReverseSearch);
      const find1 = term.searchHelper.findFromIndex('[A-Z]{3}', 0, find0.col, searchOptions, isReverseSearch);
      const find2 = term.searchHelper.findFromIndex('[A-Z]{3}', 0, find1.col, searchOptions, isReverseSearch);
      const find3 = term.searchHelper.findFromIndex('[A-Z]{3}', 0, find2.col, searchOptions, isReverseSearch);
      expect(find0).eql({col: 13, row: 0, term: 'ABC'});
      expect(find1).eql({col: 10, row: 0, term: 'ABC'});
      expect(find2).eql({col: 3, row: 0, term: 'ABC'});
      expect(find3).eql(undefined);
    });
  });
});
