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

/**
 * Command handler interfaces.
 */

/**
 * CSI handler types.
 * Note: `params` is borrowed.
 */
export type CsiHandlerType = (params: IParams) => boolean | void;
export type CsiFallbackHandlerType = (ident: number, params: IParams) => void;

/**
 * DCS handler types.
 */
export interface IDcsHandler {
  /**
   * Called when a DCS command starts.
   * Prepare needed data structures here.
   * Note: `params` is borrowed.
   */
  hook(params: IParams): void;
  /**
   * Incoming payload chunk.
   * Note: `params` is borrowed.
   */
  put(data: Uint32Array, start: number, end: number): void;
  /**
   * End of DCS command. `success` indicates whether the
   * command finished normally or got aborted, thus final
   * execution of the command should depend on `success`.
   * To save memory also cleanup data structures here.
   */
  unhook(success: boolean): void | boolean;
}
export type DcsFallbackHandlerType = (ident: number, action: 'HOOK' | 'PUT' | 'UNHOOK', payload?: any) => void;

/**
 * ESC handler types.
 */
export type EscHandlerType = () => boolean | void;
export type EscFallbackHandlerType = (identifier: number) => void;

/**
 * EXECUTE handler types.
 */
export type ExecuteHandlerType = () => boolean | void;
export type ExecuteFallbackHandlerType = (ident: number) => void;

/**
 * OSC handler types.
 */
export interface IOscHandler {
  /**
   * Announces start of this OSC command.
   * Prepare needed data structures here.
   */
  start(): void;
  /**
   * Incoming data chunk.
   * Note: Data is borrowed.
   */
  put(data: Uint32Array, start: number, end: number): void;
  /**
   * End of OSC command. `success` indicates whether the
   * command finished normally or got aborted, thus final
   * execution of the command should depend on `success`.
   * To save memory also cleanup data structures here.
   */
  end(success: boolean): void | boolean;
}
export type OscFallbackHandlerType = (ident: number, action: 'START' | 'PUT' | 'END', payload?: any) => void;

/**
 * PRINT handler types.
 */
export type PrintHandlerType = (data: Uint32Array, start: number, end: number) => void;
export type PrintFallbackHandlerType = PrintHandlerType;


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
   * Get string from numercial function identifier `ident`.
   * Useful in fallback handlers which expose the low level
   * numcerical function identifier for debugging purposes.
   * Note: A full back translation to `IFunctionIdentifier`
   * is not implemented.
   */
  identToString(ident: number): string;

  setPrintHandler(handler: PrintHandlerType): void;
  clearPrintHandler(): void;

  setEscHandler(id: IFunctionIdentifier, handler: EscHandlerType): void;
  clearEscHandler(id: IFunctionIdentifier): void;
  setEscHandlerFallback(handler: EscFallbackHandlerType): void;
  addEscHandler(id: IFunctionIdentifier, handler: EscHandlerType): IDisposable;

  setExecuteHandler(flag: string, handler: ExecuteHandlerType): void;
  clearExecuteHandler(flag: string): void;
  setExecuteHandlerFallback(handler: ExecuteFallbackHandlerType): void;

  setCsiHandler(id: IFunctionIdentifier, handler: CsiHandlerType): void;
  clearCsiHandler(id: IFunctionIdentifier): void;
  setCsiHandlerFallback(callback: CsiFallbackHandlerType): void;
  addCsiHandler(id: IFunctionIdentifier, handler: CsiHandlerType): IDisposable;

  setDcsHandler(id: IFunctionIdentifier, handler: IDcsHandler): void;
  clearDcsHandler(id: IFunctionIdentifier): void;
  setDcsHandlerFallback(handler: DcsFallbackHandlerType): void;
  addDcsHandler(id: IFunctionIdentifier, handler: IDcsHandler): IDisposable;

  setOscHandler(ident: number, handler: IOscHandler): void;
  clearOscHandler(ident: number): void;
  setOscHandlerFallback(handler: OscFallbackHandlerType): void;
  addOscHandler(ident: number, handler: IOscHandler): IDisposable;

  setErrorHandler(handler: (state: IParsingState) => IParsingState): void;
  clearErrorHandler(): void;
}

/**
 * Subparser interfaces.
 * The subparsers are instantiated in `EscapeSequenceParser` and
 * called during `EscapeSequenceParser.parse`.
 */
export interface ISubParser<T, U> extends IDisposable {
  reset(): void;
  addHandler(ident: number, handler: T): IDisposable;
  setHandler(ident: number, handler: T): void;
  clearHandler(ident: number): void;
  setHandlerFallback(handler: U): void;
  put(data: Uint32Array, start: number, end: number): void;
}

export interface IOscParser extends ISubParser<IOscHandler, OscFallbackHandlerType> {
  start(): void;
  end(success: boolean): void;
}

export interface IDcsParser extends ISubParser<IDcsHandler, DcsFallbackHandlerType> {
  hook(ident: number, params: IParams): void;
  unhook(success: boolean): void;
}

/**
 * Interface to denote a specific ESC, CSI or DCS handler slot.
 * The values are used to create an integer respresentation during handler
 * regristation before passed to the subparsers as `ident`.
 * The integer translation is made to allow a faster handler access
 * in `EscapeSequenceParser.parse`.
 */
export interface IFunctionIdentifier {
  prefix?: string;
  intermediates?: string;
  final: string;
}

export interface IHandlerCollection<T> {
  [key: string]: T[];
}
