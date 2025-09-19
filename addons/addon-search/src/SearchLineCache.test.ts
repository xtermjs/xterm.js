/**
 * Copyright (c) 2024 The xterm.js authors. All rights reserved.
 * @license MIT
 */
import { assert } from 'chai';
import { SearchLineCache, LineCacheEntry } from './SearchLineCache';
import { Terminal } from 'browser/public/Terminal';
import { timeout } from 'vs/base/common/async';

function writeP(terminal: Terminal, data: string): Promise<void> {
  return new Promise(r => terminal.write(data, r));
}

describe('SearchLineCache', () => {
  let terminal: Terminal;
  let cache: SearchLineCache;

  beforeEach(() => {
    terminal = new Terminal({ cols: 80, rows: 24 });
    cache = new SearchLineCache(terminal);
  });

  afterEach(() => {
    cache.dispose();
    terminal.dispose();
  });

  describe('constructor', () => {
    it('should create a SearchLineCache instance', () => {
      assert.instanceOf(cache, SearchLineCache);
    });

    it('should start with no cache initialized', () => {
      assert.equal(cache.getLineFromCache(0), undefined);
    });
  });

  describe('initLinesCache', () => {
    it('should initialize the lines cache array', () => {
      cache.initLinesCache();
      assert.equal(cache.getLineFromCache(0), undefined, 'cache should be initialized but empty');
    });

    it('should not reinitialize if cache already exists', () => {
      cache.initLinesCache();
      cache.setLineInCache(0, ['test', [0]]);

      cache.initLinesCache();

      const entry = cache.getLineFromCache(0);
      assert.deepEqual(entry, ['test', [0]], 'cache should still contain the previously set entry');
    });

    it('should set up TTL timeout', () => {
      cache.initLinesCache();
      cache.setLineInCache(0, ['test', [0]]);

      assert.deepEqual(cache.getLineFromCache(0), ['test', [0]], 'entry should exist after initialization');
    });
  });

  describe('getLineFromCache', () => {
    it('should return undefined when cache is not initialized', () => {
      assert.equal(cache.getLineFromCache(0), undefined);
      assert.equal(cache.getLineFromCache(10), undefined);
    });

    it('should return undefined for unset entries when cache is initialized', () => {
      cache.initLinesCache();
      assert.equal(cache.getLineFromCache(0), undefined);
      assert.equal(cache.getLineFromCache(50), undefined);
    });

    it('should return cached entries', () => {
      cache.initLinesCache();
      const entry: LineCacheEntry = ['test content', [0]];
      cache.setLineInCache(5, entry);

      assert.deepEqual(cache.getLineFromCache(5), entry);
    });
  });

  describe('setLineInCache', () => {
    it('should not set entries when cache is not initialized', () => {
      const entry: LineCacheEntry = ['test content', [0]];
      cache.setLineInCache(0, entry);

      assert.equal(cache.getLineFromCache(0), undefined);
    });

    it('should set entries when cache is initialized', () => {
      cache.initLinesCache();
      const entry: LineCacheEntry = ['test content', [0]];
      cache.setLineInCache(10, entry);

      assert.deepEqual(cache.getLineFromCache(10), entry);
    });

    it('should overwrite existing entries', () => {
      cache.initLinesCache();
      const entry1: LineCacheEntry = ['first content', [0]];
      const entry2: LineCacheEntry = ['second content', [0]];

      cache.setLineInCache(0, entry1);
      assert.deepEqual(cache.getLineFromCache(0), entry1);

      cache.setLineInCache(0, entry2);
      assert.deepEqual(cache.getLineFromCache(0), entry2);
    });
  });

  describe('translateBufferLineToStringWithWrap', () => {
    it('should translate a single line without wrapping', async () => {
      await writeP(terminal, 'Hello World');
      const result = cache.translateBufferLineToStringWithWrap(0, true);
      assert.equal(result[0], 'Hello World');
      assert.deepEqual(result[1], [0]);
    });

    it('should handle trimRight parameter', async () => {
      await writeP(terminal, 'Hello World   ');
      const resultTrimmed = cache.translateBufferLineToStringWithWrap(0, true);
      const resultNotTrimmed = cache.translateBufferLineToStringWithWrap(0, false);

      assert.equal(resultTrimmed[0].trimEnd(), 'Hello World');
      assert.isTrue(resultNotTrimmed[0].startsWith('Hello World   '));
      assert.isTrue(resultNotTrimmed[0].length > resultTrimmed[0].length, 'non-trimmed result should be longer');
    });

    it('should handle wrapped lines', async () => {
      const longText = 'A'.repeat(200);
      await writeP(terminal, longText);
      const result = cache.translateBufferLineToStringWithWrap(0, true);
      assert.equal(result[0], longText);
      assert.isTrue(result[1].length > 1, 'should have multiple offsets due to wrapping');
      assert.equal(result[1][0], 0, 'first offset should be 0');
    });

    it('should handle wide characters', async () => {
      await writeP(terminal, 'Hello 世界');
      const result = cache.translateBufferLineToStringWithWrap(0, true);
      assert.equal(result[0], 'Hello 世界');
      assert.deepEqual(result[1], [0]);
    });

    it('should handle empty lines', () => {
      const result = cache.translateBufferLineToStringWithWrap(0, true);
      assert.equal(result[0], '');
      assert.deepEqual(result[1], [0]);
    });

    it('should handle lines beyond buffer', () => {
      const result = cache.translateBufferLineToStringWithWrap(1000, true);
      assert.equal(result[0], '');
      assert.deepEqual(result[1], [0]);
    });

    it('should handle complex wrapped content', async () => {
      await writeP(terminal, 'Line 1\r\n');
      await writeP(terminal, 'Line 2 with some longer content that might wrap\r\n');
      await writeP(terminal, 'Line 3');

      const result1 = cache.translateBufferLineToStringWithWrap(0, true);
      const result2 = cache.translateBufferLineToStringWithWrap(1, true);
      const result3 = cache.translateBufferLineToStringWithWrap(2, true);

      assert.equal(result1[0], 'Line 1');
      assert.equal(result2[0], 'Line 2 with some longer content that might wrap');
      assert.equal(result3[0], 'Line 3');
    });
  });

  describe('cache invalidation', () => {
    it('should invalidate cache on line feed', async () => {
      cache.initLinesCache();
      cache.setLineInCache(0, ['test', [0]]);

      assert.deepEqual(cache.getLineFromCache(0), ['test', [0]]);

      terminal.write('test\r\n');

      await timeout(10);
      assert.equal(cache.getLineFromCache(0), undefined);
    });

    it('should invalidate cache on cursor move', async () => {
      cache.initLinesCache();
      cache.setLineInCache(0, ['test', [0]]);

      assert.deepEqual(cache.getLineFromCache(0), ['test', [0]]);

      await writeP(terminal, 'some text');
      await timeout(10);
      assert.equal(cache.getLineFromCache(0), undefined);
    });

    it('should invalidate cache on resize', async () => {
      cache.initLinesCache();
      cache.setLineInCache(0, ['test', [0]]);

      assert.deepEqual(cache.getLineFromCache(0), ['test', [0]]);

      terminal.resize(100, 30);

      await timeout(10);
      assert.equal(cache.getLineFromCache(0), undefined);
    });
  });

  describe('disposal', () => {
    it('should clean up resources on dispose', () => {
      cache.initLinesCache();
      cache.setLineInCache(0, ['test', [0]]);

      assert.deepEqual(cache.getLineFromCache(0), ['test', [0]]);

      cache.dispose();

      assert.equal(cache.getLineFromCache(0), undefined, 'cache should be destroyed after disposal');
    });

    it('should be safe to dispose multiple times', () => {
      cache.initLinesCache();
      cache.dispose();
      cache.dispose();

      assert.equal(cache.getLineFromCache(0), undefined);
    });
  });

  describe('LineCacheEntry type', () => {
    it('should handle complex line offsets', () => {
      const entry: LineCacheEntry = [
        'A very long line that wraps multiple times across several terminal lines',
        [0, 20, 40, 60]
      ];

      cache.initLinesCache();
      cache.setLineInCache(0, entry);

      const retrieved = cache.getLineFromCache(0);
      assert.deepEqual(retrieved, entry);
      assert.equal(retrieved![0].length, 72);
      assert.equal(retrieved![1].length, 4);
    });

    it('should handle unicode characters in cache entries', () => {
      const entry: LineCacheEntry = [
        'Hello 世界 🌍 测试',
        [0]
      ];

      cache.initLinesCache();
      cache.setLineInCache(0, entry);

      const retrieved = cache.getLineFromCache(0);
      assert.deepEqual(retrieved, entry);
      assert.equal(retrieved![0], 'Hello 世界 🌍 测试');
    });
  });

  describe('integration with real terminal content', () => {
    it('should correctly translate real buffer content', async () => {
      await writeP(terminal, 'Hello World');
      const cached = cache.translateBufferLineToStringWithWrap(0, true);
      const directTranslation = terminal.buffer.active.getLine(0)?.translateToString(true) || '';

      assert.equal(cached[0], directTranslation);
    });

    it('should handle real wrapped content correctly', async () => {
      const longContent = 'This is a very long line that will definitely wrap around in an 80 column terminal and should be handled correctly by the cache';
      await writeP(terminal, longContent);
      const result = cache.translateBufferLineToStringWithWrap(0, true);
      assert.equal(result[0], longContent);
      assert.isTrue(result[1].length > 1, 'should have wrapped');
    });

    it('should work with real escape sequences', async () => {
      await writeP(terminal, 'Before\x1b[31mRed Text\x1b[0mAfter');
      const result = cache.translateBufferLineToStringWithWrap(0, true);
      assert.include(result[0], 'Before');
      assert.include(result[0], 'Red Text');
      assert.include(result[0], 'After');
    });
  });
});
