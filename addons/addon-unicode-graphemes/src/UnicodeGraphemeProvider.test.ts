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
      assert.deepEqual(clusters(provider, '\u{1F6D1}\u200D\u{1F6D1}'), ['\u{1F6D1}\u200D\u{1F6D1}']);
      assert.deepEqual(clusters(provider, '\u{1F6D1}\u0308\u200D\u{1F6D1}'), ['\u{1F6D1}\u0308\u200D\u{1F6D1}']);
      assert.deepEqual(clusters(provider, '\u{1F469}\u200D\u{1F469}\u200D\u{1F466}'), ['\u{1F469}\u200D\u{1F469}\u200D\u{1F466}']);
    });
    it('should not join a pictograph to a ZWJ that does not follow a pictograph', () => {
      // Cases from GraphemeBreakTest.txt
      assert.deepEqual(clusters(provider, '\u200D\u231A'), ['\u200D', '\u231A']);
      assert.deepEqual(clusters(provider, 'a\u200D\u{1F6D1}'), ['a\u200D', '\u{1F6D1}']);
      assert.deepEqual(clusters(provider, '\u00E4\u200D\u{1F6D1}'), ['\u00E4\u200D', '\u{1F6D1}']);
    });
    it('should count the width of a pictograph after a non-emoji ZWJ', () => {
      assert.equal(service.getStringCellWidth('a\u200D\u{1F6D1}'), 3);
      assert.equal(service.getStringCellWidth('\u{1F6D1}\u200D\u{1F6D1}'), 2);
    });
  });

  describe('GB9c (Indic_Conjunct_Break)', () => {
    it('should join an Indic conjunct', () => {
      // DEVANAGARI KA + VIRAMA + SSA
      assert.deepEqual(clusters(provider, '\u0915\u094D\u0937'), ['\u0915\u094D\u0937']);
      // Cases from GraphemeBreakTest.txt
      assert.deepEqual(clusters(provider, '\u0915\u094D\u200D\u0924'), ['\u0915\u094D\u200D\u0924']);
      assert.deepEqual(clusters(provider, '\u0915\u094D\u094D\u0924'), ['\u0915\u094D\u094D\u0924']);
      assert.deepEqual(clusters(provider, '\u0915\u093C\u200D\u094D\u0924'), ['\u0915\u093C\u200D\u094D\u0924']);
      assert.deepEqual(clusters(provider, 'a\u094D\u0924'), ['a\u094D\u0924']);
    });
    it('should not join a linker to a following character that is not a consonant', () => {
      assert.deepEqual(clusters(provider, '\u0915\u094Da'), ['\u0915\u094D', 'a']);
    });
    it('should count an Indic conjunct as a single cell', () => {
      assert.equal(service.getStringCellWidth('\u0915\u094D\u0937'), 1);
    });
  });

  describe('Unicode 18 data', () => {
    it('should join a combining mark added after Unicode 15', () => {
      // ORIYA LETTER KA + ORIYA SIGN DOT ABOVE (Unicode 16, Grapheme_Cluster_Break=Extend)
      assert.deepEqual(clusters(provider, '\u0B15\u0B53'), ['\u0B15\u0B53']);
      assert.equal(service.getStringCellWidth('\u0B15\u0B53'), 1);
    });
    it('should treat characters that became East_Asian_Width=W after Unicode 15 as wide', () => {
      // TRIGRAM FOR HEAVEN (East_Asian_Width=W since Unicode 16)
      assert.equal(service.getStringCellWidth('\u2630'), 2);
    });
  });
});
