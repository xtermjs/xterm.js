import { IUnicodeService, IUnicodeVersionProvider, UnicodeCharProperties, UnicodeCharWidth } from 'common/services/Services';
export declare class UnicodeService implements IUnicodeService {
    serviceBrand: any;
    private _providers;
    private _active;
    private _activeProvider;
    private readonly _onChange;
    readonly onChange: import("common/base/Event").IEvent<string>;
    static extractShouldJoin(value: UnicodeCharProperties): boolean;
    static extractWidth(value: UnicodeCharProperties): UnicodeCharWidth;
    static extractCharKind(value: UnicodeCharProperties): number;
    static createPropertyValue(state: number, width: number, shouldJoin?: boolean): UnicodeCharProperties;
    constructor();
    dispose(): void;
    get versions(): string[];
    get activeVersion(): string;
    set activeVersion(version: string);
    register(provider: IUnicodeVersionProvider): void;
    wcwidth(num: number): UnicodeCharWidth;
    getStringCellWidth(s: string): number;
    charProperties(codepoint: number, preceding: UnicodeCharProperties): UnicodeCharProperties;
}
//# sourceMappingURL=UnicodeService.d.ts.map