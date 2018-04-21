export interface IParserTerminal {
    inst_p?: (s: string, start: number, end: number) => void;
    inst_o?: (s: string) => void;
    inst_x?: (flag: string) => void;
    inst_c?: (collected: string, params: number[], flag: string) => void;
    inst_e?: (collected: string, flag: string) => void;
    inst_H?: (collected: string, params: number[], flag: string) => void;
    inst_P?: (dcs: string) => void;
    inst_U?: () => void;
    inst_E?: () => void; // TODO: real signature
}


export function r(a: number, b: number): number[] {
    let c = b - a;
    let arr = new Array(c);
    while (c--) {
        arr[c] = --b;
    }
    return arr;
}


export class TransitionTable {
    public table: Uint8Array;
    constructor(length: number) {
        this.table = new Uint8Array(length);
    }
    add(inp: number, state: number, action: number | null, next: number | null): void {
        this.table[state << 8 | inp] = ((action | 0) << 4) | ((next === undefined) ? state : next);
    }
    add_list(inps: number[], state: number, action: number | null, next: number | null): void {
        for (let i = 0; i < inps.length; i++) {
            this.add(inps[i], state, action, next);
        }
    }
}


let PRINTABLES = r(0x20, 0x7f);
let EXECUTABLES = r(0x00, 0x18);
EXECUTABLES.push(0x19);
EXECUTABLES.concat(r(0x1c, 0x20));


