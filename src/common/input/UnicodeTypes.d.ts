export type UnicodeCharProperties = number;
export type UnicodeCharWidth = 0 | 1 | 2;
export interface IUnicodeVersionProvider {
    readonly version: string;
    wcwidth(ucs: number): UnicodeCharWidth;
    charProperties(codepoint: number, preceding: UnicodeCharProperties): UnicodeCharProperties;
}
//# sourceMappingURL=UnicodeTypes.d.ts.map