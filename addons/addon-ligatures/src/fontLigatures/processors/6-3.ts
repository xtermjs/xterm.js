import { ChainingContextualSubstitutionTable, Lookup } from '../tables';
import { LookupTree } from '../types';

import { listGlyphsByIndex } from './coverage';
import { processInputPosition, processLookaheadPosition, processBacktrackPosition, getInputTree, EntryMeta } from './helper';

/**
 * Build lookup tree for GSUB lookup table 6, format 3.
 * https://docs.microsoft.com/en-us/typography/opentype/spec/gsub#63-chaining-context-substitution-format-3-coverage-based-glyph-contexts
 *
 * @param table JSON representation of the table
 * @param lookups List of lookup tables
 * @param tableIndex Index of this table in the overall lookup
 */
export default function buildTree(table: ChainingContextualSubstitutionTable.Format3, lookups: Lookup[], tableIndex: number): LookupTree {
    const result: LookupTree = {
        individual: {},
        range: []
    };

    const firstGlyphs = listGlyphsByIndex(table.inputCoverage[0]);

    for (const { glyphId } of firstGlyphs) {
        let currentEntries: EntryMeta[] = getInputTree(
            result,
            table.lookupRecords,
            lookups,
            0,
            glyphId
        ).map(({ entry, substitution }) => ({ entry, substitutions: [substitution] }));

        for (const [index, coverage] of table.inputCoverage.slice(1).entries()) {
            currentEntries = processInputPosition(
                listGlyphsByIndex(coverage).map(glyph => glyph.glyphId),
                index + 1,
                currentEntries,
                table.lookupRecords,
                lookups
            );
        }

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

        // When we get to the end, all of the entries we've accumulated
        // should have a lookup defined
        for (const { entry, substitutions } of currentEntries) {
            entry.lookup = {
                substitutions,
                index: tableIndex,
                subIndex: 0,
                length: table.inputCoverage.length,
                contextRange: [
                    -1 * table.backtrackCoverage.length,
                    table.inputCoverage.length + table.lookaheadCoverage.length
                ]
            };
        }
    }

    return result;
}
