/**
 * Copyright (c) 2017 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import { assert, expect } from 'chai';

import * as webLinks from './webLinks';

class MockTerminal {
  public regex: RegExp;
  public handler: (event: MouseEvent, uri: string) => void;
  public options?: any;

  public registerLinkMatcher(regex: RegExp, handler: (event: MouseEvent, uri: string) => void, options?: any): number {
    this.regex = regex;
    this.handler = handler;
    this.options = options;
    return 0;
  }
}

describe('webLinks addon', () => {
  describe('apply', () => {
    it('should do register the `webLinksInit` method', () => {
      webLinks.apply(<any>MockTerminal);
      assert.equal(typeof (<any>MockTerminal).prototype.webLinksInit, 'function');
    });
  });

  it('should allow ~ character in URI path', () => {
    const term = new MockTerminal();
    webLinks.webLinksInit(<any>term);

    const row = '  http://foo.com/a~b#c~d?e~f  ';

    let match = row.match(term.regex);
    let uri = match[term.options.matchIndex];

    assert.equal(uri, 'http://foo.com/a~b#c~d?e~f');
  });
});
