import { IUnicodeVersionProvider, UnicodeCharProperties, UnicodeCharWidth } from 'common/services/Services';
export declare class UnicodeV6 implements IUnicodeVersionProvider {
    readonly version = "6";
    constructor();
    wcwidth(num: number): UnicodeCharWidth;
    charProperties(codepoint: number, preceding: UnicodeCharProperties): UnicodeCharProperties;
}
//# sourceMappingURL=UnicodeV6.d.ts.map