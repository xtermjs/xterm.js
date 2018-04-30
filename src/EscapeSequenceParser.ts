import { CHARSETS, DEFAULT_CHARSET } from './Charsets';
import { C0 } from './EscapeSequences';
import { CHAR_DATA_CHAR_INDEX, CHAR_DATA_WIDTH_INDEX } from './Buffer';
import { wcwidth } from './CharWidth';
import { InputHandler } from './InputHandler';

export interface IParsingState {
    position: number;           // position in string
    code: number;               // actual character code
    currentState: ParserState;  // current state
    print: number;              // print buffer start index
    dcs: number;                // dcs buffer start index
    osc: string;                // osc string buffer
    collect: string;            // collect buffer
    params: number[];           // params buffer
    abort: boolean;             // should abort (default: false)
}

export interface IPrintHandler {
    (data: string, start: number, end: number): void;
}

export interface IExecuteHandler {
    (): void;
}

export interface ICsiHandler {
    (params: number[], collect: string): void;
}

export interface IEscHandler {
    (collect: string, flag: number): void;
}

export interface IOscHandler {
    (data: string): void;
}

export interface IDcsHandler {
    hook(collect: string, params: number[], flag: number): void;
    put(data: string, start: number, end: number): void;
    unhook(): void;
}

export interface IErrorHandler {
    (state: IParsingState): IParsingState;
}

export interface IEscapeSequenceParser {
    reset(): void;
    parse(data: string): void;

    setPrintHandler(callback: IPrintHandler): void;
    clearPrintHandler(): void;

    setExecuteHandler(flag: string, callback: IExecuteHandler): void;
    clearExecuteHandler(flag: string): void;
    setExecuteHandlerFallback(callback: (...params: any[]) => void): void;

    setCsiHandler(flag: string, callback: ICsiHandler): void;
    clearCsiHandler(flag: string): void;
    setCsiHandlerFallback(callback: (...params: any[]) => void): void;

    setEscHandler(collect: string, flag: string, callback: IEscHandler): void;
    clearEscHandler(collect: string, flag: string): void;
    setEscHandlerFallback(callback: (...params: any[]) => void): void;

    setOscHandler(ident: number, callback: IOscHandler): void;
    clearOscHandler(ident: number): void;
    setOscHandlerFallback(callback: (...params: any[]) => void): void;

    setDcsHandler(collect: string, flag: string, handler: IDcsHandler): void;
    clearDcsHandler(collect: string, flag: string): void;
    setDcsHandlerFallback(handler: IDcsHandler): void;

    setErrorHandler(callback: IErrorHandler): void;
    clearErrorHandler(): void;

    // remove after revamp of InputHandler methods
    setPrefixHandler(callback: (collect: string) => void): void;
}


// FSM states
export const enum ParserState {
    GROUND = 0,
    ESCAPE = 1,
    ESCAPE_INTERMEDIATE = 2,
    CSI_ENTRY = 3,
    CSI_PARAM = 4,
    CSI_INTERMEDIATE = 5,
    CSI_IGNORE = 6,
    SOS_PM_APC_STRING = 7,
    OSC_STRING = 8,
    DCS_ENTRY = 9,
    DCS_PARAM = 10,
    DCS_IGNORE = 11,
    DCS_INTERMEDIATE = 12,
    DCS_PASSTHROUGH = 13
}

// FSM actions
export const enum ParserAction {
    IGNORE = 0,
    ERROR = 1,
    PRINT = 2,
    EXECUTE = 3,
    OSC_START = 4,
    OSC_PUT = 5,
    OSC_END = 6,
    CSI_DISPATCH = 7,
    PARAM = 8,
    COLLECT = 9,
    ESC_DISPATCH = 10,
    CLEAR = 11,
    DCS_HOOK = 12,
    DCS_PUT = 13,
    DCS_UNHOOK = 14
}


// number range macro
function r(a: number, b: number): number[] {
    let c = b - a;
    let arr = new Array(c);
    while (c--) {
        arr[c] = --b;
    }
    return arr;
}


export class TransitionTable {
    public table: Uint8Array | number[];

    constructor(length: number) {
        this.table = (typeof Uint32Array === 'undefined')
                     ? new Array(length)
                     : new Uint32Array(length);
    }

    add(inp: number, state: number, action: number | null, next: number | null): void {
        this.table[state << 8 | inp] = ((action | 0) << 4) | ((next === undefined) ? state : next);
    }

    addMany(inps: number[], state: number, action: number | null, next: number | null): void {
        for (let i = 0; i < inps.length; i++) {
            this.add(inps[i], state, action, next);
        }
    }
}


// default definitions of printable and executable characters
let PRINTABLES = r(0x20, 0x7f);
let EXECUTABLES = r(0x00, 0x18);
EXECUTABLES.push(0x19);
EXECUTABLES.concat(r(0x1c, 0x20));

// default transition is ParserAction.ERROR, ParserState.GROUND
const DEFAULT_TRANSITION = ParserAction.ERROR << 4 | ParserState.GROUND;

