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
//# sourceMappingURL=KeyboardTypes.d.ts.map