export const TRANSITION_TABLE = (function (): TransitionTable {
    let t: TransitionTable = new TransitionTable(4095);

    // table with default transition [any] --> [error, GROUND]
    for (let state = 0; state < 14; ++state) {
        for (let code = 0; code < 160; ++code) {
            t[state << 8 | code] = 16;
        }
    }

    // apply transitions
    // printables
    t.add_list(PRINTABLES, 0, 2, 0);
    // global anywhere rules
    for (let state = 0; state < 14; ++state) {
        t.add_list([0x18, 0x1a, 0x99, 0x9a], state, 3, 0);
        t.add_list(r(0x80, 0x90), state, 3, 0);
        t.add_list(r(0x90, 0x98), state, 3, 0);
        t.add(0x9c, state, 0, 0);   // ST as terminator
        t.add(0x1b, state, 11, 1);  // ESC
        t.add(0x9d, state, 4, 8);   // OSC
        t.add_list([0x98, 0x9e, 0x9f], state, 0, 7);
        t.add(0x9b, state, 11, 3);  // CSI
        t.add(0x90, state, 11, 9);  // DCS
    }
    // rules for executables and 7f
    t.add_list(EXECUTABLES, 0, 3, 0);
    t.add_list(EXECUTABLES, 1, 3, 1);
    t.add(0x7f, 1, null, 1);
    t.add_list(EXECUTABLES, 8, null, 8);
    t.add_list(EXECUTABLES, 3, 3, 3);
    t.add(0x7f, 3, null, 3);
    t.add_list(EXECUTABLES, 4, 3, 4);
    t.add(0x7f, 4, null, 4);
    t.add_list(EXECUTABLES, 6, 3, 6);
    t.add_list(EXECUTABLES, 5, 3, 5);
    t.add(0x7f, 5, null, 5);
    t.add_list(EXECUTABLES, 2, 3, 2);
    t.add(0x7f, 2, null, 2);
    // osc
    t.add(0x5d, 1, 4, 8);
    t.add_list(PRINTABLES, 8, 5, 8);
    t.add(0x7f, 8, 5, 8);
    t.add_list([0x9c, 0x1b, 0x18, 0x1a, 0x07], 8, 6, 0);
    t.add_list(r(0x1c, 0x20), 8, 0, 8);
    // sos/pm/apc does nothing
    t.add_list([0x58, 0x5e, 0x5f], 1, 0, 7);
    t.add_list(PRINTABLES, 7, null, 7);
    t.add_list(EXECUTABLES, 7, null, 7);
    t.add(0x9c, 7, 0, 0);
    // csi entries
    t.add(0x5b, 1, 11, 3);
    t.add_list(r(0x40, 0x7f), 3, 7, 0);
    t.add_list(r(0x30, 0x3a), 3, 8, 4);
    t.add(0x3b, 3, 8, 4);
    t.add_list([0x3c, 0x3d, 0x3e, 0x3f], 3, 9, 4);
    t.add_list(r(0x30, 0x3a), 4, 8, 4);
    t.add(0x3b, 4, 8, 4);
    t.add_list(r(0x40, 0x7f), 4, 7, 0);
    t.add_list([0x3a, 0x3c, 0x3d, 0x3e, 0x3f], 4, 0, 6);
    t.add_list(r(0x20, 0x40), 6, null, 6);
    t.add(0x7f, 6, null, 6);
    t.add_list(r(0x40, 0x7f), 6, 0, 0);
    t.add(0x3a, 3, 0, 6);
    t.add_list(r(0x20, 0x30), 3, 9, 5);
    t.add_list(r(0x20, 0x30), 5, 9, 5);
    t.add_list(r(0x30, 0x40), 5, 0, 6);
    t.add_list(r(0x40, 0x7f), 5, 7, 0);
    t.add_list(r(0x20, 0x30), 4, 9, 5);
    // esc_intermediate
    t.add_list(r(0x20, 0x30), 1, 9, 2);
    t.add_list(r(0x20, 0x30), 2, 9, 2);
    t.add_list(r(0x30, 0x7f), 2, 10, 0);
    t.add_list(r(0x30, 0x50), 1, 10, 0);
    t.add_list([0x51, 0x52, 0x53, 0x54, 0x55, 0x56, 0x57, 0x59, 0x5a, 0x5c], 1, 10, 0);
    t.add_list(r(0x60, 0x7f), 1, 10, 0);
    // dcs entry
    t.add(0x50, 1, 11, 9);
    t.add_list(EXECUTABLES, 9, null, 9);
    t.add(0x7f, 9, null, 9);
    t.add_list(r(0x1c, 0x20), 9, null, 9);
    t.add_list(r(0x20, 0x30), 9, 9, 12);
    t.add(0x3a, 9, 0, 11);
    t.add_list(r(0x30, 0x3a), 9, 8, 10);
    t.add(0x3b, 9, 8, 10);
    t.add_list([0x3c, 0x3d, 0x3e, 0x3f], 9, 9, 10);
    t.add_list(EXECUTABLES, 11, null, 11);
    t.add_list(r(0x20, 0x80), 11, null, 11);
    t.add_list(r(0x1c, 0x20), 11, null, 11);
    t.add_list(EXECUTABLES, 10, null, 10);
    t.add(0x7f, 10, null, 10);
    t.add_list(r(0x1c, 0x20), 10, null, 10);
    t.add_list(r(0x30, 0x3a), 10, 8, 10);
    t.add(0x3b, 10, 8, 10);
    t.add_list([0x3a, 0x3c, 0x3d, 0x3e, 0x3f], 10, 0, 11);
    t.add_list(r(0x20, 0x30), 10, 9, 12);
    t.add_list(EXECUTABLES, 12, null, 12);
    t.add(0x7f, 12, null, 12);
    t.add_list(r(0x1c, 0x20), 12, null, 12);
    t.add_list(r(0x20, 0x30), 12, 9, 12);
    t.add_list(r(0x30, 0x40), 12, 0, 11);
    t.add_list(r(0x40, 0x7f), 12, 12, 13);
    t.add_list(r(0x40, 0x7f), 10, 12, 13);
    t.add_list(r(0x40, 0x7f), 9, 12, 13);
    t.add_list(EXECUTABLES, 13, 13, 13);
    t.add_list(PRINTABLES, 13, 13, 13);
    t.add(0x7f, 13, null, 13);
    t.add_list([0x1b, 0x9c], 13, 14, 0);

    return t;
})();

