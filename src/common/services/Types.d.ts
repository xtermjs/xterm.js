import type { IBufferSet } from 'common/buffer/Types';
import type { IParams } from 'common/parser/Types';
import type { IMouseStateService, ICoreService, IOptionsService, IUnicodeService } from 'common/services/Services';
import { IFunctionIdentifier } from '@xterm/xterm';
import type { IDisposable } from 'common/base/Lifecycle';
import type { ITerminalOptions } from 'common/base/TerminalOptions';
import type { IColorRGB } from 'common/buffer/CellTypes';
import type { IEvent } from 'common/base/Event';
export type { IDisposable } from 'common/base/Lifecycle';
export type { ITerminalOptions } from 'common/base/TerminalOptions';
export type { CharData, IAttributeData, ICellData, IBufferLine, IExtendedAttrs, IMarker } from 'common/buffer/CellTypes';
export type { ICharset } from 'common/data/Charsets';
export type { IKeyboardEvent, IKeyboardResult, KeyboardResultType } from 'common/input/KeyboardTypes';
export type { UnicodeCharProperties, UnicodeCharWidth, IUnicodeVersionProvider } from 'common/input/UnicodeTypes';
export interface ICoreTerminal {
    mouseStateService: IMouseStateService;
    coreService: ICoreService;
    optionsService: IOptionsService;
    unicodeService: IUnicodeService;
    buffers: IBufferSet;
    options: Required<ITerminalOptions>;
    registerCsiHandler(id: IFunctionIdentifier, callback: (params: IParams) => boolean | Promise<boolean>): IDisposable;
    registerDcsHandler(id: IFunctionIdentifier, callback: (data: string, param: IParams) => boolean | Promise<boolean>): IDisposable;
    registerEscHandler(id: IFunctionIdentifier, callback: () => boolean | Promise<boolean>): IDisposable;
    registerOscHandler(ident: number, callback: (data: string) => boolean | Promise<boolean>): IDisposable;
    registerApcHandler(id: IFunctionIdentifier, callback: (data: string) => boolean | Promise<boolean>): IDisposable;
}
export type CursorStyle = 'block' | 'underline' | 'bar';
export type CursorInactiveStyle = 'outline' | 'block' | 'bar' | 'underline' | 'none';
export type XtermListener = (...args: any[]) => void;
export interface IScrollEvent {
    position: number;
}
export interface IColor {
    readonly css: string;
    readonly rgba: number;
}
export type { IColorRGB } from 'common/buffer/CellTypes';
export interface IOscLinkData {
    id?: string;
    uri: string;
}
export interface IModes {
    insertMode: boolean;
}
export interface IDecPrivateModes {
    applicationCursorKeys: boolean;
    applicationKeypad: boolean;
    bracketedPasteMode: boolean;
    colorSchemeUpdates: boolean;
    cursorBlink: boolean | undefined;
    cursorStyle: CursorStyle | undefined;
    origin: boolean;
    reverseWraparound: boolean;
    sendFocus: boolean;
    synchronizedOutput: boolean;
    win32InputMode: boolean;
    wraparound: boolean;
}
export interface IKittyKeyboardState {
    flags: number;
    mainFlags: number;
    altFlags: number;
    mainStack: number[];
    altStack: number[];
}
export interface IRowRange {
    start: number;
    end: number;
}
export declare const enum CoreMouseButton {
    LEFT = 0,
    MIDDLE = 1,
    RIGHT = 2,
    NONE = 3,
    WHEEL = 4,
    AUX1 = 8,
    AUX2 = 9,
    AUX3 = 10,
    AUX4 = 11,
    AUX5 = 12,
    AUX6 = 13,
    AUX7 = 14,
    AUX8 = 15
}
export declare const enum CoreMouseAction {
    UP = 0,
    DOWN = 1,
    LEFT = 2,
    RIGHT = 3,
    MOVE = 32
}
export interface ICoreMouseEvent {
    col: number;
    row: number;
    x: number;
    y: number;
    button: CoreMouseButton;
    action: CoreMouseAction;
    ctrl?: boolean;
    alt?: boolean;
    shift?: boolean;
}
export declare const enum CoreMouseEventType {
    NONE = 0,
    DOWN = 1,
    UP = 2,
    DRAG = 4,
    MOVE = 8,
    WHEEL = 16
}
export interface ICoreMouseProtocol {
    events: CoreMouseEventType;
    restrict: (e: ICoreMouseEvent) => boolean;
}
export type CoreMouseEncoding = (event: ICoreMouseEvent) => string;
export interface IWindowOptions {
    restoreWin?: boolean;
    minimizeWin?: boolean;
    setWinPosition?: boolean;
    setWinSizePixels?: boolean;
    raiseWin?: boolean;
    lowerWin?: boolean;
    refreshWin?: boolean;
    setWinSizeChars?: boolean;
    maximizeWin?: boolean;
    fullscreenWin?: boolean;
    getWinState?: boolean;
    getWinPosition?: boolean;
    getWinSizePixels?: boolean;
    getScreenSizePixels?: boolean;
    getCellSizePixels?: boolean;
    getWinSizeChars?: boolean;
    getScreenSizeChars?: boolean;
    getIconTitle?: boolean;
    getWinTitle?: boolean;
    pushTitle?: boolean;
    popTitle?: boolean;
    setWinLines?: boolean;
}
export declare const enum ColorRequestType {
    REPORT = 0,
    SET = 1,
    RESTORE = 2
}
type Enumerate<N extends number, Acc extends number[] = []> = Acc['length'] extends N ? Acc[number] : Enumerate<N, [...Acc, Acc['length']]>;
type IntRange<F extends number, T extends number> = Exclude<Enumerate<T>, Enumerate<F>>;
export type ColorIndex = IntRange<0, 256>;
export type AllColorIndex = ColorIndex | SpecialColorIndex;
export declare const enum SpecialColorIndex {
    FOREGROUND = 256,
    BACKGROUND = 257,
    CURSOR = 258
}
export interface IColorReportRequest {
    type: ColorRequestType.REPORT;
    index: AllColorIndex;
}
export interface IColorSetRequest {
    type: ColorRequestType.SET;
    index: AllColorIndex;
    color: IColorRGB;
}
export interface IColorRestoreRequest {
    type: ColorRequestType.RESTORE;
    index?: AllColorIndex;
}
export type IColorEvent = (IColorReportRequest | IColorSetRequest | IColorRestoreRequest)[];
export interface IInputHandler {
    onTitleChange: IEvent<string>;
    parse(data: string | Uint8Array, promiseResult?: boolean): void | Promise<boolean>;
    print(data: Uint32Array, start: number, end: number): void;
    registerCsiHandler(id: IFunctionIdentifier, callback: (params: IParams) => boolean | Promise<boolean>): IDisposable;
    registerDcsHandler(id: IFunctionIdentifier, callback: (data: string, param: IParams) => boolean | Promise<boolean>): IDisposable;
    registerEscHandler(id: IFunctionIdentifier, callback: () => boolean | Promise<boolean>): IDisposable;
    registerOscHandler(ident: number, callback: (data: string) => boolean | Promise<boolean>): IDisposable;
    registerApcHandler(id: IFunctionIdentifier, callback: (data: string) => boolean | Promise<boolean>): IDisposable;
    bell(): boolean;
    lineFeed(): boolean;
    carriageReturn(): boolean;
    backspace(): boolean;
    tab(): boolean;
    shiftOut(): boolean;
    shiftIn(): boolean;
    insertChars(params: IParams): boolean;
    scrollLeft(params: IParams): boolean;
    cursorUp(params: IParams): boolean;
    scrollRight(params: IParams): boolean;
    cursorDown(params: IParams): boolean;
    cursorForward(params: IParams): boolean;
    cursorBackward(params: IParams): boolean;
    cursorNextLine(params: IParams): boolean;
    cursorPrecedingLine(params: IParams): boolean;
    cursorCharAbsolute(params: IParams): boolean;
    cursorPosition(params: IParams): boolean;
    cursorForwardTab(params: IParams): boolean;
    eraseInDisplay(params: IParams): boolean;
    eraseInLine(params: IParams): boolean;
    insertLines(params: IParams): boolean;
    deleteLines(params: IParams): boolean;
    deleteChars(params: IParams): boolean;
    scrollUp(params: IParams): boolean;
    scrollDown(params: IParams, collect?: string): boolean;
    eraseChars(params: IParams): boolean;
    cursorBackwardTab(params: IParams): boolean;
    charPosAbsolute(params: IParams): boolean;
    hPositionRelative(params: IParams): boolean;
    repeatPrecedingCharacter(params: IParams): boolean;
    sendDeviceAttributesPrimary(params: IParams): boolean;
    sendDeviceAttributesSecondary(params: IParams): boolean;
    linePosAbsolute(params: IParams): boolean;
    vPositionRelative(params: IParams): boolean;
    hVPosition(params: IParams): boolean;
    tabClear(params: IParams): boolean;
    setMode(params: IParams, collect?: string): boolean;
    resetMode(params: IParams, collect?: string): boolean;
    charAttributes(params: IParams): boolean;
    deviceStatus(params: IParams, collect?: string): boolean;
    softReset(params: IParams, collect?: string): boolean;
    setCursorStyle(params: IParams, collect?: string): boolean;
    setScrollRegion(params: IParams, collect?: string): boolean;
    saveCursor(params: IParams): boolean;
    restoreCursor(params: IParams): boolean;
    insertColumns(params: IParams): boolean;
    deleteColumns(params: IParams): boolean;
    setTitle(data: string): boolean;
    setOrReportIndexedColor(data: string): boolean;
    setOrReportFgColor(data: string): boolean;
    setOrReportBgColor(data: string): boolean;
    setOrReportCursorColor(data: string): boolean;
    restoreIndexedColor(data: string): boolean;
    restoreFgColor(data: string): boolean;
    restoreBgColor(data: string): boolean;
    restoreCursorColor(data: string): boolean;
    nextLine(): boolean;
    keypadApplicationMode(): boolean;
    keypadNumericMode(): boolean;
    selectDefaultCharset(): boolean;
    selectCharset(collectAndFlag: string): boolean;
    index(): boolean;
    tabSet(): boolean;
    reverseIndex(): boolean;
    fullReset(): boolean;
    setgLevel(level: number): boolean;
    screenAlignmentPattern(): boolean;
}
export interface IParseStack {
    paused: boolean;
    cursorStartX: number;
    cursorStartY: number;
    decodedLength: number;
    position: number;
}
//# sourceMappingURL=Types.d.ts.map