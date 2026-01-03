import { ILookupTreeEntry, ILookupTree } from '../types';
import { ISubstitutionLookupRecord, Lookup } from '../tables';

import { getIndividualSubstitutionGlyph, getRangeSubstitutionGlyphs } from './substitution';

export interface IEntryMeta {
  entry: ILookupTreeEntry;
  substitutions: (number | null)[];
}

export function processInputPosition(
  glyphs: (number | [number, number])[],
  position: number,
  currentEntries: IEntryMeta[],
  lookupRecords: ISubstitutionLookupRecord[],
  lookups: Lookup[]
): IEntryMeta[] {
  const nextEntries: IEntryMeta[] = [];
  for (const currentEntry of currentEntries) {
    currentEntry.entry.forward = {
      individual: {},
      range: []
    };
    for (const glyph of glyphs) {
      nextEntries.push(...getInputTree(
        currentEntry.entry.forward,
        lookupRecords,
        lookups,
        position,
        glyph
      ).map(({ entry, substitution }) => ({
        entry,
        substitutions: [...currentEntry.substitutions, substitution]
      })));
    }
  }

  return nextEntries;
}

export function processLookaheadPosition(
  glyphs: (number | [number, number])[],
  currentEntries: IEntryMeta[]
): IEntryMeta[] {
  const nextEntries: IEntryMeta[] = [];
  for (const currentEntry of currentEntries) {
    for (const glyph of glyphs) {
      const entry: ILookupTreeEntry = {};
      if (!currentEntry.entry.forward) {
        currentEntry.entry.forward = {
          individual: {},
          range: []
        };
      }
      nextEntries.push({
        entry,
        substitutions: currentEntry.substitutions
      });

      if (Array.isArray(glyph)) {
        currentEntry.entry.forward.range.push({
          entry,
          range: glyph
        });
      } else {
        currentEntry.entry.forward.individual[glyph] = entry;
      }
    }
  }

  return nextEntries;
}

export function processBacktrackPosition(
  glyphs: (number | [number, number])[],
  currentEntries: IEntryMeta[]
): IEntryMeta[] {
  const nextEntries: IEntryMeta[] = [];
  for (const currentEntry of currentEntries) {
    for (const glyph of glyphs) {
      const entry: ILookupTreeEntry = {};
      if (!currentEntry.entry.reverse) {
        currentEntry.entry.reverse = {
          individual: {},
          range: []
        };
      }
      nextEntries.push({
        entry,
        substitutions: currentEntry.substitutions
      });

      if (Array.isArray(glyph)) {
        currentEntry.entry.reverse.range.push({
          entry,
          range: glyph
        });
      } else {
        currentEntry.entry.reverse.individual[glyph] = entry;
      }
    }
  }

  return nextEntries;
}

export function getInputTree(tree: ILookupTree, substitutions: ISubstitutionLookupRecord[], lookups: Lookup[], inputIndex: number, glyphId: number | [number, number]): { entry: ILookupTreeEntry, substitution: number | null }[] {
  const result: { entry: ILookupTreeEntry, substitution: number | null }[] = [];
  if (!Array.isArray(glyphId)) {
    tree.individual[glyphId] = {};
    result.push({
      entry: tree.individual[glyphId],
      substitution: getSubstitutionAtPosition(substitutions, lookups, inputIndex, glyphId)
    });
  } else {
    const subs = getSubstitutionAtPositionRange(substitutions, lookups, inputIndex, glyphId);
    for (const [range, substitution] of subs) {
      const entry: ILookupTreeEntry = {};
      if (Array.isArray(range)) {
        tree.range.push({ range, entry });
      } else {
        tree.individual[range] = {};
      }
      result.push({ entry, substitution });
    }
  }

  return result;
}

function getSubstitutionAtPositionRange(substitutions: ISubstitutionLookupRecord[], lookups: Lookup[], index: number, range: [number, number]): Map<number | [number, number], number | null> {
  for (const substitution of substitutions.filter(s => s.sequenceIndex === index)) {
    for (const substitutionTable of (lookups[substitution.lookupListIndex] as Lookup.IType1).subtables) {
      const sub = getRangeSubstitutionGlyphs(
        substitutionTable,
        range
      );

      if (!Array.from(sub.values()).every(val => val !== null)) {
        return sub;
      }
    }
  }

  return new Map([[range, null]]);
}

function getSubstitutionAtPosition(substitutions: ISubstitutionLookupRecord[], lookups: Lookup[], index: number, glyphId: number): number | null {
  for (const substitution of substitutions.filter(s => s.sequenceIndex === index)) {
    for (const substitutionTable of (lookups[substitution.lookupListIndex] as Lookup.IType1).subtables) {
      const sub = getIndividualSubstitutionGlyph(
        substitutionTable,
        glyphId
      );

      if (sub !== null) {
        return sub;
      }
    }
  }

  return null;
}
