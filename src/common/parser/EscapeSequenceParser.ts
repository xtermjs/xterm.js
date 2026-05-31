/**
 * Copyright (c) 2018 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import { IParsingState, IDcsHandler, IEscapeSequenceParser, IParams, IOscHandler, IHandlerCollection, CsiHandlerType, OscFallbackHandlerType, IOscParser, EscHandlerType, IDcsParser, DcsFallbackHandlerType, IFunctionIdentifier, ExecuteFallbackHandlerType, CsiFallbackHandlerType, EscFallbackHandlerType, PrintHandlerType, PrintFallbackHandlerType, ExecuteHandlerType, IParserStackState, ParserStackType, ResumableHandlersType, IApcHandler, IApcParser, ApcFallbackHandlerType } from './Types';
import { ParserState, ParserAction } from './Constants';
import { Disposable, toDisposable } from '../Lifecycle';
import { IDisposable } from '../Types';
import { Params } from './Params';
import { OscParser } from './OscParser';
import { DcsParser } from './DcsParser';
import { ApcParser } from './ApcParser';
import { parseWithWasmScanner } from './EscapeSequenceParserWasm';
import { WasmEscapeScanner } from './WasmEscapeScanner';

/**
 * VT commands done by the parser
 */
// @vt: #Y   ESC   CSI   "Control Sequence Introducer"   "ESC ["   "Start of a CSI sequence."
// @vt: #Y   ESC   OSC   "Operating System Command"      "ESC ]"   "Start of an OSC sequence."
// @vt: #Y   ESC   DCS   "Device Control String"         "ESC P"   "Start of a DCS sequence."
// @vt: #Y   ESC   ST    "String Terminator"             "ESC \"   "Terminator used for string type sequences."
// @vt: #Y   ESC   PM    "Privacy Message"               "ESC ^"   "Start of a privacy message."
// @vt: #Y   ESC   APC   "Application Program Command"   "ESC _"   "Start of an APC sequence."
// @vt: #Y   C1    CSI   "Control Sequence Introducer"   "\x9B"    "Start of a CSI sequence."
// @vt: #Y   C1    OSC   "Operating System Command"      "\x9D"    "Start of an OSC sequence."
// @vt: #Y   C1    DCS   "Device Control String"         "\x90"    "Start of a DCS sequence."
// @vt: #Y   C1    ST    "String Terminator"             "\x9C"    "Terminator used for string type sequences."
// @vt: #Y   C1    PM    "Privacy Message"               "\x9E"    "Start of a privacy message."
// @vt: #Y   C1    APC   "Application Program Command"   "\x9F"    "Start of an APC sequence."
// @vt: #Y   C0    NUL   "Null"                          "\0, \x00"  "NUL is ignored."
// @vt: #Y   C0    ESC   "Escape"                        "\e, \x1B"  "Start of a sequence. Cancels any other sequence."

/**
 * Table values are generated like this:
 *    index:  currentState << TableValue.INDEX_STATE_SHIFT | charCode
 *    value:  action << TableValue.TRANSITION_ACTION_SHIFT | nextState
 */
const enum TableAccess {
  TRANSITION_ACTION_SHIFT = 8,
  TRANSITION_STATE_MASK = 255,
  INDEX_STATE_SHIFT = 8
}

/**
 * Transition table for EscapeSequenceParser.
 */
export class TransitionTable {
  public table: Uint16Array;

  constructor(length: number) {
    this.table = new Uint16Array(length);
  }

  /**
   * Set default transition.
   * @param action default action
   * @param next default next state
   */
  public setDefault(action: ParserAction, next: ParserState): void {
    this.table.fill(action << TableAccess.TRANSITION_ACTION_SHIFT | next);
  }

  /**
   * Add a transition to the transition table.
   * @param code input character code
   * @param state current parser state
   * @param action parser action to be done
   * @param next next parser state
   */
  public add(code: number, state: ParserState, action: ParserAction, next: ParserState): void {
    this.table[state << TableAccess.INDEX_STATE_SHIFT | code] = action << TableAccess.TRANSITION_ACTION_SHIFT | next;
  }

