import * as opentype from 'opentype.js';
import LRUCache = require('lru-cache');

import { IFont, ILigatureData, IFlattenedLookupTree, ILookupTree, IOptions } from './types';
import mergeTrees from './merge';
import walkTree from './walk';
import mergeRange from './mergeRange';

import buildTreeGsubType6Format1 from './processors/6-1';
import buildTreeGsubType6Format2 from './processors/6-2';
import buildTreeGsubType6Format3 from './processors/6-3';
import buildTreeGsubType8Format1 from './processors/8-1';
import flatten from './flatten';

class FontImpl implements IFont {
  private _font: opentype.Font;
  private _lookupTrees: { tree: IFlattenedLookupTree, processForward: boolean }[] = [];
  private _glyphLookups: { [glyphId: string]: number[] } = {};
  private _cache?: LRUCache<string, ILigatureData | [number, number][]>;

  constructor(font: opentype.Font, options: Required<IOptions>) {
    this._font = font;

    if (options.cacheSize > 0) {
      this._cache = new LRUCache({
        max: options.cacheSize,
        length: ((val: ILigatureData | [number, number][], key: string) => key.length) as any
      });
    }

    const caltFeatures = this._font.tables.gsub && this._font.tables.gsub.features.filter((f: { tag: string }) => f.tag === 'calt') || [];
    const lookupIndices: number[] = caltFeatures
      .reduce((acc: number[], val: { feature: { lookupListIndexes: number[] } }) => [...acc, ...val.feature.lookupListIndexes], []);

    const allLookups = this._font.tables.gsub && this._font.tables.gsub.lookups || [];
    const lookupGroups = allLookups.filter((l: unknown, i: number) => lookupIndices.some(idx => idx === i));

    for (const [index, lookup] of lookupGroups.entries()) {
      const trees: ILookupTree[] = [];
      switch (lookup.lookupType) {
        case 6:
          for (const [index, table] of lookup.subtables.entries()) {
            switch (table.substFormat) {
              case 1:
                trees.push(buildTreeGsubType6Format1(table, allLookups, index));
                break;
              case 2:
                trees.push(buildTreeGsubType6Format2(table, allLookups, index));
                break;
              case 3:
                trees.push(buildTreeGsubType6Format3(table, allLookups, index));
                break;
            }
          }
          break;
        case 8:
          for (const [index, table] of lookup.subtables.entries()) {
            trees.push(buildTreeGsubType8Format1(table, index));
          }
          break;
      }

      const tree = flatten(mergeTrees(trees));

      this._lookupTrees.push({
        tree,
        processForward: lookup.lookupType !== 8
      });

      for (const glyphId of Object.keys(tree)) {
        if (!this._glyphLookups[glyphId]) {
          this._glyphLookups[glyphId] = [];
        }

        this._glyphLookups[glyphId].push(index);
      }
    }
  }

  public findLigatures(text: string): ILigatureData {
    const cached = this._cache && this._cache.get(text);
    if (cached && !Array.isArray(cached)) {
      return cached;
    }

    const glyphIds: number[] = [];
    for (const char of text) {
      glyphIds.push(this._font.charToGlyphIndex(char));
    }

    // If there are no lookup groups, there's no point looking for
    // replacements. This gives us a minor performance boost for fonts with
    // no ligatures
    if (this._lookupTrees.length === 0) {
      return {
        inputGlyphs: glyphIds,
        outputGlyphs: glyphIds,
        contextRanges: []
      };
    }

    const result = this._findInternal(glyphIds.slice());
    const finalResult: ILigatureData = {
      inputGlyphs: glyphIds,
      outputGlyphs: result.sequence,
      contextRanges: result.ranges
    };
    if (this._cache) {
      this._cache.set(text, finalResult);
    }

    return finalResult;
  }

  public findLigatureRanges(text: string): [number, number][] {
    // Short circuit the process if there are no possible ligatures in the
    // font
    if (this._lookupTrees.length === 0) {
      return [];
    }

    const cached = this._cache && this._cache.get(text);
    if (cached) {
      return Array.isArray(cached) ? cached : cached.contextRanges;
    }

    const glyphIds: number[] = [];
    for (const char of text) {
      glyphIds.push(this._font.charToGlyphIndex(char));
    }

    const result = this._findInternal(glyphIds);
    if (this._cache) {
      this._cache.set(text, result.ranges);
    }

    return result.ranges;
  }

  private _findInternal(sequence: number[]): { sequence: number[], ranges: [number, number][] } {
    const ranges: [number, number][] = [];

    let nextLookup = this._getNextLookup(sequence, 0);
    while (nextLookup.index !== null) {
      const lookup = this._lookupTrees[nextLookup.index];
      if (lookup.processForward) {
        let lastGlyphIndex = nextLookup.last;
        for (let i = nextLookup.first; i < lastGlyphIndex; i++) {
          const result = walkTree(lookup.tree, sequence, i, i);
          if (result) {
            for (let j = 0; j < result.substitutions.length; j++) {
              const sub = result.substitutions[j];
              if (sub !== null) {
                sequence[i + j] = sub;
              }
            }

            mergeRange(
              ranges,
              result.contextRange[0] + i,
              result.contextRange[1] + i
            );

            // Substitutions can end up extending the search range
            if (i + result.length >= lastGlyphIndex) {
              lastGlyphIndex = i + result.length + 1;
            }

            i += result.length - 1;
          }
        }
      } else {
        // We don't need to do the lastGlyphIndex tracking here because
        // reverse processing isn't allowed to replace more than one
        // character at a time.
        for (let i = nextLookup.last - 1; i >= nextLookup.first; i--) {
          const result = walkTree(lookup.tree, sequence, i, i);
          if (result) {
            for (let j = 0; j < result.substitutions.length; j++) {
              const sub = result.substitutions[j];
              if (sub !== null) {
                sequence[i + j] = sub;
              }
            }

            mergeRange(
              ranges,
              result.contextRange[0] + i,
              result.contextRange[1] + i
            );

            i -= result.length - 1;
          }
        }
      }

      nextLookup = this._getNextLookup(sequence, nextLookup.index + 1);
    }

    return { sequence, ranges };
  }

  /**
   * Returns the lookup and glyph range for the first lookup that might
   * contain a match.
   *
   * @param sequence Input glyph sequence
   * @param start The first input to try
   */
  private _getNextLookup(sequence: number[], start: number): { index: number | null, first: number, last: number } {
    const result: { index: number | null, first: number, last: number } = {
      index: null,
      first: Infinity,
      last: -1
    };

    // Loop through each glyph and find the first valid lookup for it
    for (let i = 0; i < sequence.length; i++) {
      const lookups = this._glyphLookups[sequence[i]];
      if (!lookups) {
        continue;
      }

      for (let j = 0; j < lookups.length; j++) {
        const lookupIndex = lookups[j];
        if (lookupIndex >= start) {
          // Update the lookup information if it's the one we're
          // storing or earlier than it.
          if (result.index === null || lookupIndex <= result.index) {
            result.index = lookupIndex;

            if (result.first > i) {
              result.first = i;
            }

            result.last = i + 1;
          }

          break;
        }
      }
    }

    return result;
  }
}

/**
 * Load the font from it's binary data. The returned value can be used to find
 * ligatures for the font.
 *
 * @param buffer ArrayBuffer of the font to load
 */
export function loadBuffer(buffer: ArrayBuffer, options?: IOptions): IFont {
  const font = opentype.parse(buffer);
  return new FontImpl(font, {
    cacheSize: 0,
    ...options
  });
}

export { IFont as Font, ILigatureData as LigatureData, IOptions as Options };