// default DEC/ANSI compatible state transition table
// as defined by https://vt100.net/emu/dec_ansi_parser
export const VT500_TRANSITION_TABLE = (function (): TransitionTable {
    let table: TransitionTable = new TransitionTable(4095);

    let states: number[] = r(ParserState.GROUND, ParserState.DCS_PASSTHROUGH + 1);
    let state: any;

    // table with default transition [any] --> DEFAULT_TRANSITION
    for (state in states) {
        // table lookup is capped at 0xa0 in parse
        // any higher will be treated by the error action
        for (let code = 0; code < 160; ++code) {
            table.add(code, state, ParserAction.ERROR, ParserState.GROUND);
        }
    }

    // apply transitions
    // printables
    table.addMany(PRINTABLES, ParserState.GROUND, ParserAction.PRINT,  ParserState.GROUND);
    // global anywhere rules
    for (state in states) {
        table.addMany([0x18, 0x1a, 0x99, 0x9a], state, ParserAction.EXECUTE, ParserState.GROUND);
        table.addMany(r(0x80, 0x90), state, ParserAction.EXECUTE, ParserState.GROUND);
        table.addMany(r(0x90, 0x98), state, ParserAction.EXECUTE, ParserState.GROUND);
        table.add(0x9c, state, ParserAction.IGNORE, ParserState.GROUND);    // ST as terminator
        table.add(0x1b, state, ParserAction.CLEAR, ParserState.ESCAPE);     // ESC
        table.add(0x9d, state, ParserAction.OSC_START, ParserState.OSC_STRING);  // OSC
        table.addMany([0x98, 0x9e, 0x9f], state, ParserAction.IGNORE, ParserState.SOS_PM_APC_STRING);
        table.add(0x9b, state, ParserAction.CLEAR, ParserState.CSI_ENTRY);  // CSI
        table.add(0x90, state, ParserAction.CLEAR, ParserState.DCS_ENTRY);  // DCS
    }
    // rules for executables and 7f
    table.addMany(EXECUTABLES, ParserState.GROUND, ParserAction.EXECUTE, ParserState.GROUND);
    table.addMany(EXECUTABLES, ParserState.ESCAPE, ParserAction.EXECUTE, ParserState.ESCAPE);
    table.add(0x7f, ParserState.ESCAPE, ParserAction.IGNORE, ParserState.ESCAPE);
    table.addMany(EXECUTABLES, ParserState.OSC_STRING, ParserAction.IGNORE, ParserState.OSC_STRING);
    table.addMany(EXECUTABLES, ParserState.CSI_ENTRY, ParserAction.EXECUTE, ParserState.CSI_ENTRY);
    table.add(0x7f, ParserState.CSI_ENTRY, ParserAction.IGNORE, ParserState.CSI_ENTRY);
    table.addMany(EXECUTABLES, ParserState.CSI_PARAM, ParserAction.EXECUTE, ParserState.CSI_PARAM);
    table.add(0x7f, ParserState.CSI_PARAM, ParserAction.IGNORE, ParserState.CSI_PARAM);
    table.addMany(EXECUTABLES, ParserState.CSI_IGNORE, ParserAction.EXECUTE, ParserState.CSI_IGNORE);
    table.addMany(EXECUTABLES, ParserState.CSI_INTERMEDIATE, ParserAction.EXECUTE, ParserState.CSI_INTERMEDIATE);
    table.add(0x7f, ParserState.CSI_INTERMEDIATE, ParserAction.IGNORE, ParserState.CSI_INTERMEDIATE);
    table.addMany(EXECUTABLES, ParserState.ESCAPE_INTERMEDIATE, ParserAction.EXECUTE, ParserState.ESCAPE_INTERMEDIATE);
    table.add(0x7f, ParserState.ESCAPE_INTERMEDIATE, ParserAction.IGNORE, ParserState.ESCAPE_INTERMEDIATE);
    // osc
    table.add(0x5d, ParserState.ESCAPE, ParserAction.OSC_START, ParserState.OSC_STRING);
    table.addMany(PRINTABLES, ParserState.OSC_STRING, ParserAction.OSC_PUT, ParserState.OSC_STRING);
    table.add(0x7f, ParserState.OSC_STRING, ParserAction.OSC_PUT, ParserState.OSC_STRING);
    table.addMany([0x9c, 0x1b, 0x18, 0x1a, 0x07], ParserState.OSC_STRING, ParserAction.OSC_END, ParserState.GROUND);
    table.addMany(r(0x1c, 0x20), ParserState.OSC_STRING, ParserAction.IGNORE, ParserState.OSC_STRING);
    // sos/pm/apc does nothing
    table.addMany([0x58, 0x5e, 0x5f], ParserState.ESCAPE, ParserAction.IGNORE, ParserState.SOS_PM_APC_STRING);
    table.addMany(PRINTABLES, ParserState.SOS_PM_APC_STRING, ParserAction.IGNORE, ParserState.SOS_PM_APC_STRING);
    table.addMany(EXECUTABLES, ParserState.SOS_PM_APC_STRING, ParserAction.IGNORE, ParserState.SOS_PM_APC_STRING);
    table.add(0x9c, ParserState.SOS_PM_APC_STRING, ParserAction.IGNORE, ParserState.GROUND);
    // csi entries
    table.add(0x5b, ParserState.ESCAPE, ParserAction.CLEAR, ParserState.CSI_ENTRY);
    table.addMany(r(0x40, 0x7f), ParserState.CSI_ENTRY, ParserAction.CSI_DISPATCH, ParserState.GROUND);
    table.addMany(r(0x30, 0x3a), ParserState.CSI_ENTRY, ParserAction.PARAM, ParserState.CSI_PARAM);
    table.add(0x3b, ParserState.CSI_ENTRY, ParserAction.PARAM, ParserState.CSI_PARAM);
    table.addMany([0x3c, 0x3d, 0x3e, 0x3f], ParserState.CSI_ENTRY, ParserAction.COLLECT, ParserState.CSI_PARAM);
    table.addMany(r(0x30, 0x3a), ParserState.CSI_PARAM, ParserAction.PARAM, ParserState.CSI_PARAM);
    table.add(0x3b, ParserState.CSI_PARAM, ParserAction.PARAM, ParserState.CSI_PARAM);
    table.addMany(r(0x40, 0x7f), ParserState.CSI_PARAM, ParserAction.CSI_DISPATCH, ParserState.GROUND);
    table.addMany([0x3a, 0x3c, 0x3d, 0x3e, 0x3f], ParserState.CSI_PARAM, ParserAction.IGNORE, ParserState.CSI_IGNORE);
    table.addMany(r(0x20, 0x40), ParserState.CSI_IGNORE, null, ParserState.CSI_IGNORE);
    table.add(0x7f, ParserState.CSI_IGNORE, null, ParserState.CSI_IGNORE);
    table.addMany(r(0x40, 0x7f), ParserState.CSI_IGNORE, ParserAction.IGNORE, ParserState.GROUND);
    table.add(0x3a, ParserState.CSI_ENTRY, ParserAction.IGNORE, ParserState.CSI_IGNORE);
    table.addMany(r(0x20, 0x30), ParserState.CSI_ENTRY, ParserAction.COLLECT, ParserState.CSI_INTERMEDIATE);
    table.addMany(r(0x20, 0x30), ParserState.CSI_INTERMEDIATE, ParserAction.COLLECT, ParserState.CSI_INTERMEDIATE);
    table.addMany(r(0x30, 0x40), ParserState.CSI_INTERMEDIATE, ParserAction.IGNORE, ParserState.CSI_IGNORE);
    table.addMany(r(0x40, 0x7f), ParserState.CSI_INTERMEDIATE, ParserAction.CSI_DISPATCH, ParserState.GROUND);
    table.addMany(r(0x20, 0x30), ParserState.CSI_PARAM, ParserAction.COLLECT, ParserState.CSI_INTERMEDIATE);
    // esc_intermediate
    table.addMany(r(0x20, 0x30), ParserState.ESCAPE, ParserAction.COLLECT, ParserState.ESCAPE_INTERMEDIATE);
    table.addMany(r(0x20, 0x30), ParserState.ESCAPE_INTERMEDIATE, ParserAction.COLLECT, ParserState.ESCAPE_INTERMEDIATE);
    table.addMany(r(0x30, 0x7f), ParserState.ESCAPE_INTERMEDIATE, ParserAction.ESC_DISPATCH, ParserState.GROUND);
    table.addMany(r(0x30, 0x50), ParserState.ESCAPE, ParserAction.ESC_DISPATCH, ParserState.GROUND);
    table.addMany(r(0x51, 0x58), ParserState.ESCAPE, ParserAction.ESC_DISPATCH, ParserState.GROUND);
    table.addMany([0x59, 0x5a, 0x5c], ParserState.ESCAPE, ParserAction.ESC_DISPATCH, ParserState.GROUND);
    table.addMany(r(0x60, 0x7f), ParserState.ESCAPE, ParserAction.ESC_DISPATCH, ParserState.GROUND);
    // dcs entry
    table.add(0x50, ParserState.ESCAPE, ParserAction.CLEAR, ParserState.DCS_ENTRY);
    table.addMany(EXECUTABLES, ParserState.DCS_ENTRY, ParserAction.IGNORE, ParserState.DCS_ENTRY);
    table.add(0x7f, ParserState.DCS_ENTRY, ParserAction.IGNORE, ParserState.DCS_ENTRY);
    table.addMany(r(0x1c, 0x20), ParserState.DCS_ENTRY, ParserAction.IGNORE, ParserState.DCS_ENTRY);
    table.addMany(r(0x20, 0x30), ParserState.DCS_ENTRY, ParserAction.COLLECT, ParserState.DCS_INTERMEDIATE);
    table.add(0x3a, ParserState.DCS_ENTRY, ParserAction.IGNORE, ParserState.DCS_IGNORE);
    table.addMany(r(0x30, 0x3a), ParserState.DCS_ENTRY, ParserAction.PARAM, ParserState.DCS_PARAM);
    table.add(0x3b, ParserState.DCS_ENTRY, ParserAction.PARAM, ParserState.DCS_PARAM);
    table.addMany([0x3c, 0x3d, 0x3e, 0x3f], ParserState.DCS_ENTRY, ParserAction.COLLECT, ParserState.DCS_PARAM);
    table.addMany(EXECUTABLES, ParserState.DCS_IGNORE, ParserAction.IGNORE, ParserState.DCS_IGNORE);
    table.addMany(r(0x20, 0x80), ParserState.DCS_IGNORE, ParserAction.IGNORE, ParserState.DCS_IGNORE);
    table.addMany(r(0x1c, 0x20), ParserState.DCS_IGNORE, ParserAction.IGNORE, ParserState.DCS_IGNORE);
    table.addMany(EXECUTABLES, ParserState.DCS_PARAM, ParserAction.IGNORE, ParserState.DCS_PARAM);
    table.add(0x7f, ParserState.DCS_PARAM, ParserAction.IGNORE, ParserState.DCS_PARAM);
    table.addMany(r(0x1c, 0x20), ParserState.DCS_PARAM, ParserAction.IGNORE, ParserState.DCS_PARAM);
    table.addMany(r(0x30, 0x3a), ParserState.DCS_PARAM, ParserAction.PARAM, ParserState.DCS_PARAM);
    table.add(0x3b, ParserState.DCS_PARAM, ParserAction.PARAM, ParserState.DCS_PARAM);
    table.addMany([0x3a, 0x3c, 0x3d, 0x3e, 0x3f], ParserState.DCS_PARAM, ParserAction.IGNORE, ParserState.DCS_IGNORE);
    table.addMany(r(0x20, 0x30), ParserState.DCS_PARAM, ParserAction.COLLECT, ParserState.DCS_INTERMEDIATE);
    table.addMany(EXECUTABLES, ParserState.DCS_INTERMEDIATE, ParserAction.IGNORE, ParserState.DCS_INTERMEDIATE);
    table.add(0x7f, ParserState.DCS_INTERMEDIATE, ParserAction.IGNORE, ParserState.DCS_INTERMEDIATE);
    table.addMany(r(0x1c, 0x20), ParserState.DCS_INTERMEDIATE, ParserAction.IGNORE, ParserState.DCS_INTERMEDIATE);
    table.addMany(r(0x20, 0x30), ParserState.DCS_INTERMEDIATE, ParserAction.COLLECT, ParserState.DCS_INTERMEDIATE);
    table.addMany(r(0x30, 0x40), ParserState.DCS_INTERMEDIATE, ParserAction.IGNORE, ParserState.DCS_IGNORE);
    table.addMany(r(0x40, 0x7f), ParserState.DCS_INTERMEDIATE, ParserAction.DCS_HOOK, ParserState.DCS_PASSTHROUGH);
    table.addMany(r(0x40, 0x7f), ParserState.DCS_PARAM, ParserAction.DCS_HOOK, ParserState.DCS_PASSTHROUGH);
    table.addMany(r(0x40, 0x7f), ParserState.DCS_ENTRY, ParserAction.DCS_HOOK, ParserState.DCS_PASSTHROUGH);
    table.addMany(EXECUTABLES, ParserState.DCS_PASSTHROUGH, ParserAction.DCS_PUT, ParserState.DCS_PASSTHROUGH);
    table.addMany(PRINTABLES, ParserState.DCS_PASSTHROUGH, ParserAction.DCS_PUT, ParserState.DCS_PASSTHROUGH);
    table.add(0x7f, ParserState.DCS_PASSTHROUGH, ParserAction.IGNORE, ParserState.DCS_PASSTHROUGH);
    table.addMany([0x1b, 0x9c], ParserState.DCS_PASSTHROUGH, ParserAction.DCS_UNHOOK, ParserState.GROUND);

    return table;
})();

