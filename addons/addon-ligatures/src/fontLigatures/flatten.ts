import { ILookupTree, IFlattenedLookupTree, ILookupTreeEntry, IFlattenedLookupTreeEntry } from './types';

export default function flatten(tree: ILookupTree): IFlattenedLookupTree {
  const result: IFlattenedLookupTree = {};
  for (const [glyphId, entry] of Object.entries(tree.individual)) {
    result[glyphId] = flattenEntry(entry);
  }

  for (const { range, entry } of tree.range) {
    const flattened = flattenEntry(entry);
    for (let glyphId = range[0]; glyphId < range[1]; glyphId++) {
      result[glyphId] = flattened;
    }
  }

  return result;
}

function flattenEntry(entry: ILookupTreeEntry): IFlattenedLookupTreeEntry {
  const result: IFlattenedLookupTreeEntry = {};

  if (entry.forward) {
    result.forward = flatten(entry.forward);
  }

  if (entry.reverse) {
    result.reverse = flatten(entry.reverse);
  }

  if (entry.lookup) {
    result.lookup = entry.lookup;
  }

  return result;
}
