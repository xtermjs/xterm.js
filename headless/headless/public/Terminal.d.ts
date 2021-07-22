import { IEvent } from 'common/EventEmitter';
import { IBufferNamespace as IBufferNamespaceApi, IMarker, IParser, ITerminalOptions, IUnicodeHandling, Terminal as ITerminalApi } from 'xterm-core';
export declare class Terminal implements ITerminalApi {
    private _core;
    private _parser;
    private _buffer;
    constructor(options?: ITerminalOptions);
    private _checkProposedApi;
    get onCursorMove(): IEvent<void>;
    get onLineFeed(): IEvent<void>;
    get onData(): IEvent<string>;
    get onBinary(): IEvent<string>;
    get onTitleChange(): IEvent<string>;
    get onResize(): IEvent<{
        cols: number;
        rows: number;
    }>;
    get parser(): IParser;
    get unicode(): IUnicodeHandling;
    get rows(): number;
    get cols(): number;
    get buffer(): IBufferNamespaceApi;
    get markers(): ReadonlyArray<IMarker>;
    resize(columns: number, rows: number): void;
    registerMarker(cursorYOffset: number): IMarker | undefined;
    addMarker(cursorYOffset: number): IMarker | undefined;
    dispose(): void;
    clear(): void;
    write(data: string | Uint8Array, callback?: () => void): void;
    writeUtf8(data: Uint8Array, callback?: () => void): void;
    writeln(data: string | Uint8Array, callback?: () => void): void;
    getOption(key: 'bellSound' | 'bellStyle' | 'cursorStyle' | 'fontFamily' | 'logLevel' | 'rendererType' | 'termName' | 'wordSeparator'): string;
    getOption(key: 'allowTransparency' | 'altClickMovesCursor' | 'cancelEvents' | 'convertEol' | 'cursorBlink' | 'disableStdin' | 'macOptionIsMeta' | 'rightClickSelectsWord' | 'popOnBell' | 'visualBell'): boolean;
    getOption(key: 'cols' | 'fontSize' | 'letterSpacing' | 'lineHeight' | 'rows' | 'tabStopWidth' | 'scrollback'): number;
    getOption(key: string): any;
    setOption(key: 'bellSound' | 'fontFamily' | 'termName' | 'wordSeparator', value: string): void;
    setOption(key: 'fontWeight' | 'fontWeightBold', value: 'normal' | 'bold' | '100' | '200' | '300' | '400' | '500' | '600' | '700' | '800' | '900' | number): void;
    setOption(key: 'logLevel', value: 'debug' | 'info' | 'warn' | 'error' | 'off'): void;
    setOption(key: 'bellStyle', value: 'none' | 'visual' | 'sound' | 'both'): void;
    setOption(key: 'cursorStyle', value: 'block' | 'underline' | 'bar'): void;
    setOption(key: 'allowTransparency' | 'altClickMovesCursor' | 'cancelEvents' | 'convertEol' | 'cursorBlink' | 'disableStdin' | 'macOptionIsMeta' | 'rightClickSelectsWord' | 'popOnBell' | 'visualBell', value: boolean): void;
    setOption(key: 'fontSize' | 'letterSpacing' | 'lineHeight' | 'tabStopWidth' | 'scrollback', value: number): void;
    setOption(key: 'cols' | 'rows', value: number): void;
    setOption(key: string, value: any): void;
    reset(): void;
    private _verifyIntegers;
}
//# sourceMappingURL=Terminal.d.ts.map