// fallback dummy DCS handler, does really nothing
class DcsDummy implements IDcsHandler {
    hook(collect: string, params: number[], flag: number): void {}
    put(data: string, start: number, end: number): void {}
    unhook(): void {}
}

// default transition table points to global object
// Q: Copy table to allow custom sequences w'o changing global object?
export class EscapeSequenceParser implements IEscapeSequenceParser {
    public initialState: number;
    public currentState: number;
    readonly transitions: TransitionTable;

    // buffers over several parse calls
    protected _osc: string;
    protected _params: number[];
    protected _collect: string;

    // callback slots
    protected _printHandler: IPrintHandler;
    protected _executeHandlers: any;
    protected _csiHandlers: any;
    protected _escHandlers: any;
    protected _oscHandlers: any;
    protected _dcsHandlers: any;
    protected _activeDcsHandler: IDcsHandler | null;
    protected _errorHandler: IErrorHandler;

    // fallback handlers
    protected _printHandlerFb: IPrintHandler;
    protected _executeHandlerFb: (...params: any[]) => void;
    protected _csiHandlerFb: (...params: any[]) => void;
    protected _escHandlerFb: (...params: any[]) => void;
    protected _oscHandlerFb: (...params: any[]) => void;
    protected _dcsHandlerFb: IDcsHandler;
    protected _errorHandlerFb: IErrorHandler;

