import { ChainingContextualSubstitutionTable, Lookup } from '../tables';
import { LookupTree } from '../types';

import { listGlyphsByIndex } from './coverage';
import { processInputPosition, processLookaheadPosition, processBacktrackPosition, getInputTree, EntryMeta } from './helper';

/**
 * Build lookup tree for GSUB lookup table 6, format 1.
 * https://docs.microsoft.com/en-us/typography/opentype/spec/gsub#61-chaining-context-substitution-format-1-simple-glyph-contexts
 *
 * @param table JSON representation of the table
 * @param lookups List of lookup tables
 * @param tableIndex Index of this table in the overall lookup
 */
export default function buildTree(table: ChainingContextualSubstitutionTable.Format1, lookups: Lookup[], tableIndex: number): LookupTree {
    const result: LookupTree = {
        individual: {},
        range: []
    };

    const firstGlyphs = listGlyphsByIndex(table.coverage);

    for (const { glyphId, index } of firstGlyphs) {
        const chainRuleSet = table.chainRuleSets[index];

        // If the chain rule set is null there's nothing to do with this table.
        if (!chainRuleSet) {
            continue;
        }

        for (const [subIndex, subTable] of chainRuleSet.entries()) {
            let currentEntries: EntryMeta[] = getInputTree(
                result,
                subTable.lookupRecords,
                lookups,
                0,
                glyphId
            ).map(({ entry, substitution }) => ({ entry, substitutions: [substitution] }));

            // We walk forward, then backward
            for (const [index, glyph] of subTable.input.entries()) {
                currentEntries = processInputPosition(
                    [glyph],
                    index + 1,
                    currentEntries,
                    subTable.lookupRecords,
                    lookups
                );
            }

            for (const glyph of subTable.lookahead) {
                currentEntries = processLookaheadPosition(
                    [glyph],
                    currentEntries
                );
            }

            for (const glyph of subTable.backtrack) {
                currentEntries = processBacktrackPosition(
                    [glyph],
                    currentEntries
                );
            }

            // When we get to the end, insert the lookup information
            for (const { entry, substitutions } of currentEntries) {
                entry.lookup = {
                    substitutions,
                    length: subTable.input.length + 1,
                    index: tableIndex,
                    subIndex,
                    contextRange: [
                        -1 * subTable.backtrack.length,
                        1 + subTable.input.length + subTable.lookahead.length
                    ]
                };
            }
        }
    }

    return result;
}
