export interface ISubstitutionResult {
  index: number;
  contextRange: [number, number];
}

/**
 * Information about ligatures found in a sequence of text
 */
export interface ILigatureData {
  /**
   * The list of font glyphs in the input text.
   */
  inputGlyphs: number[];

  /**
   * The list of font glyphs after performing replacements for font ligatures.
   */
  outputGlyphs: number[];

  /**
   * Sorted array of ranges that must be rendered together to produce the
   * ligatures in the output sequence. The ranges are inclusive on the left and
   * exclusive on the right.
   */
  contextRanges: [number, number][];
}

export interface IFont {
  /**
   * Scans the provided text for font ligatures, returning an object with
   * metadata about the text and any ligatures found.
   *
   * @param text String to search for ligatures
   */
  findLigatures(text: string): ILigatureData;

  /**
   * Scans the provided text for font ligatures, returning an array of ranges
   * where ligatures are located.
   *
   * @param text String to search for ligatures
   */
  findLigatureRanges(text: string): [number, number][];
}

export interface IOptions {
  /**
   * Optional size of previous results to store, measured in total number of
   * characters from input strings. Defaults to no cache (0)
   */
  cacheSize?: number;
}

export interface ILookupTree {
  individual: {
    [glyphId: string]: ILookupTreeEntry;
  };
  range: {
    range: [number, number];
    entry: ILookupTreeEntry;
  }[];
}

export interface ILookupTreeEntry {
  lookup?: ILookupResult;
  forward?: ILookupTree;
  reverse?: ILookupTree;
}

export interface ILookupResult {
  substitutions: (number | null)[];
  length: number;
  index: number;
  subIndex: number;
  contextRange: [number, number];
}

export interface IFlattenedLookupTree {
  [glyphId: string]: IFlattenedLookupTreeEntry;
}

export interface IFlattenedLookupTreeEntry {
  lookup?: ILookupResult;
  forward?: IFlattenedLookupTree;
  reverse?: IFlattenedLookupTree;
}