    // FIXME: to be removed
    protected _tempPrefixHandler: any;

    constructor(transitions: TransitionTable = VT500_TRANSITION_TABLE) {
        this.initialState = ParserState.GROUND;
        this.currentState = this.initialState;
        this.transitions = transitions;
        this._osc = '';
        this._params = [0];
        this._collect = '';

        // set default fallback handlers
        this._printHandlerFb = (data, start, end): void => {};
        this._executeHandlerFb = (...params: any[]): void => {};
        this._csiHandlerFb = (...params: any[]): void => {};
        this._escHandlerFb = (...params: any[]): void => {};
        this._oscHandlerFb = (...params: any[]): void => {};
        this._dcsHandlerFb = new DcsDummy;
        this._errorHandlerFb = (state: IParsingState): IParsingState => state;

        this._printHandler = this._printHandlerFb;
        this._executeHandlers = Object.create(null);
        this._csiHandlers = Object.create(null);
        this._escHandlers = Object.create(null);
        this._oscHandlers = Object.create(null);
        this._dcsHandlers = Object.create(null);
        this._activeDcsHandler = null;
        this._errorHandler = this._errorHandlerFb;
    }

    setPrintHandler(callback: IPrintHandler): void {
        this._printHandler = callback;
    }
    clearPrintHandler(): void {
        this._printHandler = this._printHandlerFb;
    }

    setExecuteHandler(flag: string, callback: IExecuteHandler): void {
        this._executeHandlers[flag.charCodeAt(0)] = callback;
    }
    clearExecuteHandler(flag: string): void {
        if (this._executeHandlers[flag.charCodeAt(0)]) delete this._executeHandlers[flag.charCodeAt(0)];
    }
    setExecuteHandlerFallback(callback: (...params: any[]) => void): void {
        this._escHandlerFb = callback;
    }

    setCsiHandler(flag: string, callback: ICsiHandler): void {
        this._csiHandlers[flag.charCodeAt(0)] = callback;
    }
    clearCsiHandler(flag: string): void {
        if (this._csiHandlers[flag.charCodeAt(0)]) delete this._csiHandlers[flag.charCodeAt(0)];
    }
    setCsiHandlerFallback(callback: (...params: any[]) => void): void {
        this._csiHandlerFb = callback;
    }

    setEscHandler(collect: string, flag: string, callback: IEscHandler): void {
        this._escHandlers[collect + flag] = callback;
    }
    clearEscHandler(collect: string, flag: string): void {
        if (this._escHandlers[collect + flag]) delete this._escHandlers[collect + flag];
    }
    setEscHandlerFallback(callback: (...params: any[]) => void): void {
        this._escHandlerFb = callback;
    }

