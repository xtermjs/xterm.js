/**
 * Copyright (c) 2018 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import { assert, expect } from 'chai';
import * as search from './search';
import { SearchHelper } from './SearchHelper';
import { ISearchHelper } from './Interfaces';


class MockTerminalPlain {}

class MockTerminal {
  private _core: any;
  public searchHelper: ISearchHelper;
  constructor(options: any) {
    this._core = new (require('../../../lib/Terminal').Terminal)(options);
    this.searchHelper = new SearchHelper(this as any);
  }
  get core(): any {
    return this._core;
  }
  pushWriteData(): void {
    this._core._innerWrite();
  }
}

describe('search addon', function(): void {
  describe('apply', () => {
    it('should register findNext and findPrevious', () => {
      search.apply(<any>MockTerminalPlain);
      assert.equal(typeof (<any>MockTerminalPlain).prototype.findNext, 'function');
      assert.equal(typeof (<any>MockTerminalPlain).prototype.findPrevious, 'function');
    });
  });
  it('Searchhelper - should find correct position', function(): void {
    search.apply(<any>MockTerminal);
    const term = new MockTerminal({cols: 20, rows: 3});
    term.core.write('Hello World\r\ntest\n123....hello');
    term.pushWriteData();
    const hello0 = (term.searchHelper as any)._findInLine('Hello', 0);
    const hello1 = (term.searchHelper as any)._findInLine('Hello', 1);
    const hello2 = (term.searchHelper as any)._findInLine('Hello', 2);
    expect(hello0).eql({col: 0, row: 0, term: 'Hello'});
    expect(hello1).eql(undefined);
    expect(hello2).eql({col: 11, row: 2, term: 'Hello'});
  });
});
