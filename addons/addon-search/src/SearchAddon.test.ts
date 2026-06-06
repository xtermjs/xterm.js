/**
 * Copyright (c) 2026 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import { assert } from 'chai';
import { SearchAddon } from './SearchAddon';
import { Terminal } from 'browser/public/Terminal';
import { DisposableStore } from 'common/Lifecycle';

function writeP(terminal: Terminal, data: string): Promise<void> {
  return new Promise(r => terminal.write(data, r));
}

describe('SearchAddon', () => {
  let store: DisposableStore;
  let terminal: Terminal;
  let searchAddon: SearchAddon;

  const decorations = { matchOverviewRuler: '#ffff00', activeMatchColorOverviewRuler: '#ff0000' };

  beforeEach(() => {
    store = new DisposableStore();
    terminal = store.add(new Terminal({ cols: 3, rows: 5 }));
    searchAddon = store.add(new SearchAddon());
    terminal.loadAddon(searchAddon);
    terminal.select = () => { };
    terminal.clearSelection = () => { };
  });

  afterEach(() => {
    store.dispose();
  });

  describe('_highlightAllMatches', () => {
    it('should advance highlight scan by buffer match size for wide characters', async () => {
      let resultCount = -1;
      store.add(searchAddon.onDidChangeResults(e => { resultCount = e.resultCount; }));

      await writeP(terminal, '𝄞𝄞𝄞');
      assert.ok(searchAddon.findNext('𝄞', { decorations }));
      assert.strictEqual(resultCount, 3);
    });
  });
});