    setOscHandler(ident: number, callback: IOscHandler): void {
        this._oscHandlers[ident] = callback;
    }
    clearOscHandler(ident: number): void {
        if (this._oscHandlers[ident]) delete this._oscHandlers[ident];
    }
    setOscHandlerFallback(callback: (...params: any[]) => void): void {
        this._oscHandlerFb = callback;
    }

    setDcsHandler(collect: string, flag: string, handler: IDcsHandler): void {
        this._dcsHandlers[collect + flag] = handler;
    }
    clearDcsHandler(collect: string, flag: string): void {
        if (this._dcsHandlers[collect + flag]) delete this._dcsHandlers[collect + flag];
    }
    setDcsHandlerFallback(handler: IDcsHandler): void {
        this._dcsHandlerFb = handler;
    }

    setErrorHandler(callback: IErrorHandler): void {
        this._errorHandler = callback;
    }
    clearErrorHandler(): void {
        this._errorHandler = this._errorHandlerFb;
    }

    // FIXME: to be removed
    setPrefixHandler(callback: (collect: string) => void): void {
        this._tempPrefixHandler = callback;
    }

    reset(): void {
        this.currentState = this.initialState;
        this._osc = '';
        this._params = [0];
        this._collect = '';
    }

    parse(data: string): void {
        let code = 0;
        let transition = 0;
        let error = false;
        let currentState = this.currentState;

        // local buffers
        let print = -1;
        let dcs = -1;
        let osc = this._osc;
        let collect = this._collect;
        let params = this._params;
        let table: Uint8Array | number[] = this.transitions.table;
        let dcsHandler: IDcsHandler | null = this._activeDcsHandler;
        let ident: string = '';

        // process input string
        let l = data.length;
        for (let i = 0; i < l; ++i) {
            code = data.charCodeAt(i);

            // shortcut for most chars (print action)
            if (currentState === ParserState.GROUND && code > 0x1f && code < 0x80) {
                print = (~print) ? print : i;
                do code = data.charCodeAt(++i);
                while (i < l && code > 0x1f && code < 0x80);
                i--;
                continue;
            }

            // shortcut for CSI params
            if (currentState === ParserState.CSI_PARAM && (code > 0x2f && code < 0x39)) {
                params[params.length - 1] = params[params.length - 1] * 10 + code - 48;
                continue;
            }

            // normal transition & action lookup
            transition = (code < 0xa0) ? (table[currentState << 8 | code]) : DEFAULT_TRANSITION;
            switch (transition >> 4) {
                case ParserAction.PRINT:
                    print = (~print) ? print : i;
                    break;
                case ParserAction.EXECUTE:
                    if (~print) {
                        this._printHandler(data, print, i);
                        print = -1;
                    }
                    if (this._executeHandlers[code]) this._executeHandlers[code]();
                    else this._executeHandlerFb(code);
                    break;
                case ParserAction.IGNORE:
                    // handle leftover print or dcs chars
                    if (~print) {
                        this._printHandler(data, print, i);
                        print = -1;
                    } else if (~dcs) {
                        dcsHandler.put(data, dcs, i);
                        dcs = -1;
                    }
                    break;
                case ParserAction.ERROR:
                    // chars higher than 0x9f are handled by this action to
                    // keep the lookup table small
                    if (code > 0x9f) {
                        switch (currentState) {
                            case ParserState.GROUND:
                                print = (~print) ? print : i;
                                break;
                            case ParserState.OSC_STRING:
                                osc += String.fromCharCode(code);
                                transition |= ParserState.OSC_STRING;
                                break;
                            case ParserState.CSI_IGNORE:
                                transition |= ParserState.CSI_IGNORE;
                                break;
                            case ParserState.DCS_IGNORE:
                                transition |= ParserState.DCS_IGNORE;
                                break;
                            case ParserState.DCS_PASSTHROUGH:
                                dcs = (~dcs) ? dcs : i;
                                transition |= ParserState.DCS_PASSTHROUGH;
                                break;
                            default:
                                error = true;
                        }
                    } else {
                        error = true;
                    }
                    // if we end up here a real error happened
                    if (error) {
                        let inject: IParsingState = this._errorHandler(
                                {
                                    position: i,
                                    code,
                                    currentState,
                                    print,
                                    dcs,
                                    osc,
                                    collect,
                                    params,
                                    abort: false
                                });
                        if (inject.abort) return;
                        // FIXME: inject return values
                        error = false;
                    }
                    break;
                case ParserAction.CSI_DISPATCH:
                    this._tempPrefixHandler(collect);  // FIXME: to be removed
                    if (this._csiHandlers[code]) this._csiHandlers[code](params, collect);
                    else this._csiHandlerFb(collect, params, code);
                    break;
                case ParserAction.PARAM:
                    if (code === 0x3b) params.push(0);
                    else params[params.length - 1] = params[params.length - 1] * 10 + code - 48;
                    break;
                case ParserAction.COLLECT:
                    collect += String.fromCharCode(code);
                    break;
                case ParserAction.ESC_DISPATCH:
                    ident = collect + String.fromCharCode(code);
                    if (this._escHandlers[ident]) this._escHandlers[ident](collect, code);
                    else this._escHandlerFb(collect, code);
                    break;
                case ParserAction.CLEAR:
                    if (~print) {
                        this._printHandler(data, print, i);
                        print = -1;
                    }
                    osc = '';
                    params = [0];
                    collect = '';
                    dcs = -1;
                    break;
                case ParserAction.DCS_HOOK:
                    ident = collect + String.fromCharCode(code);
                    if (this._dcsHandlers[ident]) dcsHandler = this._dcsHandlers[ident];
                    else dcsHandler = this._dcsHandlerFb;
                    dcsHandler.hook(collect, params, code);
                    break;
                case ParserAction.DCS_PUT:
                    dcs = (~dcs) ? dcs : i;
                    break;
                case ParserAction.DCS_UNHOOK:
                    if (~dcs) dcsHandler.put(data, dcs, i);
                    dcsHandler.unhook();
                    dcsHandler = null;
                    if (code === 0x1b) transition |= ParserState.ESCAPE;
                    osc = '';
                    params = [0];
                    collect = '';
                    dcs = -1;
                    break;
                case ParserAction.OSC_START:
                    if (~print) {
                        this._printHandler(data, print, i);
                        print = -1;
                    }
                    osc = '';
                    break;
                case ParserAction.OSC_PUT:
                    osc += data.charAt(i);
                    break;
                case ParserAction.OSC_END:
                    if (osc && code !== 0x18 && code !== 0x1a) {
                        let idx = osc.indexOf(';');
                        let identifier = parseInt(osc.substring(0, idx));
                        let content = osc.substring(idx + 1);
                        if (this._oscHandlers[identifier]) this._oscHandlers[identifier](content);
                        else this._oscHandlerFb(identifier, content);
                    }
                    if (code === 0x1b) transition |= ParserState.ESCAPE;
                    osc = '';
                    params = [0];
                    collect = '';
                    dcs = -1;
                    break;
            }
            currentState = transition & 15;
        }

        // push leftover pushable buffers to terminal
        if (currentState === ParserState.GROUND && ~print) {
            this._printHandler(data, print, data.length);
        } else if (currentState === ParserState.DCS_PASSTHROUGH && ~dcs) {
            dcsHandler.put(data, dcs, data.length);
        }

        // save non pushable buffers
        this._osc = osc;
        this._collect = collect;
        this._params = params;

        // save active dcs handler reference
        this._activeDcsHandler = dcsHandler;

        // save state
        this.currentState = currentState;
    }
}


