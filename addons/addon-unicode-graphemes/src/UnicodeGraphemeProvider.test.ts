/**
 * Copyright (c) 2026 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import { assert } from 'chai';
import { UnicodeCharProperties } from 'common/services/Services';
import { UnicodeService } from 'common/services/UnicodeService';
import { UnicodeGraphemeProvider } from './UnicodeGraphemeProvider';

/**
 * Splits a string into grapheme clusters as seen by the provider.
 */
function clusters(provider: UnicodeGraphemeProvider, s: string): string[] {
  const result: string[] = [];
  let preceding: UnicodeCharProperties = 0;
  for (const ch of s) {
    preceding = provider.charProperties(ch.codePointAt(0)!, preceding);
    if (result.length && UnicodeService.extractShouldJoin(preceding)) {
      result[result.length - 1] += ch;
    } else {
      result.push(ch);
    }
  }
  return result;
}

describe('UnicodeGraphemeProvider', () => {
  let provider: UnicodeGraphemeProvider;
  let service: UnicodeService;

  beforeEach(() => {
    provider = new UnicodeGraphemeProvider();
    service = new UnicodeService();
    service.register(provider);
    service.activeVersion = provider.version;
  });

  describe('GB11 (ExtPict Extend* ZWJ x ExtPict)', () => {
    it('should join an emoji ZWJ sequence', () => {
      assert.deepEqual(clusters(provider, '\u{1F6D1}‍\u{1F6D1}'), ['\u{1F6D1}‍\u{1F6D1}']);
      assert.deepEqual(clusters(provider, '\u{1F6D1}̈‍\u{1F6D1}'), ['\u{1F6D1}̈‍\u{1F6D1}']);
      assert.deepEqual(clusters(provider, '\u{1F469}‍\u{1F469}‍\u{1F466}'), ['\u{1F469}‍\u{1F469}‍\u{1F466}']);
    });
    it('should not join a pictograph to a ZWJ that does not follow a pictograph', () => {
      // Cases from GraphemeBreakTest.txt
      assert.deepEqual(clusters(provider, '‍⌚'), ['‍', '⌚']);
      assert.deepEqual(clusters(provider, 'a‍\u{1F6D1}'), ['a‍', '\u{1F6D1}']);
      assert.deepEqual(clusters(provider, 'a‍✁'), ['a‍', '✁']);
      assert.deepEqual(clusters(provider, 'ä‍\u{1F6D1}'), ['ä‍', '\u{1F6D1}']);
      // Devanagari KA + VIRAMA + ZWJ (half form) followed by an emoji
      assert.deepEqual(clusters(provider, 'क्‍\u{1F600}'), ['क्‍', '\u{1F600}']);
    });
    it('should count the width of a pictograph after a non-emoji ZWJ', () => {
      assert.equal(service.getStringCellWidth('a‍\u{1F6D1}'), 3);
      assert.equal(service.getStringCellWidth('\u{1F6D1}‍\u{1F6D1}'), 2);
    });
  });
});
