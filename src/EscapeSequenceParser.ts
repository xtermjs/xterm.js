import { IInputHandler, IInputHandlingTerminal } from './Types';
import { CHARSETS, DEFAULT_CHARSET } from './Charsets';
import { C0 } from './EscapeSequences';


// terminal interface for the escape sequence parser
export interface IParserTerminal {
    actionPrint?: (data: string, start: number, end: number) => void;
    actionOSC?: (data: string) => void;
    actionExecute?: (flag: string) => void;
    actionCSI?: (collected: string, params: number[], flag: string) => void;
    actionESC?: (collected: string, flag: string) => void;
    actionDCSHook?: (collected: string, params: number[], flag: string) => void;
    actionDCSPrint?: (data: string, start: number, end: number) => void;
    actionDCSUnhook?: () => void;
    actionError?: () => void; // FIXME: real signature and error handling
}


// FSM states
export const enum STATE {
    GROUND = 0,
    ESCAPE,
    ESCAPE_INTERMEDIATE,
    CSI_ENTRY,
    CSI_PARAM,
    CSI_INTERMEDIATE,
    CSI_IGNORE,
    SOS_PM_APC_STRING,
    OSC_STRING,
    DCS_ENTRY,
    DCS_PARAM,
    DCS_IGNORE,
    DCS_INTERMEDIATE,
    DCS_PASSTHROUGH
}

