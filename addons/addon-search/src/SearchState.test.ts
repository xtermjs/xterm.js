/**
 * Copyright (c) 2026 The xterm.js authors. All rights reserved.
 * @license MIT
 */
import { assert } from 'chai';
import { SearchState } from './SearchState';
import type { ISearchOptions } from '@xterm/addon-search';

const DECORATIONS_A: ISearchOptions = {
  decorations: {
    activeMatchColorOverviewRuler: '#ff0000',
    matchOverviewRuler: '#00ffff'
  }
};

const DECORATIONS_B: ISearchOptions = {
  decorations: {
    activeMatchColorOverviewRuler: '#00ff00',
    matchOverviewRuler: '#00ffff'
  }
};

describe('SearchState', () => {
  let state: SearchState;

  beforeEach(() => {
    state = new SearchState();
  });

  describe('didOptionsChange', () => {
    it('should detect caseSensitive changes', () => {
      state.lastSearchOptions = { caseSensitive: false };
      assert.strictEqual(state.didOptionsChange({ caseSensitive: true }), true);
    });

    it('should detect decoration option changes', () => {
      state.lastSearchOptions = DECORATIONS_A;
      assert.strictEqual(state.didOptionsChange(DECORATIONS_B), true);
    });

    it('should return false when semantic options are unchanged', () => {
      const options: ISearchOptions = { caseSensitive: false, regex: false, wholeWord: false };
      state.lastSearchOptions = options;
      assert.strictEqual(state.didOptionsChange({ caseSensitive: false, regex: false, wholeWord: false }), false);
    });

    it('should treat omitted flags as equivalent to false', () => {
      state.lastSearchOptions = { caseSensitive: false, regex: false, wholeWord: false };
      assert.strictEqual(state.didOptionsChange({}), false);
    });
  });

  describe('shouldClearDecorations', () => {
    it('should clear when decorations are disabled after being enabled', () => {
      state.lastSearchOptions = DECORATIONS_A;
      assert.strictEqual(state.shouldClearDecorations({ caseSensitive: false }), true);
    });

    it('should not clear when decorations remain enabled', () => {
      state.lastSearchOptions = DECORATIONS_A;
      assert.strictEqual(state.shouldClearDecorations(DECORATIONS_A), false);
    });
  });

  describe('shouldUpdateHighlighting', () => {
    it('should update when options change for the same term', () => {
      state.cachedSearchTerm = 'test';
      state.lastSearchOptions = { caseSensitive: false, decorations: DECORATIONS_A.decorations };
      assert.strictEqual(state.shouldUpdateHighlighting('test', { caseSensitive: true, decorations: DECORATIONS_A.decorations }), true);
    });

    it('should not update without decorations', () => {
      state.cachedSearchTerm = 'test';
      state.lastSearchOptions = { caseSensitive: false };
      assert.strictEqual(state.shouldUpdateHighlighting('test', { caseSensitive: true }), false);
    });
  });
});
