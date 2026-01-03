import { LookupTree, LookupTreeEntry } from './types';

/**
 * Merges the provided trees into a single lookup tree. When conflicting lookups
 * are encountered between two trees, the one with the lower index, then the
 * lower subindex is chosen.
 *
 * @param trees Array of trees to merge. Entries in earlier trees are favored
 *              over those in later trees when there is a choice.
 */
export default function mergeTrees(trees: LookupTree[]): LookupTree {
  const result: LookupTree = {
    individual: {},
    range: []
  };

  for (const tree of trees) {
    mergeSubtree(result, tree);
  }

  return result;
}

/**
 * Recursively merges the data for the mergeTree into the mainTree.
 *
 * @param mainTree The tree where the values should be merged
 * @param mergeTree The tree to be merged into the mainTree
 */
function mergeSubtree(mainTree: LookupTree, mergeTree: LookupTree): void {
  // Need to fix this recursively (and handle lookups)
  for (const [glyphId, value] of Object.entries(mergeTree.individual)) {
    // The main tree is guaranteed to have no overlaps between the
    // individual and range values, so if we match an invididual, there
    // must not be a range
    if (mainTree.individual[glyphId]) {
      mergeTreeEntry(mainTree.individual[glyphId], value);
    } else {
      let matched = false;
      for (const [index, { range, entry }] of mainTree.range.entries()) {
        const overlap = getIndividualOverlap(Number(glyphId), range);

        // Don't overlap
        if (overlap.both === null) {
          continue;
        }

        matched = true;

        // If they overlap, we have to split the range and then
        // merge the overlap
        mainTree.individual[glyphId] = value;
        mergeTreeEntry(mainTree.individual[glyphId], cloneEntry(entry));

        // When there's an overlap, we also have to fix up the range
        // that we had already processed
        mainTree.range.splice(index, 1);
        for (const glyph of overlap.second) {
          if (Array.isArray(glyph)) {
            mainTree.range.push({
              range: glyph,
              entry: cloneEntry(entry)
            });
          } else {
            mainTree.individual[glyph] = cloneEntry(entry);
          }
        }
      }

      if (!matched) {
        mainTree.individual[glyphId] = value;
      }
    }
  }

  for (const { range, entry } of mergeTree.range) {
    // Ranges are more complicated, because they can overlap with
    // multiple things, individual and range alike. We start by
    // eliminating ranges that are already present in another range
    let remainingRanges: (number | [number, number])[] = [range];

    for (let index = 0; index < mainTree.range.length; index++) {
      const { range, entry: resultEntry } = mainTree.range[index];
      for (const [remainingIndex, remainingRange] of remainingRanges.entries()) {
        if (Array.isArray(remainingRange)) {
          const overlap = getRangeOverlap(remainingRange, range);
          if (overlap.both === null) {
            continue;
          }

          mainTree.range.splice(index, 1);
          index--;

          const entryToMerge: LookupTreeEntry = cloneEntry(resultEntry);
          if (Array.isArray(overlap.both)) {
            mainTree.range.push({
              range: overlap.both,
              entry: entryToMerge
            });
          } else {
            mainTree.individual[overlap.both] = entryToMerge;
          }

          mergeTreeEntry(entryToMerge, cloneEntry(entry));

          for (const second of overlap.second) {
            if (Array.isArray(second)) {
              mainTree.range.push({
                range: second,
                entry: cloneEntry(resultEntry)
              });
            } else {
              mainTree.individual[second] = cloneEntry(resultEntry);
            }
          }

          remainingRanges = overlap.first;
        } else {
          const overlap = getIndividualOverlap(remainingRange, range);
          if (overlap.both === null) {
            continue;
          }

          // If they overlap, we have to split the range and then
          // merge the overlap
          mainTree.individual[remainingRange] = cloneEntry(entry);
          mergeTreeEntry(mainTree.individual[remainingRange], cloneEntry(resultEntry));

          // When there's an overlap, we also have to fix up the range
          // that we had already processed
          mainTree.range.splice(index, 1);
          index--;

          for (const glyph of overlap.second) {
            if (Array.isArray(glyph)) {
              mainTree.range.push({
                range: glyph,
                entry: cloneEntry(resultEntry)
              });
            } else {
              mainTree.individual[glyph] = cloneEntry(resultEntry);
            }
          }

          remainingRanges.splice(remainingIndex, 1, ...overlap.first);
          break;
        }
      }
    }

    // Next, we run the same against any individual glyphs
    for (const glyphId of Object.keys(mainTree.individual)) {
      for (const [remainingIndex, remainingRange] of remainingRanges.entries()) {
        if (Array.isArray(remainingRange)) {
          const overlap = getIndividualOverlap(Number(glyphId), remainingRange);
          if (overlap.both === null) {
            continue;
          }

          // If they overlap, we have to merge the overlap
          mergeTreeEntry(mainTree.individual[glyphId], cloneEntry(entry));

          // Update the remaining ranges
          remainingRanges.splice(remainingIndex, 1, ...overlap.second);
          break;
        } else {
          if (Number(glyphId) === remainingRange) {
            mergeTreeEntry(mainTree.individual[glyphId], cloneEntry(entry));
            break;
          }
        }
      }
    }

    // Any remaining ranges should just be added directly
    for (const remainingRange of remainingRanges) {
      if (Array.isArray(remainingRange)) {
        mainTree.range.push({
          range: remainingRange,
          entry: cloneEntry(entry)
        });
      } else {
        mainTree.individual[remainingRange] = cloneEntry(entry);
      }
    }
  }
}