// FSM actions
export const enum ACTION {
    ignore = 0,
    error,
    print,
    execute,
    osc_start,
    osc_put,
    osc_end,
    csi_dispatch,
    param,
    collect,
    esc_dispatch,
    clear,
    dcs_hook,
    dcs_put,
    dcs_unhook
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


// transition table of the FSM
// TODO: fallback to array
export class TransitionTable {
    public table: Uint8Array;

    constructor(length: number) {
        this.table = new Uint8Array(length);
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

// default transition of the FSM is [error, GROUND]
let DEFAULT_TRANSITION = ACTION.error << 4 | STATE.GROUND;

// default DEC/ANSI compatible state transition table
// as defined by https://vt100.net/emu/dec_ansi_parser
export const VT500_TRANSITION_TABLE = (function (): TransitionTable {
    let table: TransitionTable = new TransitionTable(4095);

    let states: number[] = r(STATE.GROUND, STATE.DCS_PASSTHROUGH + 1);
    let state: any;

    // table with default transition [any] --> [error, GROUND]
    for (state in states) {
        // table lookup is capped at 0xa0 in parse
        // any higher will be treated by the error action
        for (let code = 0; code < 160; ++code) {
            table[state << 8 | code] = DEFAULT_TRANSITION;
        }
    }

    // apply transitions
    // printables
    table.addMany(PRINTABLES, STATE.GROUND, ACTION.print,  STATE.GROUND);
    // global anywhere rules
    for (state in states) {
        table.addMany([0x18, 0x1a, 0x99, 0x9a], state, ACTION.execute, STATE.GROUND);
        table.addMany(r(0x80, 0x90), state, ACTION.execute, STATE.GROUND);
        table.addMany(r(0x90, 0x98), state, ACTION.execute, STATE.GROUND);
        table.add(0x9c, state, ACTION.ignore, STATE.GROUND);    // ST as terminator
        table.add(0x1b, state, ACTION.clear, STATE.ESCAPE);     // ESC
        table.add(0x9d, state, ACTION.osc_start, STATE.OSC_STRING);  // OSC
        table.addMany([0x98, 0x9e, 0x9f], state, ACTION.ignore, STATE.SOS_PM_APC_STRING);
        table.add(0x9b, state, ACTION.clear, STATE.CSI_ENTRY);  // CSI
        table.add(0x90, state, ACTION.clear, STATE.DCS_ENTRY);  // DCS
    }
    // rules for executables and 7f
    table.addMany(EXECUTABLES, STATE.GROUND, ACTION.execute, STATE.GROUND);
    table.addMany(EXECUTABLES, STATE.ESCAPE, ACTION.execute, STATE.ESCAPE);
    table.add(0x7f, STATE.ESCAPE, ACTION.ignore, STATE.ESCAPE);
    table.addMany(EXECUTABLES, STATE.OSC_STRING, ACTION.ignore, STATE.OSC_STRING);
    table.addMany(EXECUTABLES, STATE.CSI_ENTRY, ACTION.execute, STATE.CSI_ENTRY);
    table.add(0x7f, STATE.CSI_ENTRY, ACTION.ignore, STATE.CSI_ENTRY);
    table.addMany(EXECUTABLES, STATE.CSI_PARAM, ACTION.execute, STATE.CSI_PARAM);
    table.add(0x7f, STATE.CSI_PARAM, ACTION.ignore, STATE.CSI_PARAM);
    table.addMany(EXECUTABLES, STATE.CSI_IGNORE, ACTION.execute, STATE.CSI_IGNORE);
    table.addMany(EXECUTABLES, STATE.CSI_INTERMEDIATE, ACTION.execute, STATE.CSI_INTERMEDIATE);
    table.add(0x7f, STATE.CSI_INTERMEDIATE, ACTION.ignore, STATE.CSI_INTERMEDIATE);
    table.addMany(EXECUTABLES, STATE.ESCAPE_INTERMEDIATE, ACTION.execute, STATE.ESCAPE_INTERMEDIATE);
    table.add(0x7f, STATE.ESCAPE_INTERMEDIATE, ACTION.ignore, STATE.ESCAPE_INTERMEDIATE);
    // osc
    table.add(0x5d, STATE.ESCAPE, ACTION.osc_start, STATE.OSC_STRING);
    table.addMany(PRINTABLES, STATE.OSC_STRING, ACTION.osc_put, STATE.OSC_STRING);
    table.add(0x7f, STATE.OSC_STRING, ACTION.osc_put, STATE.OSC_STRING);
    table.addMany([0x9c, 0x1b, 0x18, 0x1a, 0x07], STATE.OSC_STRING, ACTION.osc_end, STATE.GROUND);
    table.addMany(r(0x1c, 0x20), STATE.OSC_STRING, ACTION.ignore, STATE.OSC_STRING);
    // sos/pm/apc does nothing
    table.addMany([0x58, 0x5e, 0x5f], STATE.ESCAPE, ACTION.ignore, STATE.SOS_PM_APC_STRING);
    table.addMany(PRINTABLES, STATE.SOS_PM_APC_STRING, ACTION.ignore, STATE.SOS_PM_APC_STRING);
    table.addMany(EXECUTABLES, STATE.SOS_PM_APC_STRING, ACTION.ignore, STATE.SOS_PM_APC_STRING);
    table.add(0x9c, STATE.SOS_PM_APC_STRING, ACTION.ignore, STATE.GROUND);
    // csi entries
    table.add(0x5b, STATE.ESCAPE, ACTION.clear, STATE.CSI_ENTRY);
    table.addMany(r(0x40, 0x7f), STATE.CSI_ENTRY, ACTION.csi_dispatch, STATE.GROUND);
    table.addMany(r(0x30, 0x3a), STATE.CSI_ENTRY, ACTION.param, STATE.CSI_PARAM);
    table.add(0x3b, STATE.CSI_ENTRY, ACTION.param, STATE.CSI_PARAM);
    table.addMany([0x3c, 0x3d, 0x3e, 0x3f], STATE.CSI_ENTRY, ACTION.collect, STATE.CSI_PARAM);
    table.addMany(r(0x30, 0x3a), STATE.CSI_PARAM, ACTION.param, STATE.CSI_PARAM);
    table.add(0x3b, STATE.CSI_PARAM, ACTION.param, STATE.CSI_PARAM);
    table.addMany(r(0x40, 0x7f), STATE.CSI_PARAM, ACTION.csi_dispatch, STATE.GROUND);
    table.addMany([0x3a, 0x3c, 0x3d, 0x3e, 0x3f], STATE.CSI_PARAM, ACTION.ignore, STATE.CSI_IGNORE);
    table.addMany(r(0x20, 0x40), STATE.CSI_IGNORE, null, STATE.CSI_IGNORE);
    table.add(0x7f, STATE.CSI_IGNORE, null, STATE.CSI_IGNORE);
    table.addMany(r(0x40, 0x7f), STATE.CSI_IGNORE, ACTION.ignore, STATE.GROUND);
    table.add(0x3a, STATE.CSI_ENTRY, ACTION.ignore, STATE.CSI_IGNORE);
    table.addMany(r(0x20, 0x30), STATE.CSI_ENTRY, ACTION.collect, STATE.CSI_INTERMEDIATE);
    table.addMany(r(0x20, 0x30), STATE.CSI_INTERMEDIATE, ACTION.collect, STATE.CSI_INTERMEDIATE);
    table.addMany(r(0x30, 0x40), STATE.CSI_INTERMEDIATE, ACTION.ignore, STATE.CSI_IGNORE);
    table.addMany(r(0x40, 0x7f), STATE.CSI_INTERMEDIATE, ACTION.csi_dispatch, STATE.GROUND);
    table.addMany(r(0x20, 0x30), STATE.CSI_PARAM, ACTION.collect, STATE.CSI_INTERMEDIATE);
    // esc_intermediate
    table.addMany(r(0x20, 0x30), STATE.ESCAPE, ACTION.collect, STATE.ESCAPE_INTERMEDIATE);
    table.addMany(r(0x20, 0x30), STATE.ESCAPE_INTERMEDIATE, ACTION.collect, STATE.ESCAPE_INTERMEDIATE);
    table.addMany(r(0x30, 0x7f), STATE.ESCAPE_INTERMEDIATE, ACTION.esc_dispatch, STATE.GROUND);
    table.addMany(r(0x30, 0x50), STATE.ESCAPE, ACTION.esc_dispatch, STATE.GROUND);
    table.addMany(r(0x51, 0x58), STATE.ESCAPE, ACTION.esc_dispatch, STATE.GROUND);
    table.addMany([0x59, 0x5a, 0x5c], STATE.ESCAPE, ACTION.esc_dispatch, STATE.GROUND);
    table.addMany(r(0x60, 0x7f), STATE.ESCAPE, ACTION.esc_dispatch, STATE.GROUND);
    // dcs entry
    table.add(0x50, STATE.ESCAPE, ACTION.clear, STATE.DCS_ENTRY);
    table.addMany(EXECUTABLES, STATE.DCS_ENTRY, ACTION.ignore, STATE.DCS_ENTRY);
    table.add(0x7f, STATE.DCS_ENTRY, ACTION.ignore, STATE.DCS_ENTRY);
    table.addMany(r(0x1c, 0x20), STATE.DCS_ENTRY, ACTION.ignore, STATE.DCS_ENTRY);
    table.addMany(r(0x20, 0x30), STATE.DCS_ENTRY, ACTION.collect, STATE.DCS_INTERMEDIATE);
    table.add(0x3a, STATE.DCS_ENTRY, ACTION.ignore, STATE.DCS_IGNORE);
    table.addMany(r(0x30, 0x3a), STATE.DCS_ENTRY, ACTION.param, STATE.DCS_PARAM);
    table.add(0x3b, STATE.DCS_ENTRY, ACTION.param, STATE.DCS_PARAM);
    table.addMany([0x3c, 0x3d, 0x3e, 0x3f], STATE.DCS_ENTRY, ACTION.collect, STATE.DCS_PARAM);
    table.addMany(EXECUTABLES, STATE.DCS_IGNORE, ACTION.ignore, STATE.DCS_IGNORE);
    table.addMany(r(0x20, 0x80), STATE.DCS_IGNORE, ACTION.ignore, STATE.DCS_IGNORE);
    table.addMany(r(0x1c, 0x20), STATE.DCS_IGNORE, ACTION.ignore, STATE.DCS_IGNORE);
    table.addMany(EXECUTABLES, STATE.DCS_PARAM, ACTION.ignore, STATE.DCS_PARAM);
    table.add(0x7f, STATE.DCS_PARAM, ACTION.ignore, STATE.DCS_PARAM);
    table.addMany(r(0x1c, 0x20), STATE.DCS_PARAM, ACTION.ignore, STATE.DCS_PARAM);
    table.addMany(r(0x30, 0x3a), STATE.DCS_PARAM, ACTION.param, STATE.DCS_PARAM);
    table.add(0x3b, STATE.DCS_PARAM, ACTION.param, STATE.DCS_PARAM);
    table.addMany([0x3a, 0x3c, 0x3d, 0x3e, 0x3f], STATE.DCS_PARAM, ACTION.ignore, STATE.DCS_IGNORE);
    table.addMany(r(0x20, 0x30), STATE.DCS_PARAM, ACTION.collect, STATE.DCS_INTERMEDIATE);
    table.addMany(EXECUTABLES, STATE.DCS_INTERMEDIATE, ACTION.ignore, STATE.DCS_INTERMEDIATE);
    table.add(0x7f, STATE.DCS_INTERMEDIATE, ACTION.ignore, STATE.DCS_INTERMEDIATE);
    table.addMany(r(0x1c, 0x20), STATE.DCS_INTERMEDIATE, ACTION.ignore, STATE.DCS_INTERMEDIATE);
    table.addMany(r(0x20, 0x30), STATE.DCS_INTERMEDIATE, ACTION.collect, STATE.DCS_INTERMEDIATE);
    table.addMany(r(0x30, 0x40), STATE.DCS_INTERMEDIATE, ACTION.ignore, STATE.DCS_IGNORE);
    table.addMany(r(0x40, 0x7f), STATE.DCS_INTERMEDIATE, ACTION.dcs_hook, STATE.DCS_PASSTHROUGH);
    table.addMany(r(0x40, 0x7f), STATE.DCS_PARAM, ACTION.dcs_hook, STATE.DCS_PASSTHROUGH);
    table.addMany(r(0x40, 0x7f), STATE.DCS_ENTRY, ACTION.dcs_hook, STATE.DCS_PASSTHROUGH);
    table.addMany(EXECUTABLES, STATE.DCS_PASSTHROUGH, ACTION.dcs_put, STATE.DCS_PASSTHROUGH);
    table.addMany(PRINTABLES, STATE.DCS_PASSTHROUGH, ACTION.dcs_put, STATE.DCS_PASSTHROUGH);
    table.add(0x7f, STATE.DCS_PASSTHROUGH, ACTION.ignore, STATE.DCS_PASSTHROUGH);
    table.addMany([0x1b, 0x9c], STATE.DCS_PASSTHROUGH, ACTION.dcs_unhook, STATE.GROUND);

    return table;
})();


// default transition table points to global object
// Q: Copy table to allow custom sequences w'o changing global object?
export class EscapeSequenceParser {
    public initialState: number;
    public currentState: number;
    public transitions: TransitionTable;
    public osc: string;
    public params: number[];
    public collected: string;
    public term: any;
    constructor(
        terminal?: IParserTerminal | any,
        transitions: TransitionTable = VT500_TRANSITION_TABLE)
    {
        this.initialState = STATE.GROUND;
        this.currentState = this.initialState;
        this.transitions = transitions;
        this.osc = '';
        this.params = [0];
        this.collected = '';
        this.term = terminal || {};
        let instructions = [
            'actionPrint', 'actionOSC', 'actionExecute', 'actionCSI', 'actionESC',
            'actionDCSHook', 'actionDCSPrint', 'actionDCSUnhook', 'actionError'];
        for (let i = 0; i < instructions.length; ++i) {
            if (!(instructions[i] in this.term)) {
                this.term[instructions[i]] = function(): void {};
            }
        }
    }

    reset(): void {
        this.currentState = this.initialState;
        this.osc = '';
        this.params = [0];
        this.collected = '';
    }

    parse(s: string): void {
        let code = 0;
        let transition = 0;
        let error = false;
        let currentState = this.currentState;

        // local buffers
        let printed = -1;
        let dcs = -1;
        let osc = this.osc;
        let collected = this.collected;
        let params = this.params;
        let table: Uint8Array = this.transitions.table;

        // process input string
        let l = s.length;
        for (let i = 0; i < l; ++i) {
            code = s.charCodeAt(i);

            // shortcut for most chars (print action)
            if (currentState === STATE.GROUND && (code > 0x1f && code < 0x80)) {
                printed = (~printed) ? printed : i;
                continue;
            }

            // shortcut for CSI params
            if (currentState === STATE.CSI_PARAM && (code > 0x2f && code < 0x39)) {
                params[params.length - 1] = params[params.length - 1] * 10 + code - 48;
                continue;
            }

            // normal transition & action lookup
            transition = (code < 0xa0) ? (table[currentState << 8 | code]) : DEFAULT_TRANSITION;
            switch (transition >> 4) {
                case ACTION.print:
                    printed = (~printed) ? printed : i;
                    break;
                case ACTION.execute:
                    if (~printed) {
                        this.term.actionPrint(s, printed, i);
                        printed = -1;
                    }
                    this.term.actionExecute(String.fromCharCode(code));
                    break;
                case ACTION.ignore:
                    // handle leftover print or dcs chars
                    if (~printed) {
                        this.term.actionPrint(s, printed, i);
                        printed = -1;
                    } else if (~dcs) {
                        this.term.actionDCSPrint(s, dcs, i);
                        dcs = -1;
                    }
                    break;
                case ACTION.error:
                    // chars higher than 0x9f are handled by this action to
                    // keep the lookup table small
                    if (code > 0x9f) {
                        switch (currentState) {
                            case STATE.GROUND:          // add char to print string
                                printed = (~printed) ? printed : i;
                                break;
                            case STATE.OSC_STRING:      // add char to osc string
                                osc += String.fromCharCode(code);
                                transition |= STATE.OSC_STRING;
                                break;
                            case STATE.CSI_IGNORE:      // ignore char
                                transition |= STATE.CSI_IGNORE;
                                break;
                            case STATE.DCS_IGNORE:      // ignore char
                                transition |= STATE.DCS_IGNORE;
                                break;
                            case STATE.DCS_PASSTHROUGH: // add char to dcs string
                                dcs = (~dcs) ? dcs : i;
                                transition |= STATE.DCS_PASSTHROUGH;
                                break;
                            default:
                                error = true;
                        }
                    } else {
                        error = true;
                    }
                    // if we end up here a real error happened
                    // FIXME: eval and inject return values
                    if (error) {
                        if (this.term.actionError(
                                {
                                    pos: i,                 // position in string
                                    code: code,             // actual character code
                                    state: currentState,    // current state
                                    print: printed,         // print buffer start index
                                    dcs: dcs,               // dcs buffer start index
                                    osc: osc,               // osc string buffer
                                    collect: collected,     // collect buffer
                                    params: params          // params buffer
                                })) {
                            return;
                        }
                        error = false;
                    }
                    break;
                case ACTION.csi_dispatch:
                    this.term.actionCSI(collected, params, String.fromCharCode(code));
                    break;
                case ACTION.param:
                    if (code === 0x3b) params.push(0);
                    else params[params.length - 1] = params[params.length - 1] * 10 + code - 48;
                    break;
                case ACTION.collect:
                    collected += String.fromCharCode(code);
                    break;
                case ACTION.esc_dispatch:
                    this.term.actionESC(collected, String.fromCharCode(code));
                    break;
                case ACTION.clear:
                    if (~printed) {
                        this.term.actionPrint(s, printed, i);
                        printed = -1;
                    }
                    osc = '';
                    params = [0];
                    collected = '';
                    dcs = -1;
                    break;
                case ACTION.dcs_hook:
                    this.term.actionDCSHook(collected, params, String.fromCharCode(code));
                    break;
                case ACTION.dcs_put:
                    dcs = (~dcs) ? dcs : i;
                    break;
                case ACTION.dcs_unhook:
                    if (~dcs) this.term.actionDCSPrint(s, dcs, i);
                    this.term.actionDCSUnhook();
                    if (code === 0x1b) transition |= STATE.ESCAPE;
                    osc = '';
                    params = [0];
                    collected = '';
                    dcs = -1;
                    break;
                case ACTION.osc_start:
                    if (~printed) {
                        this.term.actionPrint(s, printed, i);
                        printed = -1;
                    }
                    osc = '';
                    break;
                case ACTION.osc_put:
                    osc += s.charAt(i);
                    break;
                case ACTION.osc_end:
                    if (osc && code !== 0x18 && code !== 0x1a) this.term.actionOSC(osc);
                    if (code === 0x1b) transition |= STATE.ESCAPE;
                    osc = '';
                    params = [0];
                    collected = '';
                    dcs = -1;
                    break;
            }
            currentState = transition & 15;
        }

        // push leftover pushable buffers to terminal
        if (currentState === STATE.GROUND && ~printed) {
            this.term.actionPrint(s, printed, s.length);
        } else if (currentState === STATE.DCS_PASSTHROUGH && ~dcs) {
            this.term.actionDCSPrint(s, dcs, s.length);
        }

        // save non pushable buffers
        this.osc = osc;
        this.collected = collected;
        this.params = params;

        // save state
        this.currentState = currentState;
    }
}


// glue code between AnsiParser and Terminal
// action methods are the places to call custom sequence handlers
// Q: Do we need custom handler support for all escape sequences types?
// Q: Merge class with InputHandler?
export class ParserTerminal implements IParserTerminal {
    private _parser: EscapeSequenceParser;
    private _terminal: any;
    private _inputHandler: IInputHandler;

    constructor(_inputHandler: IInputHandler, _terminal: any) {
        this._parser = new EscapeSequenceParser(this);
        this._terminal = _terminal;
        this._inputHandler = _inputHandler;
    }

    parse(data: string): void {
        const cursorStartX = this._terminal.buffer.x;
        const cursorStartY = this._terminal.buffer.y;
        if (this._terminal.debug) {
          this._terminal.log('data: ' + data);
        }

        // apply leftover surrogate high from last write
        if (this._terminal.surrogate_high) {
          data = this._terminal.surrogate_high + data;
          this._terminal.surrogate_high = '';
        }

        this._parser.parse(data);

        if (this._terminal.buffer.x !== cursorStartX || this._terminal.buffer.y !== cursorStartY) {
            this._terminal.emit('cursormove');
        }
    }

    actionPrint(data: string, start: number, end: number): void {
        let ch;
        let code;
        let low;
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
            this._inputHandler.addChar(ch, code);
        }
    }

    actionOSC(data: string): void {
        let idx = data.indexOf(';');
        let identifier = parseInt(data.substring(0, idx));
        let content = data.substring(idx + 1);

        // TODO: call custom OSC handler here

        switch (identifier) {
            case 0:
            case 1:
            case 2:
                if (content) {
                    this._terminal.title = content;
                    this._terminal.handleTitle(this._terminal.title);
                }
                break;
            case 3:
                // set X property
                break;
            case 4:
            case 5:
                // change dynamic colors
                break;
            case 10:
            case 11:
            case 12:
            case 13:
            case 14:
            case 15:
            case 16:
            case 17:
            case 18:
            case 19:
                // change dynamic ui colors
                break;
            case 46:
                // change log file
                break;
            case 50:
                // dynamic font
                break;
            case 51:
                // emacs shell
                break;
            case 52:
                // manipulate selection data
                break;
            case 104:
            case 105:
            case 110:
            case 111:
            case 112:
            case 113:
            case 114:
            case 115:
            case 116:
            case 117:
            case 118:
                // reset colors
                break;
        }
    }

    actionExecute(flag: string): void {
        // Q: No XON/XOFF handling here - where is it done?
        // Q: do we need the default fallback to addChar?
        switch (flag) {
            case C0.BEL: return this._inputHandler.bell();
            case C0.LF:
            case C0.VT:
            case C0.FF: return this._inputHandler.lineFeed();
            case C0.CR: return this._inputHandler.carriageReturn();
            case C0.BS: return this._inputHandler.backspace();
            case C0.HT: return this._inputHandler.tab();
            case C0.SO: return this._inputHandler.shiftOut();
            case C0.SI: return this._inputHandler.shiftIn();
            default:
                this._inputHandler.addChar(flag, flag.charCodeAt(0));
        }
        this._terminal.error('Unknown EXEC flag: %s.', flag);
    }

    actionCSI(collected: string, params: number[], flag: string): void {
        this._terminal.prefix = collected;
        switch (flag) {
            case '@': return this._inputHandler.insertChars(params);
            case 'A': return this._inputHandler.cursorUp(params);
            case 'B': return this._inputHandler.cursorDown(params);
            case 'C': return this._inputHandler.cursorForward(params);
            case 'D': return this._inputHandler.cursorBackward(params);
            case 'E': return this._inputHandler.cursorNextLine(params);
            case 'F': return this._inputHandler.cursorPrecedingLine(params);
            case 'G': return this._inputHandler.cursorCharAbsolute(params);
            case 'H': return this._inputHandler.cursorPosition(params);
            case 'I': return this._inputHandler.cursorForwardTab(params);
            case 'J': return this._inputHandler.eraseInDisplay(params);
            case 'K': return this._inputHandler.eraseInLine(params);
            case 'L': return this._inputHandler.insertLines(params);
            case 'M': return this._inputHandler.deleteLines(params);
            case 'P': return this._inputHandler.deleteChars(params);
            case 'S': return this._inputHandler.scrollUp(params);
            case 'T':
                // Q: Why this condition?
                if (params.length < 2 && !collected) {
                    return this._inputHandler.scrollDown(params);
                }
                break;
            case 'X': return this._inputHandler.eraseChars(params);
            case 'Z': return this._inputHandler.cursorBackwardTab(params);
            case '`': return this._inputHandler.charPosAbsolute(params);
            case 'a': return this._inputHandler.HPositionRelative(params);
            case 'b': return this._inputHandler.repeatPrecedingCharacter(params);
            case 'c': return this._inputHandler.sendDeviceAttributes(params);
            case 'd': return this._inputHandler.linePosAbsolute(params);
            case 'e': return this._inputHandler.VPositionRelative(params);
            case 'f': return this._inputHandler.HVPosition(params);
            case 'g': return this._inputHandler.tabClear(params);
            case 'h': return this._inputHandler.setMode(params);
            case 'l': return this._inputHandler.resetMode(params);
            case 'm': return this._inputHandler.charAttributes(params);
            case 'n': return this._inputHandler.deviceStatus(params);
            case 'p':
                if (collected === '!') {
                    return this._inputHandler.softReset(params);
                }
                break;
            case 'q':
                if (collected === ' ') {
                    return this._inputHandler.setCursorStyle(params);
                }
                break;
            case 'r': return this._inputHandler.setScrollRegion(params);
            case 's': return this._inputHandler.saveCursor(params);
            case 'u': return this._inputHandler.restoreCursor(params);
        }
        this._terminal.error('Unknown CSI code: %s %s %s.', collected, params, flag);
    }

    actionESC(collected: string, flag: string): void {
        switch (collected) {
            case '':
                switch (flag) {
                    // case '6':  // Back Index (DECBI), VT420 and up - not supported
                    case '7':  // Save Cursor (DECSC)
                        return this._inputHandler.saveCursor();
                    case '8':  // Restore Cursor (DECRC)
                        return this._inputHandler.restoreCursor();
                    // case '9':  // Forward Index (DECFI), VT420 and up - not supported
                    case 'D':  // Index (IND is 0x84)
                        return this._terminal.index();
                    case 'E':  // Next Line (NEL is 0x85)
                        this._terminal.buffer.x = 0;
                        this._terminal.index();
                        return;
                    case 'H':  //    ESC H   Tab Set (HTS is 0x88)
                        return (<IInputHandlingTerminal>this._terminal).tabSet();
                    case 'M':  // Reverse Index (RI is 0x8d)
                        return this._terminal.reverseIndex();
                    case 'N':  // Single Shift Select of G2 Character Set ( SS2 is 0x8e) - Is this supported?
                    case 'O':  // Single Shift Select of G3 Character Set ( SS3 is 0x8f)
                        return;
                    // case 'P':  // Device Control String (DCS is 0x90) - covered by parser
                    // case 'V':  // Start of Guarded Area (SPA is 0x96) - not supported
                    // case 'W':  // End of Guarded Area (EPA is 0x97) - not supported
                    // case 'X':  // Start of String (SOS is 0x98) - covered by parser (unsupported)
                    // case 'Z':  // Return Terminal ID (DECID is 0x9a). Obsolete form of CSI c (DA).  - not supported
                    // case '[':  // Control Sequence Introducer (CSI is 0x9b) - covered by parser
                    // case '\':  // String Terminator (ST is 0x9c) - covered by parser
                    // case ']':  //	Operating System Command (OSC is 0x9d) - covered by parser
                    // case '^':  //	Privacy Message (PM is 0x9e) - covered by parser (unsupported)
                    // case '_':  //	Application Program Command (APC is 0x9f) - covered by parser (unsupported)
                    case '=':  // Application Keypad (DECKPAM)
                        this._terminal.log('Serial port requested application keypad.');
                        this._terminal.applicationKeypad = true;
                        if (this._terminal.viewport) {
                            this._terminal.viewport.syncScrollArea();
                        }
                        return;
                    case '>':  // Normal Keypad (DECKPNM)
                        this._terminal.log('Switching back to normal keypad.');
                        this._terminal.applicationKeypad = false;
                        if (this._terminal.viewport) {
                            this._terminal.viewport.syncScrollArea();
                        }
                        return;
                    // case 'F':  // Cursor to lower left corner of screen
                    case 'c':  // Full Reset (RIS) http://vt100.net/docs/vt220-rm/chapter4.html
                        this._terminal.reset();
                        return;
                    // case 'l':  // Memory Lock (per HP terminals). Locks memory above the cursor.
                    // case 'm':  // Memory Unlock (per HP terminals).
                    case 'n':  // Invoke the G2 Character Set as GL (LS2).
                        return this._terminal.setgLevel(2);
                    case 'o':  // Invoke the G3 Character Set as GL (LS3).
                        return this._terminal.setgLevel(3);
                    case '|':  // Invoke the G3 Character Set as GR (LS3R).
                        return this._terminal.setgLevel(3);
                    case '}':  // Invoke the G2 Character Set as GR (LS2R).
                        return this._terminal.setgLevel(2);
                    case '~':  // Invoke the G1 Character Set as GR (LS1R).
                        return this._terminal.setgLevel(1);
                }
            // case ' ':
                // switch (flag) {
                    // case 'F':  // (SP) 7-bit controls (S7C1T)
                    // case 'G':  // (SP) 8-bit controls (S8C1T)
                    // case 'L':  // (SP) Set ANSI conformance level 1 (dpANS X3.134.1)
                    // case 'M':  // (SP) Set ANSI conformance level 2 (dpANS X3.134.1)
                    // case 'N':  // (SP) Set ANSI conformance level 3 (dpANS X3.134.1)
                // }

            // case '#':
                // switch (flag) {
                    // case '3':  // DEC double-height line, top half (DECDHL)
                    // case '4':  // DEC double-height line, bottom half (DECDHL)
                    // case '5':  // DEC single-width line (DECSWL)
                    // case '6':  // DEC double-width line (DECDWL)
                    // case '8':  // DEC Screen Alignment Test (DECALN)
                // }

            case '%':
                // switch (flag) {
                    // case '@':  // (%) Select default character set. That is ISO 8859-1 (ISO 2022)
                    // case 'G':  // (%) Select UTF-8 character set (ISO 2022)
                // }
                this._terminal.setgLevel(0);
                this._terminal.setgCharset(0, DEFAULT_CHARSET); // US (default)
                return;

            // load character sets
            case '(': // G0 (VT100)
                return this._terminal.setgCharset(0, CHARSETS[flag] || DEFAULT_CHARSET);
            case ')': // G1 (VT100)
                return this._terminal.setgCharset(1, CHARSETS[flag] || DEFAULT_CHARSET);
            case '*': // G2 (VT220)
                return this._terminal.setgCharset(2, CHARSETS[flag] || DEFAULT_CHARSET);
            case '+': // G3 (VT220)
                return this._terminal.setgCharset(3, CHARSETS[flag] || DEFAULT_CHARSET);
            case '-': // G1 (VT300)
                return this._terminal.setgCharset(1, CHARSETS[flag] || DEFAULT_CHARSET);
            case '.': // G2 (VT300)
                return this._terminal.setgCharset(2, CHARSETS[flag] || DEFAULT_CHARSET);
            case '/': // G3 (VT300)
                // not supported - how to deal with this? (Q: original code is not reachable?)
                return;
            default:
                this._terminal.error('Unknown ESC control: %s %s.', collected, flag);
        }
    }

    actionDCSHook(collected: string, params: number[], flag: string): void {
        // TODO + custom hook
    }

    actionDCSPrint(data: string): void {
        // TODO + custom hook
    }

    actionDCSUnhook(): void {
        // TODO + custom hook
    }

    actionError(): void {
        // TODO
    }

    // custom handler interface
    // Q: explicit like below or with an event like interface?
    // tricky part: DCS handler need to be stateful over several
    //              actionDCSPrint invocations - own base interface/abstract class type?

    registerOSCHandler(): void {
        // TODO
    }

    unregisterOSCHandler(): void {
        // TODO
    }

    registerDCSHandler(): void {
        // TODO
    }

    unregisterDCSHandler(): void {
        // TODO
    }
}
