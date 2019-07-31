/**
 * Copyright (c) 2017 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import { IDisposable } from 'common/Types';
import { ParserState } from 'common/parser/Constants';

/** sequence params serialized to js arrays */
export type ParamsArray = (number | number[])[];

/** Params constructor type. */
export interface IParamsConstructor {
  new(maxLength: number, maxSubParamsLength: number): IParams;

  /** create params from ParamsArray */
  fromArray(values: ParamsArray): IParams;
}

/** Interface of Params storage class. */
export interface IParams {
  /** from ctor */
  maxLength: number;
  maxSubParamsLength: number;

  /** param values and its length */
  params: Int32Array;
  length: number;

  /** methods */
  clone(): IParams;
  toArray(): ParamsArray;
  reset(): void;
  addParam(value: number): void;
  addSubParam(value: number): void;
  hasSubParams(idx: number): boolean;
  getSubParams(idx: number): Int32Array | null;
  getSubParamsAll(): {[idx: number]: Int32Array};
}

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
  // collect buffer with intermediate characters
  collect: number;
  // params buffer
  params: IParams;
  // should abort (default: false)
  abort: boolean;
}

export interface IHandlerCollection<T> {
  [key: string]: T[];
}

export type CsiHandler = (params: IParams) => boolean | void;
export type EscHandler = () => boolean | void;

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
* `unhook` marks the end of the current DCS sequence. `success`
* indicates whether the command was aborted.
*/
export interface IDcsHandler {
  hook(params: IParams): void;
  put(data: Uint32Array, start: number, end: number): void;
  unhook(success: boolean): void | boolean;
}

export type DcsFallbackHandler = (ident: number, action: 'HOOK' | 'PUT' | 'UNHOOK', payload?: any) => void;

export interface IOscHandler {
  /**
   * Announces start of this OSC command.
   * Prepare needed data structures here.
   */
  start(): void;

  /**
   * Incoming data chunk.
   */
  put(data: Uint32Array, start: number, end: number): void;

  /**
   * End of OSC command. `success` indicates whether the
   * command finished normally or got aborted, thus execution
   * of the command should depend on `success`.
   * To save memory cleanup data structures in `.end`.
   */
  end(success: boolean): void | boolean;
}

export type OscFallbackHandler = (ident: number, action: 'START' | 'PUT' | 'END', payload?: any) => void;

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
   * Parse UTF32 codepoints in `data` up to `length`.
   * @param data The data to parse.
   */
  parse(data: Uint32Array, length: number): void;

  /**
   * Get string from ident number.
   */
  identToString(ident: number): string;

  setPrintHandler(callback: (data: Uint32Array, start: number, end: number) => void): void;
  clearPrintHandler(): void;

  setExecuteHandler(flag: string, callback: () => void): void;
  clearExecuteHandler(flag: string): void;
  setExecuteHandlerFallback(callback: (code: number) => void): void;

  setCsiHandler(id: IFunctionIdentifier, callback: (params: IParams) => void): void;
  clearCsiHandler(id: IFunctionIdentifier): void;
  setCsiHandlerFallback(callback: (identifier: number, params: IParams) => void): void;
  addCsiHandler(id: IFunctionIdentifier, callback: (params: IParams) => boolean): IDisposable;

  setEscHandler(id: IFunctionIdentifier, callback: () => void): void;
  clearEscHandler(id: IFunctionIdentifier): void;
  setEscHandlerFallback(callback: (identifier: number) => void): void;
  addEscHandler(id: IFunctionIdentifier, handler: EscHandler): IDisposable;

  setOscHandler(ident: number, handler: IOscHandler): void;
  clearOscHandler(ident: number): void;
  setOscHandlerFallback(handler: OscFallbackHandler): void;
  addOscHandler(ident: number, handler: IOscHandler): IDisposable;

  setDcsHandler(id: IFunctionIdentifier, handler: IDcsHandler): void;
  clearDcsHandler(id: IFunctionIdentifier): void;
  setDcsHandlerFallback(handler: DcsFallbackHandler): void;
  addDcsHandler(id: IFunctionIdentifier, handler: IDcsHandler): IDisposable;

  setErrorHandler(callback: (state: IParsingState) => IParsingState): void;
  clearErrorHandler(): void;
}

export interface IOscParser extends IDisposable {
  addOscHandler(ident: number, handler: IOscHandler): IDisposable;
  setOscHandler(ident: number, handler: IOscHandler): void;
  clearOscHandler(ident: number): void;
  setOscHandlerFallback(handler: OscFallbackHandler): void;
  reset(): void;
  start(): void;
  put(data: Uint32Array, start: number, end: number): void;
  end(success: boolean): void;
}

export interface IDcsParser extends IDisposable {
  addDcsHandler(ident: number, handler: IDcsHandler): IDisposable;
  setDcsHandler(ident: number, handler: IDcsHandler): void;
  clearDcsHandler(ident: number): void;
  setDcsHandlerFallback(handler: DcsFallbackHandler): void;
  reset(): void;
  hook(ident: number, params: IParams): void;
  put(data: Uint32Array, start: number, end: number): void;
  unhook(success: boolean): void;
}

export interface IFunctionIdentifier {
  prefix?: string;
  intermediates?: string;
  final: string;
}
