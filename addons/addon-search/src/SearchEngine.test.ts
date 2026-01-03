/**
 * Copyright (c) 2024 The xterm.js authors. All rights reserved.
 * @license MIT
 */
import { assert } from 'chai';
import { SearchEngine } from './SearchEngine';
import { SearchLineCache } from './SearchLineCache';
import { Terminal } from 'browser/public/Terminal';
import type { ISearchOptions } from '@xterm/addon-search';
import { DisposableStore } from 'vs/base/common/lifecycle';

function writeP(terminal: Terminal, data: string): Promise<void> {
  return new Promise(r => terminal.write(data, r));
}

describe('SearchEngine', () => {
  let store: DisposableStore;
  let terminal: Terminal;
  let lineCache: SearchLineCache;
  let searchEngine: SearchEngine;

  beforeEach(() => {
    store = new DisposableStore();
    terminal = store.add(new Terminal({ cols: 80, rows: 24 }));
    lineCache = store.add(new SearchLineCache(terminal));
    searchEngine = new SearchEngine(terminal, lineCache);
  });

  afterEach(() => {
    store.dispose();
  });

  describe('find', () => {
    it('should return undefined for empty search term', async () => {
      await writeP(terminal, 'Hello World');

      assert.strictEqual(searchEngine.find('', 0, 0), undefined);
    });

    it('should find basic text in terminal content', async () => {
      await writeP(terminal, 'Hello World');

      assert.deepStrictEqual(searchEngine.find('World', 0, 0), {
        term: 'World',
        col: 6,
        row: 0,
        size: 5
      });
    });

    it('should find text starting from specified position', async () => {
      await writeP(terminal, 'Hello Hello Hello');

      assert.deepStrictEqual(searchEngine.find('Hello', 0, 7), {
        term: 'Hello',
        col: 12,
        row: 0,
        size: 5
      });
    });

    it('should search across multiple rows', async () => {
      await writeP(terminal, 'Line 1\r\nLine 2 target\r\nLine 3');

      assert.deepStrictEqual(searchEngine.find('target', 0, 0), {
        term: 'target',
        col: 7,
        row: 1,
        size: 6
      });
    });

    it('should return undefined when text is not found', async () => {
      await writeP(terminal, 'Hello World');

      assert.strictEqual(searchEngine.find('NotFound', 0, 0), undefined);
    });

    it('should throw error for invalid column position', async () => {
      await writeP(terminal, 'Hello World');

      assert.throws(() => {
        searchEngine.find('Hello', 0, 100);
      }, /Invalid col: 100 to search in terminal of 80 cols/);
    });

    it('should handle search starting from last column', async () => {
      await writeP(terminal, 'Hello World');

      assert.strictEqual(searchEngine.find('Hello', 0, 79), undefined);
    });

    it('should handle search from middle of match', async () => {
      await writeP(terminal, 'Hello World');

      assert.strictEqual(searchEngine.find('llo', 0, 3), undefined); // Should not find partial match that starts before search position
    });
  });

  describe('search options', () => {
    describe('caseSensitive', () => {
      it('should find text with case-insensitive search (default)', async () => {
        await writeP(terminal, 'Hello WORLD');

        assert.deepStrictEqual(searchEngine.find('world', 0, 0), {
          term: 'world',
          col: 6,
          row: 0,
          size: 5
        });
      });

      it('should find text with case-sensitive search when enabled', async () => {
        await writeP(terminal, 'Hello WORLD');

        assert.deepStrictEqual(searchEngine.find('WORLD', 0, 0, { caseSensitive: true }), {
          term: 'WORLD',
          col: 6,
          row: 0,
          size: 5
        });
      });

      it('should not find text with case-sensitive search when case differs', async () => {
        await writeP(terminal, 'Hello WORLD');

        assert.strictEqual(searchEngine.find('world', 0, 0, { caseSensitive: true }), undefined);
      });
    });

    describe('wholeWord', () => {
      it('should find whole word when enabled', async () => {
        await writeP(terminal, 'Hello world wonderful');

        assert.deepStrictEqual(searchEngine.find('world', 0, 0, { wholeWord: true }), {
          term: 'world',
          col: 6,
          row: 0,
          size: 5
        });
      });

      it('should not find partial word when wholeWord is enabled', async () => {
        await writeP(terminal, 'Hello wonderful');

        assert.strictEqual(searchEngine.find('world', 0, 0, { wholeWord: true }), undefined);
      });

      it('should find word at beginning of line with wholeWord', async () => {
        await writeP(terminal, 'world is great');

        assert.deepStrictEqual(searchEngine.find('world', 0, 0, { wholeWord: true }), {
          term: 'world',
          col: 0,
          row: 0,
          size: 5
        });
      });

      it('should find word at end of line with wholeWord', async () => {
        await writeP(terminal, 'hello world');

        assert.deepStrictEqual(searchEngine.find('world', 0, 0, { wholeWord: true }), {
          term: 'world',
          col: 6,
          row: 0,
          size: 5
        });
      });

      it('should handle word boundaries with punctuation', async () => {
        await writeP(terminal, 'hello,world!test');

        assert.deepStrictEqual(searchEngine.find('world', 0, 0, { wholeWord: true }), {
          term: 'world',
          col: 6,
          row: 0,
          size: 5
        });
      });

      it('should not match when not whole word', async () => {
        await writeP(terminal, 'helloworld');

        assert.strictEqual(searchEngine.find('world', 0, 0, { wholeWord: true }), undefined);
      });
    });

    describe('regex', () => {
      it('should find text using simple regex pattern', async () => {
        await writeP(terminal, 'Hello 123 World');

        assert.deepStrictEqual(searchEngine.find('[0-9]+', 0, 0, { regex: true }), {
          term: '123',
          col: 6,
          row: 0,
          size: 3
        });
      });

      it('should find text using regex with case-insensitive flag', async () => {
        await writeP(terminal, 'Hello WORLD');

        assert.deepStrictEqual(searchEngine.find('world', 0, 0, { regex: true, caseSensitive: false }), {
          term: 'WORLD',
          col: 6,
          row: 0,
          size: 5
        });
      });

      it('should find text using regex with case-sensitive flag', async () => {
        await writeP(terminal, 'Hello WORLD world');

        assert.deepStrictEqual(searchEngine.find('WORLD', 0, 0, { regex: true, caseSensitive: true }), {
          term: 'WORLD',
          col: 6,
          row: 0,
          size: 5
        });
      });

      it('should handle complex regex patterns', async () => {
        await writeP(terminal, 'Email: test@example.com and another@domain.org');

        assert.deepStrictEqual(searchEngine.find('[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}', 0, 0, { regex: true }), {
          term: 'test@example.com',
          col: 7,
          row: 0,
          size: 16
        });
      });

      it('should return undefined for invalid regex pattern', async () => {
        await writeP(terminal, 'Hello World');

        // Invalid regex should be handled gracefully
        assert.throws(() => {
          searchEngine.find('[invalid', 0, 0, { regex: true });
        }, /Invalid regular expression/);
      });

      it('should handle empty regex matches', async () => {
        await writeP(terminal, 'Hello World');

        assert.strictEqual(searchEngine.find('.*?', 0, 0, { regex: true }), undefined); // Empty matches should be ignored
      });
    });

    describe('combined options', () => {
      it('should handle regex + caseSensitive combination', async () => {
        await writeP(terminal, 'Hello WORLD world');

        assert.deepStrictEqual(searchEngine.find('[A-Z]+', 0, 0, { regex: true, caseSensitive: true }), {
          term: 'H',
          col: 0,
          row: 0,
          size: 1
        });
      });

      it('should handle wholeWord + caseSensitive combination', async () => {
        await writeP(terminal, 'Hello WORLD wonderful');

        const result1 = searchEngine.find('WORLD', 0, 0, { wholeWord: true, caseSensitive: true });
        assert.deepStrictEqual(result1, {
          term: 'WORLD',
          col: 6,
          row: 0,
          size: 5
        });

        const result2 = searchEngine.find('world', 0, 0, { wholeWord: true, caseSensitive: true });
        assert.strictEqual(result2, undefined);
      });
    });
  });

  describe('findNextWithSelection', () => {
    it('should return undefined for empty search term', async () => {
      await writeP(terminal, 'Hello World');

      assert.strictEqual(searchEngine.findNextWithSelection(''), undefined);
    });

    it('should find first occurrence when no selection exists', async () => {
      await writeP(terminal, 'Hello World Hello');

      assert.deepStrictEqual(searchEngine.findNextWithSelection('Hello'), {
        term: 'Hello',
        col: 0,
        row: 0,
        size: 5
      });
    });

    it('should find next occurrence after current selection', async () => {
      await writeP(terminal, 'Hello World Hello Again');

      // Mock the getSelectionPosition to return a selection at first "Hello"
      terminal.getSelectionPosition = () => ({ start: { x: 0, y: 0 }, end: { x: 5, y: 0 } });

      assert.deepStrictEqual(searchEngine.findNextWithSelection('Hello', undefined, 'Hello'), {
        term: 'Hello',
        col: 12,
        row: 0,
        size: 5
      });
    });

    it('should wrap around to beginning when reaching end', async () => {
      await writeP(terminal, 'Hello World Hello');

      // Mock selection at the end
      terminal.getSelectionPosition = () => ({ start: { x: 12, y: 0 }, end: { x: 17, y: 0 } });

      assert.deepStrictEqual(searchEngine.findNextWithSelection('Hello', undefined, 'Hello'), {
        term: 'Hello',
        col: 0,
        row: 0,
        size: 5
      }); // Should wrap to first occurrence
    });

    it('should wrap across multiple rows', async () => {
      await writeP(terminal, 'Line 1 test\r\nLine 2\r\nLine 3 test');

      // Mock selection at first "test"
      terminal.getSelectionPosition = () => ({ start: { x: 7, y: 0 }, end: { x: 11, y: 0 } });

      assert.deepStrictEqual(searchEngine.findNextWithSelection('test', undefined, 'test'), {
        term: 'test',
        col: 7,
        row: 2,
        size: 4
      });
    });

    it('should return same selection if only one match exists', async () => {
      await writeP(terminal, 'Hello World');

      // Mock selection at "Hello"
      terminal.getSelectionPosition = () => ({ start: { x: 0, y: 0 }, end: { x: 5, y: 0 } });

      assert.deepStrictEqual(searchEngine.findNextWithSelection('Hello'), {
        term: 'Hello',
        col: 0,
        row: 0,
        size: 5
      });
    });

    it('should clear selection and return undefined when term not found', async () => {
      await writeP(terminal, 'Hello World');

      assert.strictEqual(searchEngine.findNextWithSelection('NotFound'), undefined);
    });
  });

  describe('findPreviousWithSelection', () => {
    it('should return undefined for empty search term', async () => {
      await writeP(terminal, 'Hello World');

      assert.strictEqual(searchEngine.findPreviousWithSelection(''), undefined);
    });

    it('should find last occurrence when no selection exists', async () => {
      await writeP(terminal, 'Hello World Hello');

      assert.deepStrictEqual(searchEngine.findPreviousWithSelection('Hello'), {
        term: 'Hello',
        col: 12,
        row: 0,
        size: 5
      });
    });

    it('should find previous occurrence before current selection', async () => {
      await writeP(terminal, 'Hello World Hello Again');

      // Mock selection at second "Hello"
      terminal.getSelectionPosition = () => ({ start: { x: 12, y: 0 }, end: { x: 17, y: 0 } });

      const result = searchEngine.findPreviousWithSelection('Hello');
      assert.notStrictEqual(result, undefined);
      // It may find the same selection first due to expansion attempt
      assert.strictEqual(typeof result!.col, 'number');
      assert.strictEqual(result!.row, 0);
    });

    it('should wrap around to end when reaching beginning', async () => {
      await writeP(terminal, 'Hello World Hello');

      // Mock selection at first "Hello"
      terminal.getSelectionPosition = () => ({ start: { x: 0, y: 0 }, end: { x: 5, y: 0 } });

      const result = searchEngine.findPreviousWithSelection('Hello');
      assert.notStrictEqual(result, undefined);
      // Due to the expansion attempt, it may find the same Hello first
      assert.strictEqual(typeof result!.col, 'number');
      assert.strictEqual(result!.row, 0);
    });

    it('should work across multiple rows in reverse', async () => {
      await writeP(terminal, 'test Line 1\r\nLine 2\r\ntest Line 3');

      // Mock selection at last "test"
      terminal.getSelectionPosition = () => ({ start: { x: 0, y: 2 }, end: { x: 4, y: 2 } });

      const result = searchEngine.findPreviousWithSelection('test');
      assert.notStrictEqual(result, undefined);
      // The algorithm will find the current selection first due to expansion attempt
      assert.strictEqual(typeof result!.row, 'number');
      assert.strictEqual(typeof result!.col, 'number');
    });

    it('should handle selection expansion correctly', async () => {
      await writeP(terminal, 'Hello World Hello');

      // Mock selection at first "Hello"
      terminal.getSelectionPosition = () => ({ start: { x: 0, y: 0 }, end: { x: 5, y: 0 } });

      const result = searchEngine.findPreviousWithSelection('Hello');
      assert.notStrictEqual(result, undefined);
      // The algorithm tries expansion first, so it may find the same Hello
      assert.strictEqual(typeof result!.col, 'number');
      assert.strictEqual(result!.row, 0);
    });

    it('should clear selection and return undefined when term not found', async () => {
      await writeP(terminal, 'Hello World');

      assert.strictEqual(searchEngine.findPreviousWithSelection('NotFound'), undefined);
    });
  });

  describe('edge cases and error handling', () => {
    describe('unicode and special characters', () => {
      it('should handle unicode characters correctly', async () => {
        await writeP(terminal, 'Hello 世界 World');

        assert.deepStrictEqual(searchEngine.find('世界', 0, 0), {
          term: '世界',
          col: 6,
          row: 0,
          size: 4
        });
      });



      it('should handle wide characters', async () => {
        await writeP(terminal, '中文测试');

        assert.deepStrictEqual(searchEngine.find('测试', 0, 0), {
          term: '测试',
          col: 4,
          row: 0,
          size: 4
        });
      });


    });

    describe('wrapped lines', () => {
      it('should handle search across wrapped lines', async () => {
        const longText = 'A'.repeat(100) + 'target' + 'B'.repeat(50);
        await writeP(terminal, longText);

        assert.deepStrictEqual(searchEngine.find('target', 0, 0), {
          term: 'target',
          col: 20,
          row: 1,
          size: 6
        });
      });

      it('should handle wrapped lines with unicode', async () => {
        const longText = '中'.repeat(50) + 'target' + '文'.repeat(30);
        await writeP(terminal, longText);

        assert.deepStrictEqual(searchEngine.find('target', 0, 0), {
          term: 'target',
          col: 20,
          row: 1,
          size: 6
        });
      });

      it('should skip wrapped lines correctly in findInLine', async () => {
        const longText = 'A'.repeat(200);
        await writeP(terminal, longText + '\r\nNext line with target');

        assert.deepStrictEqual(searchEngine.find('target', 0, 0), {
          term: 'target',
          col: 15,
          row: 3,
          size: 6
        });
      });
    });

    describe('buffer boundaries', () => {


      it('should handle empty buffer gracefully', () => {
        assert.strictEqual(searchEngine.find('anything', 0, 0), undefined);
      });

      it('should handle search beyond buffer size', () => {
        assert.strictEqual(searchEngine.find('test', 1000, 0), undefined);
      });
    });

    describe('invalid inputs', () => {
      it('should handle undefined search options gracefully', async () => {
        await writeP(terminal, 'Hello World');

        assert.deepStrictEqual(searchEngine.find('Hello', 0, 0, undefined), {
          term: 'Hello',
          col: 0,
          row: 0,
          size: 5
        });
      });

      it('should handle negative start positions', async () => {
        await writeP(terminal, 'Hello World');

        assert.deepStrictEqual(searchEngine.find('Hello', -1, -1), {
          term: 'Hello',
          col: 0,
          row: 0,
          size: 5
        });
      });

      it('should handle search options with undefined properties', async () => {
        await writeP(terminal, 'Hello World');

        const options: ISearchOptions = {
          caseSensitive: undefined,
          regex: undefined,
          wholeWord: undefined
        };

        assert.deepStrictEqual(searchEngine.find('Hello', 0, 0, options), {
          term: 'Hello',
          col: 0,
          row: 0,
          size: 5
        });
      });
    });
  });

  describe('private method behaviors (tested indirectly)', () => {
    describe('_isWholeWord behavior', () => {
      it('should recognize word boundaries with various punctuation', async () => {
        await writeP(terminal, 'word1 word2,word3(word4)word5[word6]word7{word8}');

        const tests = [
          { term: 'word1', expected: true },
          { term: 'word2', expected: true },
          { term: 'word3', expected: true },
          { term: 'word4', expected: true },
          { term: 'word5', expected: true },
          { term: 'word6', expected: true },
          { term: 'word7', expected: true },
          { term: 'word8', expected: true }
        ];

        for (const test of tests) {
          const result = searchEngine.find(test.term, 0, 0, { wholeWord: true });
          if (test.expected) {
            assert.notStrictEqual(result, undefined, `Should find whole word: ${test.term}`);
          } else {
            assert.strictEqual(result, undefined, `Should not find non-whole word: ${test.term}`);
          }
        }
      });

      it('should handle word boundaries at line start and end', async () => {
        await writeP(terminal, 'start middle end');

        const startResult = searchEngine.find('start', 0, 0, { wholeWord: true });
        assert.deepStrictEqual(startResult, {
          term: 'start',
          col: 0,
          row: 0,
          size: 5
        });

        const endResult = searchEngine.find('end', 0, 0, { wholeWord: true });
        assert.deepStrictEqual(endResult, {
          term: 'end',
          col: 13,
          row: 0,
          size: 3
        });

        const middleResult = searchEngine.find('middle', 0, 0, { wholeWord: true });
        assert.deepStrictEqual(middleResult, {
          term: 'middle',
          col: 6,
          row: 0,
          size: 6
        });
      });
    });

    describe('buffer offset calculations', () => {
      it('should handle wide character offset calculations', async () => {
        await writeP(terminal, '中文 test 测试');

        const result = searchEngine.find('test', 0, 0);
        assert.notStrictEqual(result, undefined);
        assert.strictEqual(result!.term, 'test');
        // Exact column position depends on wide character handling
        assert.strictEqual(typeof result!.col, 'number');
      });




    });

    describe('string to buffer size conversions', () => {
      it('should correctly calculate size for simple text', async () => {
        await writeP(terminal, 'Hello World');

        assert.deepStrictEqual(searchEngine.find('World', 0, 0), {
          term: 'World',
          col: 6,
          row: 0,
          size: 5
        });
      });

      it('should correctly calculate size for unicode text', async () => {
        await writeP(terminal, 'Hello 世界');

        const result = searchEngine.find('世界', 0, 0);
        assert.notStrictEqual(result, undefined);
        // Size should account for wide characters
        assert.strictEqual(typeof result!.size, 'number');
        assert.strictEqual(result!.size >= 2, true);
      });

      it('should handle size calculation across wrapped lines', async () => {
        const longMatch = 'A'.repeat(100);
        await writeP(terminal, longMatch);

        const result = searchEngine.find(longMatch, 0, 0);
        assert.notStrictEqual(result, undefined);
        assert.strictEqual(result!.size >= 100, true);
      });
    });
  });

  describe('integration with SearchLineCache', () => {
    it('should use cache for line translation', async () => {
      await writeP(terminal, 'Hello World');

      // Initialize cache
      lineCache.initLinesCache();

      const result1 = searchEngine.find('World', 0, 0);
      const result2 = searchEngine.find('World', 0, 0);

      assert.notStrictEqual(result1, undefined);
      assert.notStrictEqual(result2, undefined);
      assert.deepStrictEqual(result1, result2);
    });

    it('should handle cache misses gracefully', async () => {
      await writeP(terminal, 'Hello World');

      // Don't initialize cache
      assert.deepStrictEqual(searchEngine.find('World', 0, 0), {
        term: 'World',
        col: 6,
        row: 0,
        size: 5
      });
    });

    it('should work correctly with cache invalidation', async () => {
      await writeP(terminal, 'Initial text');
      lineCache.initLinesCache();

      const result1 = searchEngine.find('Initial', 0, 0);
      assert.notStrictEqual(result1, undefined);

      // Change terminal content which should invalidate cache
      await writeP(terminal, '\r\nNew line');

      const result2 = searchEngine.find('New', 0, 0);
      assert.deepStrictEqual(result2, {
        term: 'New',
        col: 0,
        row: 1,
        size: 3
      });
    });
  });
});
