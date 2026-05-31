/**
 * Copyright (c) 2026 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import { ParserState } from './Constants';
import { Params } from './Params';
import { Op, ScanResult } from './ScanTypes';
import { WasmEscapeScanner } from './WasmEscapeScanner';
import {
  CsiHandlerType,
  EscHandlerType,
  IParams,
  IParsingState,
  IParserStackState,
  ParserStackType,
  ResumableHandlersType
} from './Types';

export interface IWasmParseHost {
  currentState: number;
  collect: number;
  precedingJoinState: number;
  readonly _params: Params;
  readonly _parseStack: IParserStackState;
  readonly _csiHandlers: { [ident: number]: CsiHandlerType[] | undefined };
  readonly _escHandlers: { [ident: number]: EscHandlerType[] | undefined };
  readonly _executeHandlers: { [flag: number]: (() => void) | undefined };
  readonly _executeHandlersArr: Array<((code: number) => void) | undefined>;
  _csiHandlerFb(ident: number, params: IParams): void;
  _escHandlerFb(ident: number): void;
  _executeHandlerFb(code: number): void;
  _printHandler(data: Uint32Array, start: number, end: number): void;
  _oscParser: { start(): void; put(data: Uint32Array, start: number, end: number): void; end(success: boolean, promiseResult?: boolean): void | Promise<boolean> };
  _dcsParser: { hook(ident: number, params: IParams): void; put(data: Uint32Array, start: number, end: number): void; unhook(success: boolean, promiseResult?: boolean): void | Promise<boolean> };
  _apcParser: { start(ident: number): void; put(data: Uint32Array, start: number, end: number): void; end(success: boolean, promiseResult?: boolean): void | Promise<boolean> };
  _preserveStack(state: ParserStackType, handlers: ResumableHandlersType, handlerPos: number, transition: number, chunkPos: number): void;
  _errorHandler(state: IParsingState): IParsingState;
}

let wasmReady = false;

function ensureWasm(): void {
  if (!wasmReady) {
    WasmEscapeScanner.initSync();
    wasmReady = true;
  }
}

function loadParams(host: IWasmParseHost, scan: ScanResult, opIndex: number): void {
  const start = scan.paramStarts[opIndex] ?? 0;
  const count = scan.paramCounts[opIndex] ?? 0;
  if (count === 0) {
    host._params.resetZdm();
    return;
  }
  let idx = start;
  host._params.resetZdm();
  for (let p = 0; p < count; p++) {
    const main = scan.params[idx++] | 0;
    if (p === 0) {
      host._params.params[0] = main;
      host._params.length = 1;
    } else {
      host._params.addParam(main);
    }
    while (idx < scan.params.length && (scan.params[idx] & 0x80000000) !== 0) {
      const sv = scan.params[idx++] & 0x7FFFFFFF;
      host._params.addSubParam(sv === 0x7FFFFFFF ? -1 : sv);
    }
  }
}

export function parseWithWasmScanner(
  host: IWasmParseHost,
  data: Uint32Array,
  length: number,
  promiseResult: boolean | undefined,
  scanCache: { scan?: ScanResult; data?: Uint32Array; opIndex: number; stateBeforeScan?: number }
): void | Promise<boolean> {
  ensureWasm();

  // Resume async handler dispatch without rescanning
  if (host._parseStack.state) {
    return resumeWasmParse(host, data, length, promiseResult, scanCache);
  }

  const stateBeforeScan = host.currentState;
  scanCache.stateBeforeScan = stateBeforeScan;
  WasmEscapeScanner.syncParserState(host.currentState, host.collect, host._params);
  const scan = WasmEscapeScanner.scan(data, length);
  scanCache.scan = scan;
  scanCache.data = data;
  scanCache.opIndex = 0;

  host.currentState = WasmEscapeScanner.currentState;
  host.collect = WasmEscapeScanner.collect;

  return dispatchScanOps(host, data, scan, 0, scanCache, promiseResult, stateBeforeScan);
}

function resumeWasmParse(
  host: IWasmParseHost,
  data: Uint32Array,
  length: number,
  promiseResult: boolean | undefined,
  scanCache: { scan?: ScanResult; data?: Uint32Array; opIndex: number; stateBeforeScan?: number }
): void | Promise<boolean> {
  if (host._parseStack.state === ParserStackType.RESET) {
    host._parseStack.state = ParserStackType.NONE;
    scanCache.opIndex = host._parseStack.chunkPos + 1;
    host._parseStack.chunkPos = 0;
    if (!scanCache.scan || scanCache.data !== data) {
      return parseWithWasmScanner(host, data, length, promiseResult, scanCache);
    }
    return dispatchScanOps(host, data, scanCache.scan, scanCache.opIndex, scanCache, promiseResult, scanCache.stateBeforeScan ?? host.currentState);
  }

  if (promiseResult === undefined || host._parseStack.state === ParserStackType.FAIL) {
    host._parseStack.state = ParserStackType.FAIL;
    throw new Error('improper continuation due to previous async handler, giving up parsing');
  }

  const handlers = host._parseStack.handlers;
  let handlerPos = host._parseStack.handlerPos - 1;
  let handlerResult: void | boolean | Promise<boolean>;
  const scan = scanCache.scan;
  const opIndex = scanCache.opIndex;

  if (!scan) {
    throw new Error('missing scan cache on wasm parser resume');
  }

  switch (host._parseStack.state) {
    case ParserStackType.CSI:
      if (promiseResult === false && handlerPos > -1) {
        for (; handlerPos >= 0; handlerPos--) {
          handlerResult = (handlers as CsiHandlerType[])[handlerPos](host._params);
          if (handlerResult === true) break;
          if (handlerResult instanceof Promise) {
            host._parseStack.handlerPos = handlerPos;
            return handlerResult;
          }
        }
      }
      host._parseStack.handlers = [];
      scanCache.opIndex = opIndex + 1;
      break;
    case ParserStackType.ESC:
      if (promiseResult === false && handlerPos > -1) {
        for (; handlerPos >= 0; handlerPos--) {
          handlerResult = (handlers as EscHandlerType[])[handlerPos]();
          if (handlerResult === true) break;
          if (handlerResult instanceof Promise) {
            host._parseStack.handlerPos = handlerPos;
            return handlerResult;
          }
        }
      }
      host._parseStack.handlers = [];
      scanCache.opIndex = opIndex + 1;
      break;
    case ParserStackType.DCS: {
      const code = data[host._parseStack.chunkPos];
      handlerResult = host._dcsParser.unhook(code !== 0x18 && code !== 0x1a, promiseResult);
      if (handlerResult) return handlerResult;
      if (code === 0x1b) host.currentState = ParserState.ESCAPE;
      host._params.resetZdm();
      host.collect = 0;
      scanCache.opIndex = opIndex + 1;
      break;
    }
    case ParserStackType.OSC: {
      const code = data[host._parseStack.chunkPos];
      handlerResult = host._oscParser.end(code !== 0x18 && code !== 0x1a, promiseResult);
      if (handlerResult) return handlerResult;
      if (code === 0x1b) host.currentState = ParserState.ESCAPE;
      host._params.resetZdm();
      host.collect = 0;
      scanCache.opIndex = opIndex + 1;
      break;
    }
    case ParserStackType.APC: {
      const code = data[host._parseStack.chunkPos];
      handlerResult = host._apcParser.end(code !== 0x18 && code !== 0x1a, promiseResult);
      if (handlerResult) return handlerResult;
      if (code === 0x1b) host.currentState = ParserState.ESCAPE;
      host._params.resetZdm();
      host.collect = 0;
      scanCache.opIndex = opIndex + 1;
      break;
    }
  }

  host._parseStack.state = ParserStackType.NONE;
  host.precedingJoinState = 0;
  return dispatchScanOps(host, data, scan, scanCache.opIndex, scanCache, promiseResult, scanCache.stateBeforeScan ?? host.currentState);
}

function dispatchScanOps(
  host: IWasmParseHost,
  data: Uint32Array,
  scan: ScanResult,
  fromOp: number,
  scanCache: { scan?: ScanResult; data?: Uint32Array; opIndex: number },
  promiseResult: boolean | undefined,
  stateBeforeScan: number
): void | Promise<boolean> {
  let handlerResult: void | boolean | Promise<boolean>;

  for (let o = fromOp; o < scan.opCount; o++) {
    scanCache.opIndex = o;
    const kind = scan.kinds[o];
    const start = scan.starts[o];
    const len = scan.lengths[o];
    const aux = scan.aux[o];
    const chunkPos = (kind === Op.Csi || kind === Op.Esc) ? len : start;

    switch (kind) {
      case Op.Print:
        host._printHandler(data, start, start + len);
        break;
      case Op.Execute: {
        const code = aux;
        if (code < 0x18) {
          const exe = host._executeHandlersArr[code];
          if (exe) exe(code);
          else host._executeHandlerFb(code);
        } else if (host._executeHandlers[code]) {
          host._executeHandlers[code]!();
        } else {
          host._executeHandlerFb(code);
        }
        host.precedingJoinState = 0;
        break;
      }
      case Op.Csi: {
        host.collect = aux >> 8;
        loadParams(host, scan, o);
        const handlers = host._csiHandlers[aux];
        let j = handlers ? handlers.length - 1 : -1;
        for (; j >= 0; j--) {
          handlerResult = handlers![j](host._params);
          if (handlerResult === true) break;
          if (handlerResult instanceof Promise) {
            host._preserveStack(ParserStackType.CSI, handlers!, j, 0, chunkPos);
            return handlerResult;
          }
        }
        if (j < 0) host._csiHandlerFb(aux, host._params);
        host.precedingJoinState = 0;
        break;
      }
      case Op.Esc: {
        host.collect = aux >> 8;
        loadParams(host, scan, o);
        const handlersEsc = host._escHandlers[aux];
        let jj = handlersEsc ? handlersEsc.length - 1 : -1;
        for (; jj >= 0; jj--) {
          handlerResult = handlersEsc![jj]();
          if (handlerResult === true) break;
          if (handlerResult instanceof Promise) {
            host._preserveStack(ParserStackType.ESC, handlersEsc!, jj, 0, chunkPos);
            return handlerResult;
          }
        }
        if (jj < 0) host._escHandlerFb(aux);
        host.precedingJoinState = 0;
        break;
      }
      case Op.OscStart:
        host._oscParser.start();
        break;
      case Op.OscPut:
        if (len > 0) host._oscParser.put(data, start, start + len);
        break;
      case Op.OscEnd: {
        const term = aux;
        handlerResult = host._oscParser.end(term !== 0x18 && term !== 0x1a);
        if (handlerResult) {
          host._preserveStack(ParserStackType.OSC, [], 0, 0, start);
          return handlerResult;
        }
        if (term === 0x1b) host.currentState = ParserState.ESCAPE;
        host._params.resetZdm();
        host.collect = 0;
        host.precedingJoinState = 0;
        break;
      }
      case Op.DcsHook: {
        host.collect = aux >> 8;
        loadParams(host, scan, o);
        host._dcsParser.hook(aux, host._params);
        break;
      }
      case Op.DcsPut:
        if (len > 0) host._dcsParser.put(data, start, start + len);
        break;
      case Op.DcsUnhook: {
        const term = aux;
        handlerResult = host._dcsParser.unhook(term !== 0x18 && term !== 0x1a);
        if (handlerResult) {
          host._preserveStack(ParserStackType.DCS, [], 0, 0, start);
          return handlerResult;
        }
        host._params.resetZdm();
        host.collect = 0;
        host.precedingJoinState = 0;
        break;
      }
      case Op.ApcStart:
        host._apcParser.start(aux);
        break;
      case Op.ApcPut:
        if (len > 0) host._apcParser.put(data, start, start + len);
        break;
      case Op.ApcEnd: {
        const term = aux;
        handlerResult = host._apcParser.end(term !== 0x18 && term !== 0x1a);
        if (handlerResult) {
          host._preserveStack(ParserStackType.APC, [], 0, 0, start);
          return handlerResult;
        }
        host._params.resetZdm();
        host.collect = 0;
        host.precedingJoinState = 0;
        break;
      }
      case Op.Error: {
        WasmEscapeScanner.exportParamsTo(host._params);
        const inject = host._errorHandler({
          position: start,
          code: aux & 0xFFFF,
          currentState: aux >> 16,
          collect: WasmEscapeScanner.collect,
          params: host._params,
          abort: false
        });
        if (inject.abort) return;
        break;
      }
    }
  }

  scanCache.opIndex = scan.opCount;
  host.currentState = WasmEscapeScanner.currentState;
  host.collect = WasmEscapeScanner.collect;
  WasmEscapeScanner.exportParamsTo(host._params);
}
