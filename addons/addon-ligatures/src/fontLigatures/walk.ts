import { IFlattenedLookupTree, ILookupResult } from './types';

export default function walkTree(tree: IFlattenedLookupTree, sequence: number[], startIndex: number, index: number): ILookupResult | undefined {
  const glyphId = sequence[index];
  const subtree = tree[glyphId];
  if (!subtree) {
    return undefined;
  }

  let lookup = subtree.lookup;
  if (subtree.reverse) {
    const reverseLookup = walkReverse(subtree.reverse, sequence, startIndex);

    if (
      (!lookup && reverseLookup) ||
      (
        reverseLookup && lookup && (
          lookup.index > reverseLookup.index ||
          (lookup.index === reverseLookup.index && lookup.subIndex > reverseLookup.subIndex)
        )
      )
    ) {
      lookup = reverseLookup;
    }
  }

  if (++index >= sequence.length || !subtree.forward) {
    return lookup;
  }

  const forwardLookup = walkTree(subtree.forward, sequence, startIndex, index);

  if (
    (!lookup && forwardLookup) ||
    (
      forwardLookup && lookup && (
        lookup.index > forwardLookup.index ||
        (lookup.index === forwardLookup.index && lookup.subIndex > forwardLookup.subIndex)
      )
    )
  ) {
    lookup = forwardLookup;
  }

  return lookup;
}

function walkReverse(tree: IFlattenedLookupTree, sequence: number[], index: number): ILookupResult | undefined {
  let subtree = tree[sequence[--index]];
  let lookup: ILookupResult | undefined = subtree && subtree.lookup;
  while (subtree) {
    if (
      (!lookup && subtree.lookup) ||
      (subtree.lookup && lookup && lookup.index > subtree.lookup.index)
    ) {
      lookup = subtree.lookup;
    }

    if (--index < 0 || !subtree.reverse) {
      break;
    }

    subtree = subtree.reverse[sequence[index]];
  }

  return lookup;
}
