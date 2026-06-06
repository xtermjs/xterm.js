/**
 * Copyright (c) 2026 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import { assert } from 'chai';
import { DecorationManager } from './DecorationManager';
import { SearchEngine } from './SearchEngine';
import { SearchLineCache } from './SearchLineCache';
import { Terminal } from 'browser/public/Terminal';
import type { ISearchDecorationOptions } from '@xterm/addon-search';
import type { IDecorationOptions } from '@xterm/xterm';
import { DisposableStore } from 'common/primitives/Lifecycle';

function writeP(terminal: Terminal, data: string): Promise<void> {
  return new Promise(r => terminal.write(data, r));
}

describe('DecorationManager', () => {
  let store: DisposableStore;
  let terminal: Terminal;
  let decorationManager: DecorationManager;

  beforeEach(() => {
    store = new DisposableStore();
    terminal = store.add(new Terminal({ cols: 10, rows: 5 }));
    decorationManager = store.add(new DecorationManager(terminal));
  });

  it('should split highlight decorations for a wrapped match', async () => {
    await writeP(terminal, '0123456789abcde');
    const searchEngine = new SearchEngine(terminal, store.add(new SearchLineCache(terminal)));
    const match = searchEngine.find('9abc', 0, 0);
    assert.ok(match);

    const decorationOptions: IDecorationOptions[] = [];
    const registerDecoration = terminal.registerDecoration.bind(terminal);
    terminal.registerDecoration = (options: IDecorationOptions) => {
      decorationOptions.push(options);
      return registerDecoration(options);
    };

    const options: ISearchDecorationOptions = {
      matchOverviewRuler: '#ff0000',
      activeMatchColorOverviewRuler: '#00ff00'
    };
    decorationManager.createHighlightDecorations([match], options);

    assert.strictEqual(decorationOptions.length, 2);
    assert.strictEqual(decorationOptions[0].x, 9);
    assert.strictEqual(decorationOptions[0].width, 1);
    assert.strictEqual(decorationOptions[1].x, 0);
    assert.strictEqual(decorationOptions[1].width, 3);

    const withOverviewRuler = decorationOptions.filter(o => o.overviewRulerOptions !== undefined);
    assert.strictEqual(withOverviewRuler.length, 2);
  });

  it('should only add one overview ruler marker per buffer line', async () => {
    await writeP(terminal, 'abcdefghij');
    const decorationOptions: IDecorationOptions[] = [];
    const registerDecoration = terminal.registerDecoration.bind(terminal);
    terminal.registerDecoration = (options: IDecorationOptions) => {
      decorationOptions.push(options);
      return registerDecoration(options);
    };

    const options: ISearchDecorationOptions = {
      matchOverviewRuler: '#ff0000',
      activeMatchColorOverviewRuler: '#00ff00'
    };
    decorationManager.createHighlightDecorations([
      { term: 'a', col: 0, row: 0, size: 1 },
      { term: 'f', col: 5, row: 0, size: 1 }
    ], options);

    const withOverviewRuler = decorationOptions.filter(o => o.overviewRulerOptions !== undefined);
    assert.strictEqual(withOverviewRuler.length, 1);
    assert.strictEqual(withOverviewRuler[0].x, 0);
  });
});
