import { ILookupTree, IFlattenedLookupTree, ILookupTreeEntry, IFlattenedLookupTreeEntry } from './types';

export default function flatten(tree: ILookupTree, visited: Map<ILookupTreeEntry, IFlattenedLookupTreeEntry> = new Map()): IFlattenedLookupTree {
  const result: IFlattenedLookupTree = {};
  for (const [glyphId, entry] of Object.entries(tree.individual)) {
    result[glyphId] = flattenEntry(entry, visited);
  }

  for (const { range, entry } of tree.range) {
    const flattened = flattenEntry(entry, visited);
    for (let glyphId = range[0]; glyphId < range[1]; glyphId++) {
      result[glyphId] = flattened;
    }
  }

  return result;
}

function flattenEntry(entry: ILookupTreeEntry, visited: Map<ILookupTreeEntry, IFlattenedLookupTreeEntry>): IFlattenedLookupTreeEntry {
  if (visited.has(entry)) {
    return visited.get(entry)!;
  }

  const result: IFlattenedLookupTreeEntry = {};
  visited.set(entry, result);

  if (entry.forward) {
    result.forward = flatten(entry.forward, visited);
  }

  if (entry.reverse) {
    result.reverse = flatten(entry.reverse, visited);
  }

  if (entry.lookup) {
    result.lookup = entry.lookup;
  }

  return result;
}
