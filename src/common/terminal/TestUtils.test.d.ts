import { IBufferService, ICoreService, ILogService, IOptionsService, ITerminalOptions, IMouseStateService, ICharsetService, UnicodeCharProperties, UnicodeCharWidth, IUnicodeService, IUnicodeVersionProvider, LogLevelEnum, IDecorationService, IInternalDecoration, IOscLinkService, type IBufferResizeEvent } from 'common/services/Services';
import { IBufferSet, IBuffer } from 'common/buffer/Types';
import { IDecPrivateModes, ICoreMouseEvent, CoreMouseEventType, ICharset, IModes, IAttributeData, IOscLinkData, IDisposable, IBufferLine, IExtendedAttrs } from 'common/services/Types';
import { IDecorationOptions, IDecoration } from '@xterm/xterm';
import { type IEvent } from 'common/base/Event';
import { CellData } from 'common/buffer/CellData';
export declare function createCellData(attr: number, char: string, width: number): CellData;
export declare function extendedAttributes(line: IBufferLine, index: number): IExtendedAttrs | undefined;
export declare const NULL_CELL_DATA: Readonly<CellData>;
export declare class MockBufferService implements IBufferService {
    cols: number;
    rows: number;
    serviceBrand: any;
    get buffer(): IBuffer;
    buffers: IBufferSet;
    onResize: IEvent<IBufferResizeEvent>;
    onScroll: IEvent<number>;
    private readonly _onScroll;
    isUserScrolling: boolean;
    constructor(cols: number, rows: number, optionsService?: IOptionsService);
    scrollPages(pageCount: number): void;
    scrollToTop(): void;
    scrollToLine(line: number): void;
    scroll(eraseAttr: IAttributeData, isWrapped: boolean): void;
    scrollToBottom(): void;
    scrollLines(disp: number, suppressScrollEvent?: boolean): void;
    resize(cols: number, rows: number): void;
    reset(): void;
}
export declare class MockMouseStateService implements IMouseStateService {
    serviceBrand: any;
    areMouseEventsActive: boolean;
    activeEncoding: string;
    activeProtocol: string;
    isDefaultEncoding: boolean;
    isPixelEncoding: boolean;
    addEncoding(name: string): void;
    addProtocol(name: string): void;
    reset(): void;
    onProtocolChange: IEvent<CoreMouseEventType>;
    restrictMouseEvent(event: ICoreMouseEvent): boolean;
    encodeMouseEvent(event: ICoreMouseEvent): string;
    setCustomWheelEventHandler(customWheelEventHandler: ((event: WheelEvent) => boolean) | undefined): void;
    allowCustomWheelEvent(ev: WheelEvent): boolean;
}
export declare class MockCharsetService implements ICharsetService {
    serviceBrand: any;
    charset: ICharset | undefined;
    glevel: number;
    charsets: (ICharset | undefined)[];
    reset(): void;
    setgLevel(g: number): void;
    setgCharset(g: number, charset: ICharset | undefined): void;
}
export declare class MockCoreService implements ICoreService {
    serviceBrand: any;
    isCursorInitialized: boolean;
    isCursorHidden: boolean;
    isFocused: boolean;
    modes: IModes;
    decPrivateModes: IDecPrivateModes;
    kittyKeyboard: {
        flags: number;
        mainFlags: number;
        altFlags: number;
        mainStack: number[];
        altStack: number[];
    };
    onData: IEvent<string>;
    onUserInput: IEvent<void>;
    onBinary: IEvent<string>;
    onRequestScrollToBottom: IEvent<void>;
    reset(): void;
    triggerDataEvent(data: string, wasUserInput?: boolean): void;
    triggerBinaryEvent(data: string): void;
}
export declare class MockLogService implements ILogService {
    serviceBrand: any;
    logLevel: LogLevelEnum;
    trace(message: any, ...optionalParams: any[]): void;
    debug(message: any, ...optionalParams: any[]): void;
    info(message: any, ...optionalParams: any[]): void;
    warn(message: any, ...optionalParams: any[]): void;
    error(message: any, ...optionalParams: any[]): void;
}
export declare class MockOptionsService implements IOptionsService {
    serviceBrand: any;
    readonly rawOptions: Required<ITerminalOptions>;
    options: Required<ITerminalOptions>;
    onOptionChange: IEvent<keyof ITerminalOptions>;
    constructor(testOptions?: Partial<ITerminalOptions>);
    onSpecificOptionChange<T extends keyof ITerminalOptions>(key: T, listener: (arg1: ITerminalOptions[T]) => any): IDisposable;
    onMultipleOptionChange(keys: (keyof ITerminalOptions)[], listener: () => any): IDisposable;
    setOptions(options: ITerminalOptions): void;
}
export declare class MockOscLinkService implements IOscLinkService {
    serviceBrand: any;
    registerLink(linkData: IOscLinkData): number;
    getLinkData(linkId: number): IOscLinkData | undefined;
    addLineToLink(linkId: number, y: number): void;
}
export declare class MockUnicodeService implements IUnicodeService {
    serviceBrand: any;
    private _provider;
    register(provider: IUnicodeVersionProvider): void;
    versions: string[];
    activeVersion: string;
    onChange: IEvent<string>;
    wcwidth: (codepoint: number) => UnicodeCharWidth;
    charProperties(codepoint: number, preceding: UnicodeCharProperties): UnicodeCharProperties;
    getStringCellWidth(s: string): number;
}
export declare class MockDecorationService implements IDecorationService {
    serviceBrand: any;
    get decorations(): IterableIterator<IInternalDecoration>;
    onDecorationRegistered: IEvent<IInternalDecoration>;
    onDecorationRemoved: IEvent<IInternalDecoration>;
    registerDecoration(decorationOptions: IDecorationOptions): IDecoration | undefined;
    reset(): void;
    forEachDecorationAtCell(x: number, line: number, layer: 'bottom' | 'top' | undefined, callback: (decoration: IInternalDecoration) => void): void;
    dispose(): void;
}
//# sourceMappingURL=TestUtils.test.d.ts.map