/**
 * Recursively merges the entry forr the mergeTree into the mainTree
 *
 * @param mainTree The entry where the values should be merged
 * @param mergeTree The entry to merge into the mainTree
 */
function mergeTreeEntry(mainTree: LookupTreeEntry, mergeTree: LookupTreeEntry): void {
  if (
    mergeTree.lookup && (
      !mainTree.lookup ||
      mainTree.lookup.index > mergeTree.lookup.index ||
      (mainTree.lookup.index === mergeTree.lookup.index && mainTree.lookup.subIndex > mergeTree.lookup.subIndex)
    )
  ) {
    mainTree.lookup = mergeTree.lookup;
  }

  if (mergeTree.forward) {
    if (!mainTree.forward) {
      mainTree.forward = mergeTree.forward;
    } else {
      mergeSubtree(mainTree.forward, mergeTree.forward);
    }
  }

  if (mergeTree.reverse) {
    if (!mainTree.reverse) {
      mainTree.reverse = mergeTree.reverse;
    } else {
      mergeSubtree(mainTree.reverse, mergeTree.reverse);
    }
  }
}

interface Overlap {
  first: (number | [number, number])[];
  second: (number | [number, number])[];
  both: number | [number, number] | null;
}

/**
 * Determines the overlap (if any) between two ranges. Returns the distinct
 * ranges for each range and the overlap (if any).
 *
 * @param first First range
 * @param second Second range
 */
function getRangeOverlap(first: [number, number], second: [number, number]): Overlap {
  const result: Overlap = {
    first: [],
    second: [],
    both: null
  };

  // Both
  if (first[0] < second[1] && second[0] < first[1]) {
    const start = Math.max(first[0], second[0]);
    const end = Math.min(first[1], second[1]);
    result.both = rangeOrIndividual(start, end);
  }

  // Before
  if (first[0] < second[0]) {
    const start = first[0];
    const end = Math.min(second[0], first[1]);
    result.first.push(rangeOrIndividual(start, end));
  } else if (second[0] < first[0]) {
    const start = second[0];
    const end = Math.min(second[1], first[0]);
    result.second.push(rangeOrIndividual(start, end));
  }

  // After
  if (first[1] > second[1]) {
    const start = Math.max(first[0], second[1]);
    const end = first[1];
    result.first.push(rangeOrIndividual(start, end));
  } else if (second[1] > first[1]) {
    const start = Math.max(first[1], second[0]);
    const end = second[1];
    result.second.push(rangeOrIndividual(start, end));
  }

  return result;
}

/**
 * Determines the overlap (if any) between the individual glyph and the range
 * provided. Returns the glyphs and/or ranges that are unique to each provided
 * and the overlap (if any).
 *
 * @param first Individual glyph
 * @param second Range
 */
function getIndividualOverlap(first: number, second: [number, number]): Overlap {
  // Disjoint
  if (first < second[0] || first > second[1]) {
    return {
      first: [first],
      second: [second],
      both: null
    };
  }

  const result: Overlap = {
    first: [],
    second: [],
    both: first
  };

  if (second[0] < first) {
    result.second.push(rangeOrIndividual(second[0], first));
  }

  if (second[1] > first) {
    result.second.push(rangeOrIndividual(first + 1, second[1]));
  }

  return result;
}

/**
 * Returns an individual glyph if the range is of size one or a range if it is
 * larger.
 *
 * @param start Beginning of the range (inclusive)
 * @param end End of the range (exclusive)
 */
function rangeOrIndividual(start: number, end: number): number | [number, number] {
  if (end - start === 1) {
    return start;
  } else {
    return [start, end];
  }
}

/**
 * Clones an individual lookup tree entry.
 *
 * @param entry Lookup tree entry to clone
 */
function cloneEntry(entry: LookupTreeEntry): LookupTreeEntry {
  const result: LookupTreeEntry = {};

  if (entry.forward) {
    result.forward = cloneTree(entry.forward);
  }

  if (entry.reverse) {
    result.reverse = cloneTree(entry.reverse);
  }

  if (entry.lookup) {
    result.lookup = {
      contextRange: entry.lookup.contextRange.slice() as [number, number],
      index: entry.lookup.index,
      length: entry.lookup.length,
      subIndex: entry.lookup.subIndex,
      substitutions: entry.lookup.substitutions.slice()
    };
  }

  return result;
}

/**
 * Clones a lookup tree.
 *
 * @param tree Lookup tree to clone
 */
function cloneTree(tree: LookupTree): LookupTree {
  const individual: { [glyphId: string]: LookupTreeEntry; } = {};
  for (const [glyphId, entry] of Object.entries(tree.individual)) {
    individual[glyphId] = cloneEntry(entry);
  }

  return {
    individual,
    range: tree.range.map(({ range, entry }) => ({
      range: range.slice() as [number, number],
      entry: cloneEntry(entry)
    }))
  };
}