export class ParserTerminal extends InputHandler {
    private _parser: EscapeSequenceParser;

    constructor(_terminal: any) {
        super(_terminal);
        this._parser = new EscapeSequenceParser;

        // custom fallback handlers
        this._parser.setCsiHandlerFallback((...params: any[]) => {
            this._terminal.error('Unknown CSI code: ', params);
        });
        this._parser.setEscHandlerFallback((...params: any[]) => {
            this._terminal.error('Unknown ESC code: ', params);
        });
        this._parser.setExecuteHandlerFallback((...params: any[]) => {
            this._terminal.error('Unknown EXECUTE code: ', params);
        });
        this._parser.setOscHandlerFallback((...params: any[]) => {
            this._terminal.error('Unknown OSC code: ', params);
        });

        // FIXME: remove temporary fix to get collect to terminal
        this._parser.setPrefixHandler((collect: string) => { this._terminal.prefix = collect; });

        // print handler
        this._parser.setPrintHandler(this.print.bind(this));

        // CSI handler
        this._parser.setCsiHandler('@', this.insertChars.bind(this));
        this._parser.setCsiHandler('A', this.cursorUp.bind(this));
        this._parser.setCsiHandler('B', this.cursorDown.bind(this));
        this._parser.setCsiHandler('C', this.cursorForward.bind(this));
        this._parser.setCsiHandler('D', this.cursorBackward.bind(this));
        this._parser.setCsiHandler('E', this.cursorNextLine.bind(this));
        this._parser.setCsiHandler('F', this.cursorPrecedingLine.bind(this));
        this._parser.setCsiHandler('G', this.cursorCharAbsolute.bind(this));
        this._parser.setCsiHandler('H', this.cursorPosition.bind(this));
        this._parser.setCsiHandler('I', this.cursorForwardTab.bind(this));
        this._parser.setCsiHandler('J', this.eraseInDisplay.bind(this));
        this._parser.setCsiHandler('K', this.eraseInLine.bind(this));
        this._parser.setCsiHandler('L', this.insertLines.bind(this));
        this._parser.setCsiHandler('M', this.deleteLines.bind(this));
        this._parser.setCsiHandler('P', this.deleteChars.bind(this));
        this._parser.setCsiHandler('S', this.scrollUp.bind(this));
        this._parser.setCsiHandler('T',
            (params, collect) => {
                if (params.length < 2 && !collect) {
                    return this.scrollDown(params);
                }
            });
        this._parser.setCsiHandler('X', this.eraseChars.bind(this));
        this._parser.setCsiHandler('Z', this.cursorBackwardTab.bind(this));
        this._parser.setCsiHandler('`', this.charPosAbsolute.bind(this));
        this._parser.setCsiHandler('a', this.HPositionRelative.bind(this));
        this._parser.setCsiHandler('b', this.repeatPrecedingCharacter.bind(this));
        this._parser.setCsiHandler('c', this.sendDeviceAttributes.bind(this)); // fix collect
        this._parser.setCsiHandler('d', this.linePosAbsolute.bind(this));
        this._parser.setCsiHandler('e', this.VPositionRelative.bind(this));
        this._parser.setCsiHandler('f', this.HVPosition.bind(this));
        this._parser.setCsiHandler('g', this.tabClear.bind(this));
        this._parser.setCsiHandler('h', this.setMode.bind(this));  // fix collect
        this._parser.setCsiHandler('l', this.resetMode.bind(this)); // fix collect
        this._parser.setCsiHandler('m', this.charAttributes.bind(this));
        this._parser.setCsiHandler('n', this.deviceStatus.bind(this)); // fix collect
        this._parser.setCsiHandler('p',
            (params, collect) => {
                if (collect === '!') {
                    return this.softReset(params);
                }
            });
        this._parser.setCsiHandler('q',
            (params, collect) => {
                if (collect === ' ') {
                    return this.setCursorStyle(params);
                }
            });
        this._parser.setCsiHandler('r', this.setScrollRegion.bind(this)); // fix collect
        this._parser.setCsiHandler('s', this.saveCursor.bind(this));
        this._parser.setCsiHandler('u', this.restoreCursor.bind(this));

        // execute handler
        this._parser.setExecuteHandler(C0.BEL, this.bell.bind(this));
        this._parser.setExecuteHandler(C0.LF, this.lineFeed.bind(this));
        this._parser.setExecuteHandler(C0.VT, this.lineFeed.bind(this));
        this._parser.setExecuteHandler(C0.FF, this.lineFeed.bind(this));
        this._parser.setExecuteHandler(C0.CR, this.carriageReturn.bind(this));
        this._parser.setExecuteHandler(C0.BS, this.backspace.bind(this));
        this._parser.setExecuteHandler(C0.HT, this.tab.bind(this));
        this._parser.setExecuteHandler(C0.SO, this.shiftOut.bind(this));
        this._parser.setExecuteHandler(C0.SI, this.shiftIn.bind(this));
        // FIXME:   What do to with missing? Old code just added those to print, but that's wrong
        //          behavior for most control codes.

        // OSC handler
        //   0 - icon name + title
        this._parser.setOscHandler(0, this._terminal.handleTitle.bind(this._terminal));
        //   1 - icon name
        //   2 - title
        this._parser.setOscHandler(2, this._terminal.handleTitle.bind(this._terminal));
        //   3 - set property X in the form "prop=value"
        //   4 - Change Color Number
        //   5 - Change Special Color Number
        //   6 - Enable/disable Special Color Number c
        //   7 - current directory? (not in xterm spec, see https://gitlab.com/gnachman/iterm2/issues/3939)
        //  10 - Change VT100 text foreground color to Pt.
        //  11 - Change VT100 text background color to Pt.
        //  12 - Change text cursor color to Pt.
        //  13 - Change mouse foreground color to Pt.
        //  14 - Change mouse background color to Pt.
        //  15 - Change Tektronix foreground color to Pt.
        //  16 - Change Tektronix background color to Pt.
        //  17 - Change highlight background color to Pt.
        //  18 - Change Tektronix cursor color to Pt.
        //  19 - Change highlight foreground color to Pt.
        //  46 - Change Log File to Pt.
        //  50 - Set Font to Pt.
        //  51 - reserved for Emacs shell.
        //  52 - Manipulate Selection Data.
        // 104 ; c - Reset Color Number c.
        // 105 ; c - Reset Special Color Number c.
        // 106 ; c; f - Enable/disable Special Color Number c.
        // 110 - Reset VT100 text foreground color.
        // 111 - Reset VT100 text background color.
        // 112 - Reset text cursor color.
        // 113 - Reset mouse foreground color.
        // 114 - Reset mouse background color.
        // 115 - Reset Tektronix foreground color.
        // 116 - Reset Tektronix background color.
        // 117 - Reset highlight color.
        // 118 - Reset Tektronix cursor color.
        // 119 - Reset highlight foreground color.

        // ESC handlers
        this._parser.setEscHandler('', '7', this.saveCursor.bind(this));
        this._parser.setEscHandler('', '8', this.restoreCursor.bind(this));
        this._parser.setEscHandler('', 'D', this._terminal.index.bind(this._terminal));
        this._parser.setEscHandler('', 'E', () => {
            this._terminal.buffer.x = 0;
            this._terminal.index();
        });
        this._parser.setEscHandler('', 'H', this._terminal.tabSet.bind(this._terminal));
        this._parser.setEscHandler('', 'M', this._terminal.reverseIndex.bind(this._terminal));
        this._parser.setEscHandler('', '=', () => {
            this._terminal.log('Serial port requested application keypad.');
            this._terminal.applicationKeypad = true;
            if (this._terminal.viewport) {
                this._terminal.viewport.syncScrollArea();
            }
        });
        this._parser.setEscHandler('', '>', () => {
            this._terminal.log('Switching back to normal keypad.');
            this._terminal.applicationKeypad = false;
            if (this._terminal.viewport) {
                this._terminal.viewport.syncScrollArea();
            }
        });
        this._parser.setEscHandler('', 'c', this._terminal.reset.bind(this._terminal));
        this._parser.setEscHandler('', 'n', () => this._terminal.setgLevel(2));
        this._parser.setEscHandler('', 'o', () => this._terminal.setgLevel(3));
        this._parser.setEscHandler('', '|', () => this._terminal.setgLevel(3));
        this._parser.setEscHandler('', '}', () => this._terminal.setgLevel(2));
        this._parser.setEscHandler('', '~', () => this._terminal.setgLevel(1));

        this._parser.setEscHandler('%', '@', () => {
            this._terminal.setgLevel(0);
            this._terminal.setgCharset(0, DEFAULT_CHARSET); // US (default)
        });
        this._parser.setEscHandler('%', 'G', () => {
            this._terminal.setgLevel(0);
            this._terminal.setgCharset(0, DEFAULT_CHARSET); // US (default)
        });
        for (let flag in CHARSETS) {
            this._parser.setEscHandler('(', flag, () => this._terminal.setgCharset(0, CHARSETS[flag] || DEFAULT_CHARSET));
            this._parser.setEscHandler(')', flag, () => this._terminal.setgCharset(1, CHARSETS[flag] || DEFAULT_CHARSET));
            this._parser.setEscHandler('*', flag, () => this._terminal.setgCharset(2, CHARSETS[flag] || DEFAULT_CHARSET));
            this._parser.setEscHandler('+', flag, () => this._terminal.setgCharset(3, CHARSETS[flag] || DEFAULT_CHARSET));
            this._parser.setEscHandler('-', flag, () => this._terminal.setgCharset(1, CHARSETS[flag] || DEFAULT_CHARSET));
            this._parser.setEscHandler('.', flag, () => this._terminal.setgCharset(2, CHARSETS[flag] || DEFAULT_CHARSET));
        }

        // error handler
        this._parser.setErrorHandler((state) => {
            this._terminal.error('Parsing error: ', state);
            return state;
        });
    }