export class AnsiParser {
    public initialState: number;
    public currentState: number;
    public transitions: TransitionTable;
    public osc: string;
    public params: number[];
    public collected: string;
    public term: any;
    constructor(terminal: IParserTerminal) {
        this.initialState = 0;
        this.currentState = this.initialState | 0;
        this.transitions = new TransitionTable(4095);
        this.transitions.table.set(TRANSITION_TABLE.table);
        this.osc = '';
        this.params = [0];
        this.collected = '';
        this.term = terminal || {};
        let instructions = ['inst_p', 'inst_o', 'inst_x', 'inst_c',
            'inst_e', 'inst_H', 'inst_P', 'inst_U', 'inst_E'];
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
            if (currentState === 0 && (code > 0x1f && code < 0x80)) {
                printed = (~printed) ? printed : i;
                continue;
            }
            if (currentState === 4) {
                if (code === 0x3b) {
                    params.push(0);
                    continue;
                }
                if (code > 0x2f && code < 0x39) {
                    params[params.length - 1] = params[params.length - 1] * 10 + code - 48;
                    continue;
                }
            }
            transition = ((code < 0xa0) ? (table[currentState << 8 | code]) : 16);
            switch (transition >> 4) {
                case 2: // print
                    printed = (~printed) ? printed : i;
                    break;
                case 3: // execute
                    if (printed + 1) {
                        this.term.inst_p(s, printed, i);
                        printed = -1;
                    }
                    this.term.inst_x(String.fromCharCode(code));
                    break;
                case 0: // ignore
                    // handle leftover print and dcs chars
                    if (printed + 1) {
                        this.term.inst_p(s, printed, i);
                        printed = -1;
                    } else if (dcs + 1) {
                        this.term.inst_P(s.substring(dcs, i));
                        dcs = -1;
                    }
                    break;
                case 1: // error
                    // handle unicode chars in write buffers w'o state change
                    if (code > 0x9f) {
                        switch (currentState) {
                            case 0: // GROUND -> add char to print string
                                printed = (~printed) ? printed : i;
                                break;
                            case 8: // OSC_STRING -> add char to osc string
                                osc += String.fromCharCode(code);
                                transition |= 8;
                                break;
                            case 6: // CSI_IGNORE -> ignore char
                                transition |= 6;
                                break;
                            case 11: // DCS_IGNORE -> ignore char
                                transition |= 11;
                                break;
                            case 13: // DCS_PASSTHROUGH -> add char to dcs
                                if (!(~dcs)) dcs = i | 0;
                                transition |= 13;
                                break;
                            default: // real error
                                error = true;
                        }
                    } else { // real error
                        error = true;
                    }
                    if (error) {
                        if (this.term.inst_E(
                                {
                                    pos: i,                 // position in parse string
                                    character: String.fromCharCode(code), // wrong character
                                    state: currentState,   // in state
                                    print: printed,         // print buffer
                                    dcs: dcs,               // dcs buffer
                                    osc: osc,               // osc buffer
                                    collect: collected,     // collect buffer
                                    params: params          // params buffer
                                })) {
                            return;
                        }
                        error = false;
                    }
                    break;
                case 7: // csi_dispatch
                    this.term.inst_c(collected, params, String.fromCharCode(code));
                    break;
                case 8: // param
                    if (code === 0x3b) params.push(0);
                    else params[params.length - 1] = params[params.length - 1] * 10 + code - 48;
                    break;
                case 9: // collect
                    collected += String.fromCharCode(code);
                    break;
                case 10: // esc_dispatch
                    this.term.inst_e(collected, String.fromCharCode(code));
                    break;
                case 11: // clear
                    if (~printed) {
                        this.term.inst_p(s, printed, i);
                        printed = -1;
                    }
                    osc = '';
                    params = [0];
                    collected = '';
                    dcs = -1;
                    break;
                case 12: // dcs_hook
                    this.term.inst_H(collected, params, String.fromCharCode(code));
                    break;
                case 13: // dcs_put
                    if (!(~dcs)) dcs = i;
                    break;
                case 14: // dcs_unhook
                    if (~dcs) this.term.inst_P(s.substring(dcs, i));
                    this.term.inst_U();
                    if (code === 0x1b) transition |= 1;
                    osc = '';
                    params = [0];
                    collected = '';
                    dcs = -1;
                    break;
                case 4: // osc_start
                    if (~printed) {
                        this.term.inst_p(s, printed, i);
                        printed = -1;
                    }
                    osc = '';
                    break;
                case 5: // osc_put
                    osc += s.charAt(i);
                    break;
                case 6: // osc_end
                    if (osc && code !== 0x18 && code !== 0x1a) this.term.inst_o(osc);
                    if (code === 0x1b) transition |= 1;
                    osc = '';
                    params = [0];
                    collected = '';
                    dcs = -1;
                    break;
            }
            currentState = transition & 15;
        }

        // push leftover pushable buffers to terminal
        if (!currentState && (printed + 1)) {
            this.term.inst_p(s, printed, s.length);
        } else if (currentState === 13 && (dcs + 1)) {
            this.term.inst_P(s.substring(dcs));
        }

        // save non pushable buffers
        this.osc = osc;
        this.collected = collected;
        this.params = params;

