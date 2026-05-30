import type { IDeleteEvent, IInsertEvent } from 'common/services/CircularList';
import type { UnderlineStyle } from 'common/buffer/Constants';
import type { IBufferSet } from 'common/buffer/Types';
import type { IParams } from 'common/parser/Types';
import type { IMouseStateService, ICoreService, IOptionsService, IUnicodeService } from 'common/services/Services';
import { IFunctionIdentifier, ITerminalOptions as IPublicTerminalOptions } from '@xterm/xterm';
import type { Emitter, IEvent } from 'common/base/Event';
export type { ICharset } from 'common/data/Charsets';
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
export interface IDisposable {
    dispose(): void;
}
export interface ITerminalOptions extends IPublicTerminalOptions {
    [key: string]: any;
    convertEol?: boolean;
    termName?: string;
}
export type CursorStyle = 'block' | 'underline' | 'bar';
export type CursorInactiveStyle = 'outline' | 'block' | 'bar' | 'underline' | 'none';
export type XtermListener = (...args: any[]) => void;
export interface IKeyboardEvent {
    altKey: boolean;
    ctrlKey: boolean;
    shiftKey: boolean;
    metaKey: boolean;
    keyCode: number;
    key: string;
    type: string;
    code: string;
}
export interface IScrollEvent {
    position: number;
}
export interface ICircularList<T> {
    length: number;
    maxLength: number;
    isFull: boolean;
    onDeleteEmitter: Emitter<IDeleteEvent>;
    onDelete: IEvent<IDeleteEvent>;
    onInsertEmitter: Emitter<IInsertEvent>;
    onInsert: IEvent<IInsertEvent>;
    onTrimEmitter: Emitter<number>;
    onTrim: IEvent<number>;
    get(index: number): T | undefined;
    set(index: number, value: T): void;
    push(value: T): void;
    recycle(): T;
    pop(): T | undefined;
    splice(start: number, deleteCount: number, ...items: T[]): void;
    trimStart(count: number): void;
    shiftElements(start: number, count: number, offset: number): void;
}
export declare const enum KeyboardResultType {
    SEND_KEY = 0,
    SELECT_ALL = 1,
    PAGE_UP = 2,
    PAGE_DOWN = 3
}
export interface IKeyboardResult {
    type: KeyboardResultType;
    cancel: boolean;
    key: string | undefined;
}
export type CharData = [attr: number, char: string, width: number, code: number];
export interface IColor {
    readonly css: string;
    readonly rgba: number;
}
export type IColorRGB = [red: number, green: number, blue: number];
export interface IExtendedAttrs {
    ext: number;
    underlineStyle: UnderlineStyle;
    underlineColor: number;
    underlineVariantOffset: number;
    urlId: number;
    clone(): IExtendedAttrs;
    isEmpty(): boolean;
}
export interface IOscLinkData {
    id?: string;
    uri: string;
}
export interface IAttributeData {
    fg: number;
    bg: number;
    extended: IExtendedAttrs;
    clone(): IAttributeData;
    isInverse(): number;
    isBold(): number;
    isUnderline(): number;
    isBlink(): number;
    isInvisible(): number;
    isItalic(): number;
    isDim(): number;
    isStrikethrough(): number;
    isProtected(): number;
    isOverline(): number;
    getFgColorMode(): number;
    getBgColorMode(): number;
    isFgRGB(): boolean;
    isBgRGB(): boolean;
    isFgPalette(): boolean;
    isBgPalette(): boolean;
    isFgDefault(): boolean;
    isBgDefault(): boolean;
    isAttributeDefault(): boolean;
    getFgColor(): number;
    getBgColor(): number;
    hasExtendedAttrs(): number;
    updateExtended(): void;
    getUnderlineColor(): number;
    getUnderlineColorMode(): number;
    isUnderlineColorRGB(): boolean;
    isUnderlineColorPalette(): boolean;
    isUnderlineColorDefault(): boolean;
    getUnderlineStyle(): number;
    getUnderlineVariantOffset(): number;
}
export interface ICellData extends IAttributeData {
    content: number;
    combinedData: string;
    isCombined(): number;
    getWidth(): number;
    getChars(): string;
    getCode(): number;
    setFromCharData(value: CharData): void;
    getAsCharData(): CharData;
}
export interface IBufferLine {
    length: number;
    isWrapped: boolean;
    get(index: number): CharData;
    set(index: number, value: CharData): void;
    loadCell(index: number, cell: ICellData): ICellData;
    setCell(index: number, cell: ICellData): void;
    setCellFromCodepoint(index: number, codePoint: number, width: number, attrs: IAttributeData): void;
    addCodepointToCell(index: number, codePoint: number, width: number): void;
    insertCells(pos: number, n: number, ch: ICellData): void;
    deleteCells(pos: number, n: number, fill: ICellData): void;
    replaceCells(start: number, end: number, fill: ICellData, respectProtect?: boolean): void;
    resize(cols: number, fill: ICellData): boolean;
    cleanupMemory(): number;
    fill(fillCellData: ICellData, respectProtect?: boolean): void;
    copyFrom(line: IBufferLine): void;
    clone(): IBufferLine;
    getTrimmedLength(): number;
    getNoBgTrimmedLength(): number;
    translateToString(trimRight?: boolean, startCol?: number, endCol?: number, outColumns?: number[]): string;
    getWidth(index: number): number;
    hasWidth(index: number): number;
    getFg(index: number): number;
    getBg(index: number): number;
    hasContent(index: number): number;
    getCodePoint(index: number): number;
    isCombined(index: number): number;
    getString(index: number): string;
}
export interface IMarker extends IDisposable {
    readonly id: number;
    readonly isDisposed: boolean;
    readonly line: number;
    onDispose: IEvent<void>;
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