    parse(data: string): void {
        let buffer = this._terminal.buffer;
        const cursorStartX = buffer.x;
        const cursorStartY = buffer.y;
        if (this._terminal.debug) {
          this._terminal.log('data: ' + data);
        }

        // apply leftover surrogate high from last write
        if (this._terminal.surrogate_high) {
          data = this._terminal.surrogate_high + data;  // FIXME: avoid string copy --> move to print
          this._terminal.surrogate_high = '';
        }

        this._parser.parse(data);

        buffer = this._terminal.buffer;
        if (buffer.x !== cursorStartX || buffer.y !== cursorStartY) {
            this._terminal.emit('cursormove');
        }
    }

    print(data: string, start: number, end: number): void {
        let ch;
        let code;
        let low;
        let chWidth;
        const buffer = this._terminal.buffer;
        for (let i = start; i < end; ++i) {
            ch = data.charAt(i);
            code = data.charCodeAt(i);
            if (0xD800 <= code && code <= 0xDBFF) {
              // we got a surrogate high
              // get surrogate low (next 2 bytes)
              low = data.charCodeAt(i + 1);
              if (isNaN(low)) {
                // end of data stream, save surrogate high
                this._terminal.surrogate_high = ch;
                continue;
              }
              code = ((code - 0xD800) * 0x400) + (low - 0xDC00) + 0x10000;
              ch += data.charAt(i + 1);
            }
            // surrogate low - already handled above
            if (0xDC00 <= code && code <= 0xDFFF) {
              continue;
            }

            // calculate print space
            // expensive call, therefore we save width in line buffer
            chWidth = wcwidth(code);

            if (this._terminal.charset && this._terminal.charset[ch]) {
                ch = this._terminal.charset[ch];
            }

            if (this._terminal.options.screenReaderMode) {
                this._terminal.emit('a11y.char', ch);
            }

            let row = buffer.y + buffer.ybase;

            // insert combining char in last cell
            // FIXME: needs handling after cursor jumps
            if (!chWidth && buffer.x) {
                // dont overflow left
                if (buffer.lines.get(row)[buffer.x - 1]) {
                    if (!buffer.lines.get(row)[buffer.x - 1][CHAR_DATA_WIDTH_INDEX]) {
                        // found empty cell after fullwidth, need to go 2 cells back
                        if (buffer.lines.get(row)[buffer.x - 2]) {
                            buffer.lines.get(row)[buffer.x - 2][CHAR_DATA_CHAR_INDEX] += ch;
                            buffer.lines.get(row)[buffer.x - 2][3] = ch.charCodeAt(0);
                        }
                    } else {
                        buffer.lines.get(row)[buffer.x - 1][CHAR_DATA_CHAR_INDEX] += ch;
                        buffer.lines.get(row)[buffer.x - 1][3] = ch.charCodeAt(0);
                    }
                    this._terminal.updateRange(buffer.y);
                }
                continue;
            }

            // goto next line if ch would overflow
            // TODO: needs a global min terminal width of 2
            if (buffer.x + chWidth - 1 >= this._terminal.cols) {
                // autowrap - DECAWM
                if (this._terminal.wraparoundMode) {
                    buffer.x = 0;
                    buffer.y++;
                    if (buffer.y > buffer.scrollBottom) {
                        buffer.y--;
                        this._terminal.scroll(true);
                    } else {
                        // The line already exists (eg. the initial viewport), mark it as a
                        // wrapped line
                        (<any>buffer.lines.get(buffer.y)).isWrapped = true;
                    }
                } else {
                    if (chWidth === 2) { // FIXME: check for xterm behavior
                        continue;
                    }
                }
            }
            row = buffer.y + buffer.ybase;

            // insert mode: move characters to right
            if (this._terminal.insertMode) {
                // do this twice for a fullwidth char
                for (let moves = 0; moves < chWidth; ++moves) {
                    // remove last cell, if it's width is 0
                    // we have to adjust the second last cell as well
                    const removed = buffer.lines.get(buffer.y + buffer.ybase).pop();
                    if (removed[CHAR_DATA_WIDTH_INDEX] === 0
                        && buffer.lines.get(row)[this._terminal.cols - 2]
                        && buffer.lines.get(row)[this._terminal.cols - 2][CHAR_DATA_WIDTH_INDEX] === 2) {
                    buffer.lines.get(row)[this._terminal.cols - 2] = [this._terminal.curAttr, ' ', 1, ' '.charCodeAt(0)];
                    }

                    // insert empty cell at cursor
                    buffer.lines.get(row).splice(buffer.x, 0, [this._terminal.curAttr, ' ', 1, ' '.charCodeAt(0)]);
                }
            }

            buffer.lines.get(row)[buffer.x] = [this._terminal.curAttr, ch, chWidth, ch.charCodeAt(0)];
            buffer.x++;
            this._terminal.updateRange(buffer.y);

            // fullwidth char - set next cell width to zero and advance cursor
            if (chWidth === 2) {
                buffer.lines.get(row)[buffer.x] = [this._terminal.curAttr, '', 0, undefined];
                buffer.x++;
            }
        }
    }
}