        // save state
        this.currentState = currentState;
    }
}





import { IInputHandler, IInputHandlingTerminal } from './Types';
import { CHARSETS, DEFAULT_CHARSET } from './Charsets';
import { C0 } from './EscapeSequences';

// glue code between AnsiParser and Terminal
export class ParserTerminal implements IParserTerminal {
    private _parser: AnsiParser;
    private _terminal: any;
    private _inputHandler: IInputHandler;

    constructor(_terminal: any, _inputHandler: IInputHandler) {
        this._parser = new AnsiParser(this);
        this._terminal = _terminal;
        this._inputHandler = _inputHandler;
    }

    write(data: string): void {
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

    inst_p(data: string, start: number, end: number): void {
        // const l = data.length;
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

    inst_o(data: string): void {
        let params = data.split(';');
        switch (parseInt(params[0])) {
            case 0:
            case 1:
            case 2:
                if (params[1]) {
                    this._terminal.title = params[1];
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

    inst_x(flag: string): void {
        switch (flag) {
            case C0.BEL: return this._inputHandler.bell();
            case C0.LF: return this._inputHandler.lineFeed();
            case C0.VT: return this._inputHandler.lineFeed();
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

    inst_c(collected: string, params: number[], flag: string): void {
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

    inst_e(collected: string, flag: string): void {
        let cs;

        switch (collected) {
            case '':
                switch (flag) {
                    // case '6':  // Back Index (DECBI), VT420 and up - not supported
                    case '7':  // Save Cursor (DECSC)
                        this._inputHandler.saveCursor();
                        return;
                    case '8':  // Restore Cursor (DECRC)
                        this._inputHandler.restoreCursor();
                        return;
                    // case '9':  // Forward Index (DECFI), VT420 and up - not supported
                    case 'D':  // Index (IND is 0x84)
                        this._terminal.index();
                        return;
                    case 'E':  // Next Line (NEL is 0x85)
                        this._terminal.buffer.x = 0;
                        this._terminal.index();
                        return;
                    case 'H':  //    ESC H   Tab Set (HTS is 0x88)
                        (<IInputHandlingTerminal>this._terminal).tabSet();
                        return;
                    case 'M':  // Reverse Index (RI is 0x8d)
                        this._terminal.reverseIndex();
                        return;
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
                        this._terminal.setgLevel(2);
                        return;
                    case 'o':  // Invoke the G3 Character Set as GL (LS3).
                        this._terminal.setgLevel(3);
                        return;
                    case '|':  // Invoke the G3 Character Set as GR (LS3R).
                        this._terminal.setgLevel(3);
                        return;
                    case '}':  // Invoke the G2 Character Set as GR (LS2R).
                        this._terminal.setgLevel(2);
                        return;
                    case '~':  // Invoke the G1 Character Set as GR (LS1R).
                        this._terminal.setgLevel(1);
                        return;
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
                cs = CHARSETS[flag];
                if (!cs) cs = DEFAULT_CHARSET;
                this._terminal.setgCharset(0, cs);
                return;
            case ')': // G1 (VT100)
                cs = CHARSETS[flag];
                if (!cs) cs = DEFAULT_CHARSET;
                this._terminal.setgCharset(1, cs);
                return;
            case '*': // G2 (VT220)
                cs = CHARSETS[flag];
                if (!cs) cs = DEFAULT_CHARSET;
                this._terminal.setgCharset(2, cs);
                return;
            case '+': // G3 (VT220)
                cs = CHARSETS[flag];
                if (!cs) cs = DEFAULT_CHARSET;
                this._terminal.setgCharset(3, cs);
                return;
            case '-': // G1 (VT300)
            cs = CHARSETS[flag];
                if (!cs) cs = DEFAULT_CHARSET;
                this._terminal.setgCharset(1, cs);
                return;
            case '.': // G2 (VT300)
                if (!cs) cs = DEFAULT_CHARSET;
                this._terminal.setgCharset(2, cs);
                return;
            case '/': // G3 (VT300)
                // not supported - how to deal with this? (original code is not reachable)
                return;
            default:
                this._terminal.error('Unknown ESC control: %s %s.', collected, flag);
        }
    }

    inst_H(collected: string, params: number[], flag: string): void {
        // TODO
    }

    inst_P(dcs: string): void {
        // TODO
    }

    inst_U(): void {
        // TODO
    }

    inst_E(): void {
        // TODO
    }
}