  /**
   * Add transitions for multiple input character codes.
   * @param codes input character code array
   * @param state current parser state
   * @param action parser action to be done
   * @param next next parser state
   */
  public addMany(codes: number[], state: ParserState, action: ParserAction, next: ParserState): void {
    for (let i = 0; i < codes.length; i++) {
      this.table[state << TableAccess.INDEX_STATE_SHIFT | codes[i]] = action << TableAccess.TRANSITION_ACTION_SHIFT | next;
    }
  }
}


// Pseudo-character placeholder for printable non-ascii characters (unicode).
const NON_ASCII_PRINTABLE = 0xA0;


/**
 * VT500 compatible transition table.
 * Taken from https://vt100.net/emu/dec_ansi_parser.
 */
export const VT500_TRANSITION_TABLE = (function (): TransitionTable {
  // table size:
  // (ParserState.STATE_LENGTH - 1) << TableAccess.INDEX_STATE_SHIFT | NON_ASCII_PRINTABLE + 1
  const table: TransitionTable = new TransitionTable(4257);

  // range macro for byte
  const BYTE_VALUES = 256;
  const blueprint = Array.apply(null, Array(BYTE_VALUES)).map((unused: any, i: number) => i);
  const r = (start: number, end: number): number[] => blueprint.slice(start, end);

  // Default definitions.
  const PRINTABLES = r(0x20, 0x7f); // 0x20 (SP) included, 0x7F (DEL) excluded
  const EXECUTABLES = r(0x00, 0x18);
  EXECUTABLES.push(0x19);
  EXECUTABLES.push.apply(EXECUTABLES, r(0x1c, 0x20));

  const states: number[] = r(ParserState.GROUND, ParserState.STATE_LENGTH);

  // set default transition
  table.setDefault(ParserAction.ERROR, ParserState.GROUND);
  // printables
  table.addMany(PRINTABLES, ParserState.GROUND, ParserAction.PRINT, ParserState.GROUND);
  // global anywhere rules
  for (const state of states) {
    table.addMany([0x18, 0x1a, 0x99, 0x9a], state, ParserAction.EXECUTE, ParserState.GROUND);
    table.addMany(r(0x80, 0x90), state, ParserAction.EXECUTE, ParserState.GROUND);
    table.addMany(r(0x90, 0x98), state, ParserAction.EXECUTE, ParserState.GROUND);
    table.add(0x9c, state, ParserAction.IGNORE, ParserState.GROUND); // ST as terminator
    table.add(0x1b, state, ParserAction.CLEAR, ParserState.ESCAPE);  // ESC
    table.add(0x9d, state, ParserAction.OSC_START, ParserState.OSC_STRING);  // OSC
    table.addMany([0x98, 0x9e], state, ParserAction.IGNORE, ParserState.SOS_PM_STRING);  // SOS, PM
    table.add(0x9f, state, ParserAction.CLEAR, ParserState.APC_ENTRY);  // APC
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
  // sos/pm
  table.addMany([0x58, 0x5e], ParserState.ESCAPE, ParserAction.IGNORE, ParserState.SOS_PM_STRING);
  table.addMany(PRINTABLES, ParserState.SOS_PM_STRING, ParserAction.IGNORE, ParserState.SOS_PM_STRING);
  table.addMany(EXECUTABLES, ParserState.SOS_PM_STRING, ParserAction.IGNORE, ParserState.SOS_PM_STRING);
  table.add(0x9c, ParserState.SOS_PM_STRING, ParserAction.IGNORE, ParserState.GROUND);
  table.add(0x7f, ParserState.SOS_PM_STRING, ParserAction.IGNORE, ParserState.SOS_PM_STRING);
  // apc
  table.add(0x5f, ParserState.ESCAPE, ParserAction.CLEAR, ParserState.APC_ENTRY);
  table.addMany(EXECUTABLES, ParserState.APC_ENTRY, ParserAction.IGNORE, ParserState.APC_ENTRY);
  table.add(0x7f, ParserState.APC_ENTRY, ParserAction.IGNORE, ParserState.APC_ENTRY);
  table.addMany(r(0x20, 0x30), ParserState.APC_ENTRY, ParserAction.COLLECT, ParserState.APC_INTERMEDIATE);
  table.addMany(r(0x30, 0x7f), ParserState.APC_ENTRY, ParserAction.APC_START, ParserState.APC_PASSTHROUGH);
  table.addMany(r(0x30, 0x7f), ParserState.APC_INTERMEDIATE, ParserAction.APC_START, ParserState.APC_PASSTHROUGH);
  table.addMany(EXECUTABLES, ParserState.APC_INTERMEDIATE, ParserAction.IGNORE, ParserState.APC_INTERMEDIATE);
  table.addMany(r(0x20, 0x30), ParserState.APC_INTERMEDIATE, ParserAction.COLLECT, ParserState.APC_INTERMEDIATE);
  table.add(0x7f, ParserState.APC_INTERMEDIATE, ParserAction.IGNORE, ParserState.APC_INTERMEDIATE);
  table.addMany(PRINTABLES, ParserState.APC_PASSTHROUGH, ParserAction.APC_PUT, ParserState.APC_PASSTHROUGH);
  table.addMany(EXECUTABLES, ParserState.APC_PASSTHROUGH, ParserAction.IGNORE, ParserState.APC_PASSTHROUGH);
  table.addMany(r(0x08, 0x0e), ParserState.APC_PASSTHROUGH, ParserAction.APC_PUT, ParserState.APC_PASSTHROUGH);
  table.add(0x7f, ParserState.APC_PASSTHROUGH, ParserAction.IGNORE, ParserState.APC_PASSTHROUGH);
  table.addMany([0x1b, 0x9c, 0x18, 0x1a], ParserState.APC_PASSTHROUGH, ParserAction.APC_END, ParserState.GROUND);
  // csi entries
  table.add(0x5b, ParserState.ESCAPE, ParserAction.CLEAR, ParserState.CSI_ENTRY);
  table.addMany(r(0x40, 0x7f), ParserState.CSI_ENTRY, ParserAction.CSI_DISPATCH, ParserState.GROUND);
  table.addMany(r(0x30, 0x3c), ParserState.CSI_ENTRY, ParserAction.PARAM, ParserState.CSI_PARAM);
  table.addMany([0x3c, 0x3d, 0x3e, 0x3f], ParserState.CSI_ENTRY, ParserAction.COLLECT, ParserState.CSI_PARAM);
  table.addMany(r(0x30, 0x3c), ParserState.CSI_PARAM, ParserAction.PARAM, ParserState.CSI_PARAM);
  table.addMany(r(0x40, 0x7f), ParserState.CSI_PARAM, ParserAction.CSI_DISPATCH, ParserState.GROUND);
  table.addMany([0x3c, 0x3d, 0x3e, 0x3f], ParserState.CSI_PARAM, ParserAction.IGNORE, ParserState.CSI_IGNORE);
  table.addMany(r(0x20, 0x40), ParserState.CSI_IGNORE, ParserAction.IGNORE, ParserState.CSI_IGNORE);
  table.add(0x7f, ParserState.CSI_IGNORE, ParserAction.IGNORE, ParserState.CSI_IGNORE);
  table.addMany(r(0x40, 0x7f), ParserState.CSI_IGNORE, ParserAction.IGNORE, ParserState.GROUND);
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
  table.addMany(r(0x20, 0x30), ParserState.DCS_ENTRY, ParserAction.COLLECT, ParserState.DCS_INTERMEDIATE);
  table.addMany(r(0x30, 0x3c), ParserState.DCS_ENTRY, ParserAction.PARAM, ParserState.DCS_PARAM);
  table.addMany([0x3c, 0x3d, 0x3e, 0x3f], ParserState.DCS_ENTRY, ParserAction.COLLECT, ParserState.DCS_PARAM);
  table.addMany(EXECUTABLES, ParserState.DCS_IGNORE, ParserAction.IGNORE, ParserState.DCS_IGNORE);
  table.addMany(r(0x20, 0x80), ParserState.DCS_IGNORE, ParserAction.IGNORE, ParserState.DCS_IGNORE);
  table.addMany(EXECUTABLES, ParserState.DCS_PARAM, ParserAction.IGNORE, ParserState.DCS_PARAM);
  table.add(0x7f, ParserState.DCS_PARAM, ParserAction.IGNORE, ParserState.DCS_PARAM);
  table.addMany(r(0x30, 0x3c), ParserState.DCS_PARAM, ParserAction.PARAM, ParserState.DCS_PARAM);
  table.addMany([0x3c, 0x3d, 0x3e, 0x3f], ParserState.DCS_PARAM, ParserAction.IGNORE, ParserState.DCS_IGNORE);
  table.addMany(r(0x20, 0x30), ParserState.DCS_PARAM, ParserAction.COLLECT, ParserState.DCS_INTERMEDIATE);
  table.addMany(EXECUTABLES, ParserState.DCS_INTERMEDIATE, ParserAction.IGNORE, ParserState.DCS_INTERMEDIATE);
  table.add(0x7f, ParserState.DCS_INTERMEDIATE, ParserAction.IGNORE, ParserState.DCS_INTERMEDIATE);
  table.addMany(r(0x20, 0x30), ParserState.DCS_INTERMEDIATE, ParserAction.COLLECT, ParserState.DCS_INTERMEDIATE);
  table.addMany(r(0x30, 0x40), ParserState.DCS_INTERMEDIATE, ParserAction.IGNORE, ParserState.DCS_IGNORE);
  table.addMany(r(0x40, 0x7f), ParserState.DCS_INTERMEDIATE, ParserAction.DCS_HOOK, ParserState.DCS_PASSTHROUGH);
  table.addMany(r(0x40, 0x7f), ParserState.DCS_PARAM, ParserAction.DCS_HOOK, ParserState.DCS_PASSTHROUGH);
  table.addMany(r(0x40, 0x7f), ParserState.DCS_ENTRY, ParserAction.DCS_HOOK, ParserState.DCS_PASSTHROUGH);
  table.addMany(EXECUTABLES, ParserState.DCS_PASSTHROUGH, ParserAction.DCS_PUT, ParserState.DCS_PASSTHROUGH);
  table.addMany(PRINTABLES, ParserState.DCS_PASSTHROUGH, ParserAction.DCS_PUT, ParserState.DCS_PASSTHROUGH);
  table.add(0x7f, ParserState.DCS_PASSTHROUGH, ParserAction.IGNORE, ParserState.DCS_PASSTHROUGH);
  table.addMany([0x1b, 0x9c, 0x18, 0x1a], ParserState.DCS_PASSTHROUGH, ParserAction.DCS_UNHOOK, ParserState.GROUND);
  // special handling of unicode chars
  table.add(NON_ASCII_PRINTABLE, ParserState.GROUND, ParserAction.PRINT, ParserState.GROUND);
  table.add(NON_ASCII_PRINTABLE, ParserState.OSC_STRING, ParserAction.OSC_PUT, ParserState.OSC_STRING);
  table.add(NON_ASCII_PRINTABLE, ParserState.CSI_IGNORE, ParserAction.IGNORE, ParserState.CSI_IGNORE);
  table.add(NON_ASCII_PRINTABLE, ParserState.DCS_IGNORE, ParserAction.IGNORE, ParserState.DCS_IGNORE);
  table.add(NON_ASCII_PRINTABLE, ParserState.DCS_PASSTHROUGH, ParserAction.DCS_PUT, ParserState.DCS_PASSTHROUGH);
  table.add(NON_ASCII_PRINTABLE, ParserState.APC_PASSTHROUGH, ParserAction.APC_PUT, ParserState.APC_PASSTHROUGH);
  return table;
})();


/**
 * EscapeSequenceParser.
 * This class implements the ANSI/DEC compatible parser described by
 * Paul Williams (https://vt100.net/emu/dec_ansi_parser).
 *
 * To implement custom ANSI compliant escape sequences it is not needed to
 * alter this parser, instead consider registering a custom handler.
 * For non ANSI compliant sequences change the transition table with
 * the optional `transitions` constructor argument and
 * reimplement the `parse` method.
 *
 * This parser is currently hardcoded to operate in ZDM (Zero Default Mode)
 * as suggested by the original parser, thus empty parameters are set to 0.
 * This this is not in line with the latest ECMA-48 specification
 * (ZDM was part of the early specs and got completely removed later on).
 *
 * Other than the original parser from vt100.net this parser supports
 * sub parameters in digital parameters separated by colons. Empty sub parameters
 * are set to -1 (no ZDM for sub parameters).
 *
 * About prefix and intermediate bytes:
 * This parser follows the assumptions of the vt100.net parser with these restrictions:
 * - only one prefix byte is allowed as first parameter byte, byte range 0x3c .. 0x3f
 * - max. two intermediates are respected, byte range 0x20 .. 0x2f
 * Note that this is not in line with ECMA-48 which does not limit either of those.
 * Furthermore ECMA-48 allows the prefix byte range at any param byte position. Currently
 * there are no known sequences that follow the broader definition of the specification.
 *
 * TODO: implement error recovery hook via error handler return values
 */
export class EscapeSequenceParser extends Disposable implements IEscapeSequenceParser {
  public initialState: number;
  public currentState: number;
  public precedingJoinState: number; // UnicodeJoinProperties

  // buffers over several parse calls
  protected _params: Params;
  protected _collect: number;

  public get collect(): number { return this._collect; }
  public set collect(value: number) { this._collect = value; }

  // handler lookup containers
  protected _printHandler: PrintHandlerType;
  protected _executeHandlers: { [flag: number]: ExecuteHandlerType };
  // fast path for EXE bytes < 0x18
  protected _executeHandlersArr: (ExecuteHandlerType | undefined)[];
  protected _csiHandlers: IHandlerCollection<CsiHandlerType>;
  protected _escHandlers: IHandlerCollection<EscHandlerType>;
  protected readonly _oscParser: IOscParser;
  protected readonly _dcsParser: IDcsParser;
  protected readonly _apcParser: IApcParser;
  protected _errorHandler: (state: IParsingState) => IParsingState;

  // fallback handlers
  protected _printHandlerFb: PrintFallbackHandlerType;
  protected _executeHandlerFb: ExecuteFallbackHandlerType;
  protected _csiHandlerFb: CsiFallbackHandlerType;
  protected _escHandlerFb: EscFallbackHandlerType;
  protected _errorHandlerFb: (state: IParsingState) => IParsingState;

  // parser stack save for async handler support
  protected _parseStack: IParserStackState = {
    state: ParserStackType.NONE,
    handlers: [],
    handlerPos: 0,
    transition: 0,
    chunkPos: 0
  };

  protected _scanCache: {
    opIndex: number;
    stateBeforeScan?: number;
    inputOffset?: number;
    chunkStart?: number;
    scan?: import('./ScanTypes').ScanResult;
    data?: Uint32Array;
  } = { opIndex: 0 };

  constructor(
    protected readonly _transitions: TransitionTable = VT500_TRANSITION_TABLE
  ) {
    super();

    this.initialState = ParserState.GROUND;
    this.currentState = this.initialState;
    this._params = new Params(); // defaults to 32 storable params/subparams
    this._params.addParam(0);    // ZDM
    this._collect = 0;
    this.precedingJoinState = 0;

    // set default fallback handlers and handler lookup containers
    this._printHandlerFb = (data, start, end): void => { };
    this._executeHandlerFb = (code: number): void => { };
    this._csiHandlerFb = (ident: number, params: IParams): void => { };
    this._escHandlerFb = (ident: number): void => { };
    this._errorHandlerFb = (state: IParsingState): IParsingState => state;
    this._printHandler = this._printHandlerFb;
    this._executeHandlers = Object.create(null);
    this._executeHandlersArr = new Array(0x18).fill(undefined);
    this._csiHandlers = Object.create(null);
    this._escHandlers = Object.create(null);
    this._register(toDisposable(() => {
      this._csiHandlers = Object.create(null);
      this._executeHandlers = Object.create(null);
      this._executeHandlersArr = new Array(0x18).fill(undefined);
      this._escHandlers = Object.create(null);
    }));
    this._oscParser = this._register(new OscParser());
    this._dcsParser = this._register(new DcsParser());
    this._apcParser = this._register(new ApcParser());
    this._errorHandler = this._errorHandlerFb;

    // swallow 7bit ST (ESC+\)
    this.registerEscHandler({ final: '\\' }, () => true);
  }

  protected _identifier(id: IFunctionIdentifier, finalRange: number[] = [0x40, 0x7e]): number {
    let res = 0;
    if (id.prefix) {
      if (id.prefix.length > 1) {
        throw new Error('only one byte as prefix supported');
      }
      res = id.prefix.charCodeAt(0);
      if (res && 0x3c > res || res > 0x3f) {
        throw new Error('prefix must be in range 0x3c .. 0x3f');
      }
    }
    if (id.intermediates) {
      if (id.intermediates.length > 2) {
        throw new Error('only two bytes as intermediates are supported');
      }
      for (let i = 0; i < id.intermediates.length; ++i) {
        const intermediate = id.intermediates.charCodeAt(i);
        if (0x20 > intermediate || intermediate > 0x2f) {
          throw new Error('intermediate must be in range 0x20 .. 0x2f');
        }
        res <<= 8;
        res |= intermediate;
      }
    }
    if (id.final.length !== 1) {
      throw new Error('final must be a single byte');
    }
    const finalCode = id.final.charCodeAt(0);
    if (finalRange[0] > finalCode || finalCode > finalRange[1]) {
      throw new Error(`final must be in range ${finalRange[0]} .. ${finalRange[1]}`);
    }
    res <<= 8;
    res |= finalCode;

    return res;
  }

  public identToString(ident: number): string {
    const res: string[] = [];
    while (ident) {
      res.push(String.fromCharCode(ident & 0xFF));
      ident >>= 8;
    }
    return res.reverse().join('');
  }

  public setPrintHandler(handler: PrintHandlerType): void {
    this._printHandler = handler;
  }
  public clearPrintHandler(): void {
    this._printHandler = this._printHandlerFb;
  }

  public registerEscHandler(id: IFunctionIdentifier, handler: EscHandlerType): IDisposable {
    const ident = this._identifier(id, [0x30, 0x7e]);
    this._escHandlers[ident] ??= [];
    const handlerList = this._escHandlers[ident];
    handlerList.push(handler);
    return {
      dispose: () => {
        const handlerIndex = handlerList.indexOf(handler);
        if (handlerIndex !== -1) {
          handlerList.splice(handlerIndex, 1);
        }
      }
    };
  }
  public clearEscHandler(id: IFunctionIdentifier): void {
    if (this._escHandlers[this._identifier(id, [0x30, 0x7e])]) delete this._escHandlers[this._identifier(id, [0x30, 0x7e])];
  }
  public setEscHandlerFallback(handler: EscFallbackHandlerType): void {
    this._escHandlerFb = handler;
  }

  public setExecuteHandler(flag: string, handler: ExecuteHandlerType): void {
    const code = flag.charCodeAt(0);
    this._executeHandlers[code] = handler;
    if (code < 0x18) this._executeHandlersArr[code] = handler;
  }
  public clearExecuteHandler(flag: string): void {
    const code = flag.charCodeAt(0);
    if (this._executeHandlers[code]) delete this._executeHandlers[code];
    if (code < 0x18) this._executeHandlersArr[code] = undefined;
  }
  public setExecuteHandlerFallback(handler: ExecuteFallbackHandlerType): void {
    this._executeHandlerFb = handler;
  }

  public registerCsiHandler(id: IFunctionIdentifier, handler: CsiHandlerType): IDisposable {
    const ident = this._identifier(id);
    this._csiHandlers[ident] ??= [];
    const handlerList = this._csiHandlers[ident];
    handlerList.push(handler);
    return {
      dispose: () => {
        const handlerIndex = handlerList.indexOf(handler);
        if (handlerIndex !== -1) {
          handlerList.splice(handlerIndex, 1);
        }
      }
    };
  }
  public clearCsiHandler(id: IFunctionIdentifier): void {
    if (this._csiHandlers[this._identifier(id)]) delete this._csiHandlers[this._identifier(id)];
  }
  public setCsiHandlerFallback(callback: (ident: number, params: IParams) => void): void {
    this._csiHandlerFb = callback;
  }

  public registerDcsHandler(id: IFunctionIdentifier, handler: IDcsHandler): IDisposable {
    return this._dcsParser.registerHandler(this._identifier(id), handler);
  }
  public clearDcsHandler(id: IFunctionIdentifier): void {
    this._dcsParser.clearHandler(this._identifier(id));
  }
  public setDcsHandlerFallback(handler: DcsFallbackHandlerType): void {
    this._dcsParser.setHandlerFallback(handler);
  }

  public registerOscHandler(ident: number, handler: IOscHandler): IDisposable {
    return this._oscParser.registerHandler(ident, handler);
  }
  public clearOscHandler(ident: number): void {
    this._oscParser.clearHandler(ident);
  }
  public setOscHandlerFallback(handler: OscFallbackHandlerType): void {
    this._oscParser.setHandlerFallback(handler);
  }

  public registerApcHandler(id: IFunctionIdentifier, handler: IApcHandler): IDisposable {
    id.prefix = undefined;  // APC does not support prefix byte
    return this._apcParser.registerHandler(this._identifier(id, [0x30, 0x7e]), handler);
  }
  public clearApcHandler(id: IFunctionIdentifier): void {
    id.prefix = undefined;  // APC does not support prefix byte
    this._apcParser.clearHandler(this._identifier(id, [0x30, 0x7e]));
  }
  public setApcHandlerFallback(handler: ApcFallbackHandlerType): void {
    this._apcParser.setHandlerFallback(handler);
  }

  public setErrorHandler(callback: (state: IParsingState) => IParsingState): void {
    this._errorHandler = callback;
  }
  public clearErrorHandler(): void {
    this._errorHandler = this._errorHandlerFb;
  }

  /**
   * Reset parser to initial values.
   *
   * This can also be used to lift the improper continuation error condition
   * when dealing with async handlers. Use this only as a last resort to silence
   * that error when the terminal has no pending data to be processed. Note that
   * the interrupted async handler might continue its work in the future messing
   * up the terminal state even further.
   */
  public reset(): void {
    this.currentState = this.initialState;
    WasmEscapeScanner.initSync();
    WasmEscapeScanner.reset();
    this._oscParser.reset();
    this._dcsParser.reset();
    this._apcParser.reset();
    this._params.resetZdm();
    this._collect = 0;
    this.precedingJoinState = 0;
    this._scanCache.opIndex = 0;
    this._scanCache.inputOffset = 0;
    this._scanCache.chunkStart = undefined;
    this._scanCache.scan = undefined;
    this._scanCache.data = undefined;
    this._scanCache.stateBeforeScan = undefined;
    // abort pending continuation from async handler
    // Here the RESET type indicates, that the next parse call will
    // ignore any saved stack, instead continues sync with next codepoint from GROUND
    if (this._parseStack.state !== ParserStackType.NONE) {
      this._parseStack.state = ParserStackType.RESET;
      this._parseStack.handlers = []; // also release handlers ref
    }
  }

  /**
   * Async parse support.
   */
  protected _preserveStack(
    state: ParserStackType,
    handlers: ResumableHandlersType,
    handlerPos: number,
    transition: number,
    chunkPos: number
  ): void {
    this._parseStack.state = state;
    this._parseStack.handlers = handlers;
    this._parseStack.handlerPos = handlerPos;
    this._parseStack.transition = transition;
    this._parseStack.chunkPos = chunkPos;
  }

  /**
   * Parse UTF32 codepoints in `data` up to `length`.
   *
   * Note: For several actions with high data load the parsing is optimized
   * by using local read ahead loops with hardcoded conditions to
   * avoid costly table lookups. Make sure that any change of table values
   * will be reflected in the loop conditions as well and vice versa.
   * Affected states/actions:
   * - GROUND:PRINT
   * - CSI_PARAM:PARAM
   * - DCS_PARAM:PARAM
   * - OSC_STRING:OSC_PUT
   * - DCS_PASSTHROUGH:DCS_PUT
   *
   * Additionally the following fast paths exist before the table lookup:
   * - EXE bytes < 0x18 in non-payload states (avoids table lookup entirely)
   * - 7-bit CSI sequences without intermediates (ESC [ params final)
   *
   * Note on asynchronous handler support:
   * Any handler returning a promise will be treated as asynchronous.
   * To keep the in-band blocking working for async handlers, `parse` pauses execution,
   * creates a stack save and returns the promise to the caller.
   * For proper continuation of the paused state it is important
   * to await the promise resolving. On resolve the parse must be repeated
   * with the same chunk of data and the resolved value in `promiseResult`
   * until no promise is returned.
   *
   * Important: With only sync handlers defined, parsing is completely synchronous as well.
   * As soon as an async handler is involved, synchronous parsing is not possible anymore.
   *
   * Boilerplate for proper parsing of multiple chunks with async handlers:
   *
   * ```typescript
   * async function parseMultipleChunks(chunks: Uint32Array[]): Promise<void> {
   *   for (const chunk of chunks) {
   *     let result: void | Promise<boolean>;
   *     let prev: boolean | undefined;
   *     while (result = parser.parse(chunk, chunk.length, prev)) {
   *       prev = await result;
   *     }
   *   }
   *   // finished parsing all chunks...
   * }
   * ```
   */
  public parse(data: Uint32Array, length: number, promiseResult?: boolean): void | Promise<boolean> {
    return parseWithWasmScanner(this as unknown as import('./EscapeSequenceParserWasm').IWasmParseHost, data, length, promiseResult, this._scanCache);
  }
}
