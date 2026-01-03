import { ReverseChainingContextualSingleSubstitutionTable } from '../tables';
import { LookupTree, LookupTreeEntry } from '../types';

import { listGlyphsByIndex } from './coverage';
import { processLookaheadPosition, processBacktrackPosition, EntryMeta } from './helper';

/**
 * Build lookup tree for GSUB lookup table 8, format 1.
 * https://docs.microsoft.com/en-us/typography/opentype/spec/gsub#81-reverse-chaining-contextual-single-substitution-format-1-coverage-based-glyph-contexts
 *
 * @param table JSON representation of the table
 * @param tableIndex Index of this table in the overall lookup
 */
export default function buildTree(table: ReverseChainingContextualSingleSubstitutionTable, tableIndex: number): LookupTree {
    const result: LookupTree = {
        individual: {},
        range: []
    };

    const glyphs = listGlyphsByIndex(table.coverage);

    for (const { glyphId, index } of glyphs) {
        const initialEntry: LookupTreeEntry = {};
        if (Array.isArray(glyphId)) {
            result.range.push({
                entry: initialEntry,
                range: glyphId
            });
        } else {
            result.individual[glyphId] = initialEntry;
        }

        let currentEntries: EntryMeta[] = [{
            entry: initialEntry,
            substitutions: [table.substitutes[index]]
        }];

        // We walk forward, then backward
        for (const coverage of table.lookaheadCoverage) {
            currentEntries = processLookaheadPosition(
                listGlyphsByIndex(coverage).map(glyph => glyph.glyphId),
                currentEntries
            );
        }

        for (const coverage of table.backtrackCoverage) {
            currentEntries = processBacktrackPosition(
                listGlyphsByIndex(coverage).map(glyph => glyph.glyphId),
                currentEntries
            );
        }

        // When we get to the end, insert the lookup information
        for (const { entry, substitutions } of currentEntries) {
            entry.lookup = {
                substitutions,
                index: tableIndex,
                subIndex: 0,
                length: 1,
                contextRange: [
                    -1 * table.backtrackCoverage.length,
                    1 + table.lookaheadCoverage.length
                ]
            };
        }
    }

    return result;
}
