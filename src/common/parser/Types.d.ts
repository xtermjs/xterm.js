/**
 * Copyright (c) 2017 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import { IDisposable } from 'common/Types';
import { ParserState } from 'common/parser/Constants';

/**
 * Internal state of EscapeSequenceParser.
 * Used as argument of the error handler to allow
 * introspection at runtime on parse errors.
 * Return it with altered values to recover from
 * faulty states (not yet supported).
 * Set `abort` to `true` to abort the current parsing.
 */
export interface IParsingState {
  // position in parse string
  position: number;
  // actual character code
  code: number;
  // current parser state
  currentState: ParserState;
  // osc string buffer
  osc: string;
  // collect buffer with intermediate characters
  collect: string;
  // params buffer
  params: number[];
  // should abort (default: false)
  abort: boolean;
}

/**
* DCS handler signature for EscapeSequenceParser.
* EscapeSequenceParser handles DCS commands via separate
* subparsers that get hook/unhooked and can handle
* arbitrary amount of data.
*
* On entering a DSC sequence `hook` is called by
* `EscapeSequenceParser`. Use it to initialize or reset
* states needed to handle the current DCS sequence.
* Note: A DCS parser is only instantiated once, therefore
* you cannot rely on the ctor to reinitialize state.
*
* EscapeSequenceParser will call `put` several times if the
* parsed data got split, therefore you might have to collect
* `data` until `unhook` is called.
* Note: `data` is borrowed, if you cannot process the data
* in chunks you have to copy it, doing otherwise will lead to
* data losses or corruption.
*
* `unhook` marks the end of the current DCS sequence.
*/
export interface IDcsHandler {
  hook(collect: string, params: number[], flag: number): void;
  put(data: Uint32Array, start: number, end: number): void;
  unhook(): void;
}

/**
* EscapeSequenceParser interface.
*/
export interface IEscapeSequenceParser extends IDisposable {
  /**
   * Preceding codepoint to get REP working correctly.
   * This must be set by the print handler as last action.
   * It gets reset by the parser for any valid sequence beside REP itself.
   */
  precedingCodepoint: number;
  /**
   * Reset the parser to its initial state (handlers are kept).
   */
  reset(): void;

  /**
   * Parse string `data`.
   * @param data The data to parse.
   */
  parse(data: Uint32Array, length: number): void;

  setPrintHandler(callback: (data: Uint32Array, start: number, end: number) => void): void;
  clearPrintHandler(): void;

  setExecuteHandler(flag: string, callback: () => void): void;
  clearExecuteHandler(flag: string): void;
  setExecuteHandlerFallback(callback: (code: number) => void): void;

  setCsiHandler(flag: string, callback: (params: number[], collect: string) => void): void;
  clearCsiHandler(flag: string): void;
  setCsiHandlerFallback(callback: (collect: string, params: number[], flag: number) => void): void;
  addCsiHandler(flag: string, callback: (params: number[], collect: string) => boolean): IDisposable;
  addOscHandler(ident: number, callback: (data: string) => boolean): IDisposable;

  setEscHandler(collectAndFlag: string, callback: () => void): void;
  clearEscHandler(collectAndFlag: string): void;
  setEscHandlerFallback(callback: (collect: string, flag: number) => void): void;

  setOscHandler(ident: number, callback: (data: string) => void): void;
  clearOscHandler(ident: number): void;
  setOscHandlerFallback(callback: (identifier: number, data: string) => void): void;

  setDcsHandler(collectAndFlag: string, handler: IDcsHandler): void;
  clearDcsHandler(collectAndFlag: string): void;
  setDcsHandlerFallback(handler: IDcsHandler): void;

  setErrorHandler(callback: (state: IParsingState) => IParsingState): void;
  clearErrorHandler(): void;
}
