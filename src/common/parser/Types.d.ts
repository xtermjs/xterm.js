import { IDisposable } from 'common/services/Types';
import { ParserState } from 'common/parser/Constants';
export type ParamsArray = (number | number[])[];
export interface IParamsConstructor {
    new (maxLength: number, maxSubParamsLength: number): IParams;
    fromArray(values: ParamsArray): IParams;
}
export interface IParams {
    maxLength: number;
    maxSubParamsLength: number;
    params: Int32Array;
    length: number;
    clone(): IParams;
    toArray(): ParamsArray;
    reset(): void;
    resetZdm(): void;
    addParam(value: number): void;
    addSubParam(value: number): void;
    hasSubParams(idx: number): boolean;
    getSubParams(idx: number): Int32Array | null;
    getSubParamsAll(): {
        [idx: number]: Int32Array;
    };
}
export interface IParsingState {
    position: number;
    code: number;
    currentState: ParserState;
    collect: number;
    params: IParams;
    abort: boolean;
}
export type CsiHandlerType = (params: IParams) => boolean | Promise<boolean>;
export type CsiFallbackHandlerType = (ident: number, params: IParams) => void;
export interface IDcsHandler {
    hook(params: IParams): void;
    put(data: Uint32Array, start: number, end: number): void;
    unhook(success: boolean): boolean | Promise<boolean>;
}
export type DcsFallbackHandlerType = (ident: number, action: 'HOOK' | 'PUT' | 'UNHOOK', payload?: any) => void;
export type EscHandlerType = () => boolean | Promise<boolean>;
export type EscFallbackHandlerType = (identifier: number) => void;
export type ExecuteHandlerType = (ident?: number) => boolean;
export type ExecuteFallbackHandlerType = (ident: number) => void;
export interface IOscHandler {
    start(): void;
    put(data: Uint32Array, start: number, end: number): void;
    end(success: boolean): boolean | Promise<boolean>;
}
export type OscFallbackHandlerType = (ident: number, action: 'START' | 'PUT' | 'END', payload?: any) => void;
export interface IApcHandler {
    start(): void;
    put(data: Uint32Array, start: number, end: number): void;
    end(success: boolean): boolean | Promise<boolean>;
}
export type ApcFallbackHandlerType = (ident: number, action: 'START' | 'PUT' | 'END', payload?: any) => void;
export type PrintHandlerType = (data: Uint32Array, start: number, end: number) => void;
export type PrintFallbackHandlerType = PrintHandlerType;
export interface IEscapeSequenceParser extends IDisposable {
    precedingJoinState: number;
    reset(): void;
    parse(data: Uint32Array, length: number, promiseResult?: boolean): void | Promise<boolean>;
    identToString(ident: number): string;
    setPrintHandler(handler: PrintHandlerType): void;
    clearPrintHandler(): void;
    registerEscHandler(id: IFunctionIdentifier, handler: EscHandlerType): IDisposable;
    clearEscHandler(id: IFunctionIdentifier): void;
    setEscHandlerFallback(handler: EscFallbackHandlerType): void;
    setExecuteHandler(flag: string, handler: ExecuteHandlerType): void;
    clearExecuteHandler(flag: string): void;
    setExecuteHandlerFallback(handler: ExecuteFallbackHandlerType): void;
    registerCsiHandler(id: IFunctionIdentifier, handler: CsiHandlerType): IDisposable;
    clearCsiHandler(id: IFunctionIdentifier): void;
    setCsiHandlerFallback(callback: CsiFallbackHandlerType): void;
    registerDcsHandler(id: IFunctionIdentifier, handler: IDcsHandler): IDisposable;
    clearDcsHandler(id: IFunctionIdentifier): void;
    setDcsHandlerFallback(handler: DcsFallbackHandlerType): void;
    registerOscHandler(ident: number, handler: IOscHandler): IDisposable;
    clearOscHandler(ident: number): void;
    setOscHandlerFallback(handler: OscFallbackHandlerType): void;
    registerApcHandler(id: IFunctionIdentifier, handler: IApcHandler): IDisposable;
    clearApcHandler(id: IFunctionIdentifier): void;
    setApcHandlerFallback(handler: ApcFallbackHandlerType): void;
    setErrorHandler(handler: (state: IParsingState) => IParsingState): void;
    clearErrorHandler(): void;
}
export interface ISubParser<T, U> extends IDisposable {
    reset(): void;
    registerHandler(ident: number, handler: T): IDisposable;
    clearHandler(ident: number): void;
    setHandlerFallback(handler: U): void;
    put(data: Uint32Array, start: number, end: number): void;
}
export interface IOscParser extends ISubParser<IOscHandler, OscFallbackHandlerType> {
    start(): void;
    end(success: boolean, promiseResult?: boolean): void | Promise<boolean>;
}
export interface IDcsParser extends ISubParser<IDcsHandler, DcsFallbackHandlerType> {
    hook(ident: number, params: IParams): void;
    unhook(success: boolean, promiseResult?: boolean): void | Promise<boolean>;
}
export interface IApcParser extends ISubParser<IApcHandler, ApcFallbackHandlerType> {
    start(ident: number): void;
    end(success: boolean, promiseResult?: boolean): void | Promise<boolean>;
}
export interface IFunctionIdentifier {
    prefix?: string;
    intermediates?: string;
    final: string;
}
export interface IHandlerCollection<T> {
    [key: string]: T[];
}
export declare const enum ParserStackType {
    NONE = 0,
    FAIL = 1,
    RESET = 2,
    CSI = 3,
    ESC = 4,
    OSC = 5,
    DCS = 6,
    APC = 7
}
export type ResumableHandlersType = CsiHandlerType[] | EscHandlerType[];
export interface IParserStackState {
    state: ParserStackType;
    handlers: ResumableHandlersType;
    handlerPos: number;
    transition: number;
    chunkPos: number;
}
export interface ISubParserStackState {
    paused: boolean;
    loopPosition: number;
    fallThrough: boolean;
}
//# sourceMappingURL=Types.d.ts.map