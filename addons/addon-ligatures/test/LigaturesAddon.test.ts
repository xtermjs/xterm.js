/**
 * Copyright (c) 2018 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import * as path from 'path';
import { assert } from 'chai';

// Use require to get a mutable module object (ESM imports create read-only bindings)
const fontFinder = require('font-finder');
const ligatureSupport = require('../out-esbuild/index');

const originalList = fontFinder.list;

describe('LigaturesAddon', () => {
  let onRefresh: { called: boolean, callCount: number, (...args: any[]): void };
  let term: MockTerminal;

  const input = 'a -> b www c';

  before(() => {
    fontFinder.list = () => Promise.resolve({
      'Fira Code': [{
        path: path.join(__dirname, '../fonts/firaCode.otf'),
        style: fontFinder.Style.Regular,
        type: fontFinder.Type.Monospace,
        weight: 400
      }],
      'Iosevka': [{
        path: path.join(__dirname, '../fonts/iosevka.ttf'),
        style: fontFinder.Style.Regular,
        type: fontFinder.Type.Monospace,
        weight: 400
      }],
      'Nonexistant Font': [{
        path: path.join(__dirname, '../fonts/nonexistant.ttf'),
        style: fontFinder.Style.Regular,
        type: fontFinder.Type.Monospace,
        weight: 400
      }]
    });
  });

  after(() => {
    fontFinder.list = originalList;
  });

  beforeEach(() => {
    onRefresh = Object.assign((..._args: any[]) => { onRefresh.called = true; onRefresh.callCount++; }, { called: false, callCount: 0 });
    term = new MockTerminal(onRefresh);
    ligatureSupport.enableLigatures(term as any);
  });

  it('registers itself correctly', () => {
    const term = new MockTerminal(() => {});
    assert.isUndefined(term.joiner);
    ligatureSupport.enableLigatures(term as any);
    assert.isFunction(term.joiner);
  });

  it('registers itself correctly when called directly', () => {
    const term = new MockTerminal(() => {});
    assert.isUndefined(term.joiner);
    ligatureSupport.enableLigatures(term as any);
    assert.isFunction(term.joiner);
  });

  it('returns an empty set of ranges on the first call while the font is loading', () => {
    assert.deepEqual(term.joiner!(input), []);
  });

  it('fails if it finds but cannot load the font', async () => {
    term.options.fontFamily = 'Nonexistant Font, monospace';
    assert.deepEqual(term.joiner!(input), []);
    await delay(500);
    assert.strictEqual(onRefresh.callCount, 0);
  });

  it('returns nothing if the font is not present on the system', async () => {
    term.options.fontFamily = 'notinstalled';
    assert.deepEqual(term.joiner!(input), []);
    await delay(500);
    assert.strictEqual(onRefresh.callCount, 0);
    assert.deepEqual(term.joiner!(input), []);
  });

  it('returns nothing if no specific font is specified', async () => {
    term.options.fontFamily = 'monospace';
    assert.deepEqual(term.joiner!(input), []);
    await delay(500);
    assert.strictEqual(onRefresh.callCount, 0);
    assert.deepEqual(term.joiner!(input), []);
  });

  it('returns nothing if no fonts are provided', async () => {
    term.options.fontFamily = '';
    assert.deepEqual(term.joiner!(input), []);
    await delay(500);
    assert.strictEqual(onRefresh.callCount, 0);
    assert.deepEqual(term.joiner!(input), []);
  });

  it('fails when given malformed inputs', async () => {
    term.options.fontFamily = {} as any;
    assert.deepEqual(term.joiner!(input), []);
    await delay(500);
    assert.strictEqual(onRefresh.callCount, 0);
  });
});

class MockTerminal {
  private _options: { [name: string]: string | number } = {
    fontFamily: 'Fira Code, monospace',
    rows: 50
  };
  public joiner?: (text: string) => [number, number][];
  public refresh: (start: number, end: number) => void;

  constructor(onRefresh: (start: number, end: number) => void) {
    this.refresh = onRefresh;
  }

  public registerCharacterJoiner(handler: (text: string) => [number, number][]): number {
    this.joiner = handler;
    return 1;
  }
  public deregisterCharacterJoiner(id: number): void {
    this.joiner = undefined;
  }
  public get options(): { [name: string]: string | number } { return this._options; }
  public set options(options: { [name: string]: string | number }) {
    for (const key in this._options) {
      this._options[key] = options[key];
    }
  }
}

function delay(delayMs: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, delayMs));
}
