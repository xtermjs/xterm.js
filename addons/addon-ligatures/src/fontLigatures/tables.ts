export type SubstitutionTable = SubstitutionTable.Format1 | SubstitutionTable.Format2;
export namespace SubstitutionTable {
    export interface Format1 {
        substFormat: 1;
        coverage: CoverageTable;
        deltaGlyphId: number;
    }

    export interface Format2 {
        substFormat: 2;
        coverage: CoverageTable;
        substitute: number[];
    }
}

export type CoverageTable = CoverageTable.Format1 | CoverageTable.Format2;
export namespace CoverageTable {
    export interface Format1 {
        format: 1;
        glyphs: number[];
    }

    export interface Format2 {
        format: 2;
        ranges: {
            start: number;
            end: number;
            index: number;
        }[];
    }
}

export type ChainingContextualSubstitutionTable = ChainingContextualSubstitutionTable.Format1 |
    ChainingContextualSubstitutionTable.Format2 | ChainingContextualSubstitutionTable.Format3;
export namespace ChainingContextualSubstitutionTable {
    export interface Format1 {
        substFormat: 1;
        coverage: CoverageTable;
        chainRuleSets: ChainSubRuleTable[][];
    }

    export interface Format2 {
        substFormat: 2;
        coverage: CoverageTable;
        backtrackClassDef: ClassDefTable;
        inputClassDef: ClassDefTable;
        lookaheadClassDef: ClassDefTable;
        chainClassSet: (null | ChainSubClassRuleTable[])[];
    }

    export interface Format3 {
        substFormat: 3;
        backtrackCoverage: CoverageTable[];
        inputCoverage: CoverageTable[];
        lookaheadCoverage: CoverageTable[];
        lookupRecords: SubstitutionLookupRecord[];
    }
}

export interface ReverseChainingContextualSingleSubstitutionTable {
    substFormat: 1;
    coverage: CoverageTable;
    backtrackCoverage: CoverageTable[];
    lookaheadCoverage: CoverageTable[];
    substitutes: number[];
}

export type ClassDefTable = ClassDefTable.Format2;
export namespace ClassDefTable {
    export interface Format2 {
        format: 2;
        ranges: {
            start: number;
            end: number;
            classId: number;
        }[];
    }
}

export interface SubstitutionLookupRecord {
    sequenceIndex: number;
    lookupListIndex: number;
}

export type ChainSubRuleTable = ChainSubClassRuleTable;
export interface ChainSubClassRuleTable {
    backtrack: number[];
    input: number[];
    lookahead: number[];
    lookupRecords: SubstitutionLookupRecord[];
}

export type Lookup = Lookup.Type1 | Lookup.Type6 | Lookup.Type8;
export namespace Lookup {
    export interface Type1 {
        lookupType: 1;
        lookupFlag: number;
        subtables: SubstitutionTable[];
    }

    export interface Type6 {
        lookupType: 6;
        lookupFlag: number;
        subtables: ChainingContextualSubstitutionTable[];
    }

    export interface Type8 {
        lookupType: 8;
        lookupFlag: number;
        subtables: ReverseChainingContextualSingleSubstitutionTable[];
    }
}
