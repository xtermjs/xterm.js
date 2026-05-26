/**
 * Copyright (c) 2026 The xterm.js authors. All rights reserved.
 * @license MIT
 */
import { assert } from 'chai';
import { SearchResultTracker } from './SearchResultTracker';
import type { ISearchResult } from './SearchEngine';

describe('SearchResultTracker', () => {
  let tracker: SearchResultTracker;

  beforeEach(() => {
    tracker = new SearchResultTracker();
  });

  afterEach(() => {
    tracker.dispose();
  });

  describe('updateResults', () => {
    it('should store results without copying when within limit', () => {
      const results: ISearchResult[] = [{ term: 'a', row: 0, col: 0, size: 1 }];
      tracker.updateResults(results, 10);
      assert.strictEqual(tracker.searchResults, results);
    });

    it('should cap results at maxResults', () => {
      const results: ISearchResult[] = [
        { term: 'a', row: 0, col: 0, size: 1 },
        { term: 'b', row: 0, col: 1, size: 1 },
        { term: 'c', row: 0, col: 2, size: 1 }
      ];
      tracker.updateResults(results, 2);
      assert.strictEqual(tracker.searchResults.length, 2);
    });
  });

  describe('findResultIndex', () => {
    it('should return the index of a tracked result', () => {
      const results: ISearchResult[] = [
        { term: 'a', row: 0, col: 0, size: 1 },
        { term: 'b', row: 0, col: 2, size: 1 }
      ];
      tracker.updateResults(results, 10);
      assert.strictEqual(tracker.findResultIndex(results[1]), 1);
    });

    it('should return -1 when the result is not tracked', () => {
      tracker.updateResults([{ term: 'a', row: 0, col: 0, size: 1 }], 10);
      assert.strictEqual(tracker.findResultIndex({ term: 'z', row: 1, col: 0, size: 1 }), -1);
    });
  });

  describe('fireResultsChanged', () => {
    it('should not fire when decorations are disabled', () => {
      let fired = false;
      tracker.onDidChangeResults(() => fired = true);
      tracker.updateResults([{ term: 'a', row: 0, col: 0, size: 1 }], 10);
      tracker.fireResultsChanged(false);
      assert.strictEqual(fired, false);
    });
  });

  describe('selectedDecoration', () => {
    it('should dispose the previous decoration when replaced', () => {
      let disposeCount = 0;
      const first = { match: { term: 'a', row: 0, col: 0, size: 1 }, dispose: () => disposeCount++ };
      const second = { match: { term: 'b', row: 0, col: 1, size: 1 }, dispose: () => {} };
      tracker.selectedDecoration = first;
      tracker.selectedDecoration = second;
      assert.strictEqual(disposeCount, 1);
    });
  });
});
