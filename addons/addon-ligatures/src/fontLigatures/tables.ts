export type SubstitutionTable = SubstitutionTable.IFormat1 | SubstitutionTable.IFormat2;
export namespace SubstitutionTable {
  export interface IFormat1 {
    substFormat: 1;
    coverage: CoverageTable;
    deltaGlyphId: number;
  }

  export interface IFormat2 {
    substFormat: 2;
    coverage: CoverageTable;
    substitute: number[];
  }
}

export type CoverageTable = CoverageTable.IFormat1 | CoverageTable.IFormat2;
export namespace CoverageTable {
  export interface IFormat1 {
    format: 1;
    glyphs: number[];
  }

  export interface IFormat2 {
    format: 2;
    ranges: {
      start: number;
      end: number;
      index: number;
    }[];
  }
}

export type ChainingContextualSubstitutionTable = ChainingContextualSubstitutionTable.IFormat1 |
  ChainingContextualSubstitutionTable.IFormat2 | ChainingContextualSubstitutionTable.IFormat3;
export namespace ChainingContextualSubstitutionTable {
  export interface IFormat1 {
    substFormat: 1;
    coverage: CoverageTable;
    chainRuleSets: ChainSubRuleTable[][];
  }

  export interface IFormat2 {
    substFormat: 2;
    coverage: CoverageTable;
    backtrackClassDef: ClassDefTable;
    inputClassDef: ClassDefTable;
    lookaheadClassDef: ClassDefTable;
    chainClassSet: (null | IChainSubClassRuleTable[])[];
  }

  export interface IFormat3 {
    substFormat: 3;
    backtrackCoverage: CoverageTable[];
    inputCoverage: CoverageTable[];
    lookaheadCoverage: CoverageTable[];
    lookupRecords: ISubstitutionLookupRecord[];
  }
}

export interface IReverseChainingContextualSingleSubstitutionTable {
  substFormat: 1;
  coverage: CoverageTable;
  backtrackCoverage: CoverageTable[];
  lookaheadCoverage: CoverageTable[];
  substitutes: number[];
}

export type ClassDefTable = ClassDefTable.IFormat2;
export namespace ClassDefTable {
  export interface IFormat2 {
    format: 2;
    ranges: {
      start: number;
      end: number;
      classId: number;
    }[];
  }
}

export interface ISubstitutionLookupRecord {
  sequenceIndex: number;
  lookupListIndex: number;
}

export type ChainSubRuleTable = IChainSubClassRuleTable;
export interface IChainSubClassRuleTable {
  backtrack: number[];
  input: number[];
  lookahead: number[];
  lookupRecords: ISubstitutionLookupRecord[];
}

export type Lookup = Lookup.IType1 | Lookup.IType6 | Lookup.IType8;
export namespace Lookup {
  export interface IType1 {
    lookupType: 1;
    lookupFlag: number;
    subtables: SubstitutionTable[];
  }

  export interface IType6 {
    lookupType: 6;
    lookupFlag: number;
    subtables: ChainingContextualSubstitutionTable[];
  }

  export interface IType8 {
    lookupType: 8;
    lookupFlag: number;
    subtables: IReverseChainingContextualSingleSubstitutionTable[];
  }
}
