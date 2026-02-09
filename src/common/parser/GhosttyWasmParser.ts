/**
 * Copyright (c) 2026 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import { Disposable, toDisposable } from 'common/Lifecycle';
import { IDisposable } from 'common/Types';
import { IParsingState, IDcsHandler, IEscapeSequenceParser, IParams, IOscHandler, IHandlerCollection, CsiHandlerType, OscFallbackHandlerType, EscHandlerType, IDcsParser, DcsFallbackHandlerType, IFunctionIdentifier, ExecuteFallbackHandlerType, CsiFallbackHandlerType, EscFallbackHandlerType, PrintHandlerType, PrintFallbackHandlerType, ExecuteHandlerType, IParserStackState, ParserStackType, IApcHandler, IApcParser, ApcFallbackHandlerType } from 'common/parser/Types';
import { OscParser } from 'common/parser/OscParser';
import { DcsParser } from 'common/parser/DcsParser';
import { ApcParser } from 'common/parser/ApcParser';
import { Params } from 'common/parser/Params';
import { StringToUtf32 } from 'common/input/TextDecoder';
import { GhosttyWasmRuntime, IGhosttyWasmExports } from 'common/parser/GhosttyWasmRuntime';

const enum RawEventTag {
  PRINT = 0,
  EXECUTE = 1,
  ESC = 2,
  CSI = 3,
  OSC = 4,
  DCS_HOOK = 5,
  DCS_PUT = 6,
  DCS_UNHOOK = 7,
  APC_START = 8,
  APC_PUT = 9,
  APC_END = 10
}

export class GhosttyWasmParser extends Disposable implements IEscapeSequenceParser {
  public precedingJoinState = 0;

  private _printHandler: PrintHandlerType;
  private _executeHandlers: { [flag: number]: ExecuteHandlerType };
  private _csiHandlers: IHandlerCollection<CsiHandlerType>;
  private _escHandlers: IHandlerCollection<EscHandlerType>;
  private readonly _oscParser: OscParser;
  private readonly _dcsParser: IDcsParser;
  private readonly _apcParser: IApcParser;
  private _errorHandler: (state: IParsingState) => IParsingState;

  private _printHandlerFb: PrintFallbackHandlerType;
  private _executeHandlerFb: ExecuteFallbackHandlerType;
  private _csiHandlerFb: CsiFallbackHandlerType;
  private _escHandlerFb: EscFallbackHandlerType;
  private _errorHandlerFb: (state: IParsingState) => IParsingState;

  private _parseStack: IParserStackState = {
    state: ParserStackType.NONE,
    handlers: [],
    handlerPos: 0,
    transition: 0,
    chunkPos: 0
  };

  private _wasm?: IGhosttyWasmExports;
  private _parserHandle = 0;
  private _wasmReady?: Promise<boolean>;

  private _eventSize = 0;
  private _eventMaxParams = 0;
  private _eventMaxIntermediates = 0;
  private readonly _ptrSize = 4;

  private _eventIndex = 0;
  private _pendingEvents: { ptr: number, len: number } | undefined;
  private _resumeParams: IParams | undefined;

  private _textEncoder = new TextEncoder();
  private _textDecoder = new TextDecoder('utf-8');
  private _utf32Scratch = new Uint32Array(4096);
  private _oscBuffer = new StringToUtf32();
  private _dcsPutBuffer = new Uint32Array(1);
  private _apcPutBuffer = new Uint32Array(1);

  constructor() {
    super();

    this._printHandlerFb = () => { };
    this._executeHandlerFb = () => { };
    this._csiHandlerFb = () => { };
    this._escHandlerFb = () => { };
    this._errorHandlerFb = (state: IParsingState): IParsingState => state;

    this._printHandler = this._printHandlerFb;
    this._executeHandlers = Object.create(null);
    this._csiHandlers = Object.create(null);
    this._escHandlers = Object.create(null);

    this._oscParser = this._register(new OscParser());
    this._dcsParser = this._register(new DcsParser());
    this._apcParser = this._register(new ApcParser());
    this._errorHandler = this._errorHandlerFb;

    this._register(toDisposable(() => {
      this._csiHandlers = Object.create(null);
      this._executeHandlers = Object.create(null);
      this._escHandlers = Object.create(null);
    }));

    this._register(toDisposable(() => {
      if (this._wasm && this._parserHandle) {
        this._wasm.ghostty_raw_parser_free(this._parserHandle);
      }
      this._parserHandle = 0;
    }));

    this.registerEscHandler({ final: '\\' }, () => true);
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
    this._executeHandlers[flag.charCodeAt(0)] = handler;
  }

  public clearExecuteHandler(flag: string): void {
    if (this._executeHandlers[flag.charCodeAt(0)]) delete this._executeHandlers[flag.charCodeAt(0)];
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

  public setCsiHandlerFallback(callback: CsiFallbackHandlerType): void {
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

  public registerApcHandler(ident: number, handler: IApcHandler): IDisposable {
    return this._apcParser.registerHandler(ident, handler);
  }

  public clearApcHandler(ident: number): void {
    this._apcParser.clearHandler(ident);
  }

  public setApcHandlerFallback(handler: ApcFallbackHandlerType): void {
    this._apcParser.setHandlerFallback(handler);
  }

  public setErrorHandler(handler: (state: IParsingState) => IParsingState): void {
    this._errorHandler = handler;
  }

  public clearErrorHandler(): void {
    this._errorHandler = this._errorHandlerFb;
  }

  public reset(): void {
    this._oscParser.reset();
    this._dcsParser.reset();
    this._apcParser.reset();
    this.precedingJoinState = 0;
    if (this._wasm && this._parserHandle) {
      this._wasm.ghostty_raw_parser_reset(this._parserHandle);
    }
    if (this._parseStack.state !== ParserStackType.NONE) {
      this._parseStack.state = ParserStackType.RESET;
      this._parseStack.handlers = [];
    }
  }

  public parse(data: Uint32Array, length: number, promiseResult?: boolean): void | Promise<boolean> {
    if (!this._wasm) {
      this._wasmReady ??= this._initWasm();
      return this._wasmReady;
    }

    if (this._parseStack.state !== ParserStackType.NONE) {
      return this._resume(promiseResult);
    }

    const bytes = this._encodeUtf32(data, length);
    const result = this._writeToWasm(bytes);
    if (result) {
      return result;
    }
    return this._drainEvents();
  }

  private _resume(promiseResult?: boolean): void | Promise<boolean> {
    if (promiseResult === undefined || this._parseStack.state === ParserStackType.FAIL) {
      this._parseStack.state = ParserStackType.FAIL;
      throw new Error('improper continuation due to previous async handler, giving up parsing');
    }

    switch (this._parseStack.state) {
      case ParserStackType.CSI:
      case ParserStackType.ESC:
        return this._resumeHandlerLoop(promiseResult);
      case ParserStackType.OSC:
        return this._resumeOsc(promiseResult);
      case ParserStackType.DCS:
        return this._resumeDcs(promiseResult);
      case ParserStackType.APC:
        return this._resumeApc(promiseResult);
      case ParserStackType.RESET:
        this._parseStack.state = ParserStackType.NONE;
        return;
      default:
        this._parseStack.state = ParserStackType.NONE;
        return;
    }
  }

  private _resumeHandlerLoop(promiseResult: boolean): void | Promise<boolean> {
    const handlers = this._parseStack.handlers as CsiHandlerType[] | EscHandlerType[];
    let handlerPos = this._parseStack.handlerPos - 1;
    if (promiseResult === false && handlerPos > -1) {
      if (this._parseStack.state === ParserStackType.CSI) {
        const params = this._resumeParams ?? new Params();
        for (; handlerPos >= 0; handlerPos--) {
          const handlerResult = (handlers as CsiHandlerType[])[handlerPos](params);
          if (handlerResult === true) {
            break;
          } else if (handlerResult instanceof Promise) {
            this._parseStack.handlerPos = handlerPos;
            return handlerResult;
          }
        }
      } else {
        for (; handlerPos >= 0; handlerPos--) {
          const handlerResult = (handlers as EscHandlerType[])[handlerPos]();
          if (handlerResult === true) {
            break;
          } else if (handlerResult instanceof Promise) {
            this._parseStack.handlerPos = handlerPos;
            return handlerResult;
          }
        }
      }
    }

    this._resumeParams = undefined;
    this._parseStack.handlers = [];
    this._parseStack.state = ParserStackType.NONE;
    return this._continueAfterAsync();
  }

  private _resumeOsc(promiseResult: boolean): void | Promise<boolean> {
    const handlerResult = this._oscParser.end(true, promiseResult);
    if (handlerResult) {
      return handlerResult as Promise<boolean>;
    }
    this._parseStack.state = ParserStackType.NONE;
    return this._continueAfterAsync();
  }

  private _resumeDcs(promiseResult: boolean): void | Promise<boolean> {
    const handlerResult = this._dcsParser.unhook(true, promiseResult);
    if (handlerResult) {
      return handlerResult as Promise<boolean>;
    }
    this._parseStack.state = ParserStackType.NONE;
    return this._continueAfterAsync();
  }

  private _resumeApc(promiseResult: boolean): void | Promise<boolean> {
    const handlerResult = this._apcParser.end(true, promiseResult);
    if (handlerResult) {
      return handlerResult as Promise<boolean>;
    }
    this._parseStack.state = ParserStackType.NONE;
    return this._continueAfterAsync();
  }

  private _identifier(id: IFunctionIdentifier, finalRange: number[] = [0x40, 0x7e]): number {
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

  private async _initWasm(): Promise<boolean> {
    this._wasm = await GhosttyWasmRuntime.getInstance();
    this._parserHandle = this._wasm.ghostty_raw_parser_new(0);
    this._eventSize = this._wasm.ghostty_raw_parser_event_size();
    this._eventMaxParams = this._wasm.ghostty_raw_parser_max_params();
    this._eventMaxIntermediates = this._wasm.ghostty_raw_parser_max_intermediates();
    return true;
  }

  private _encodeUtf32(data: Uint32Array, length: number): Uint8Array {
    if (length === 0) {
      return new Uint8Array(0);
    }
    const bytes: number[] = [];
    for (let i = 0; i < length; i++) {
      const codePoint = data[i];
      if (codePoint === 0x9c) {
        bytes.push(0x1b, 0x5c);
        continue;
      }
      if (codePoint <= 0x7f || (codePoint >= 0x80 && codePoint <= 0x9f)) {
        bytes.push(codePoint);
      } else if (codePoint <= 0x7ff) {
        bytes.push(
          0xc0 | (codePoint >> 6),
          0x80 | (codePoint & 0x3f)
        );
      } else if (codePoint <= 0xffff) {
        bytes.push(
          0xe0 | (codePoint >> 12),
          0x80 | ((codePoint >> 6) & 0x3f),
          0x80 | (codePoint & 0x3f)
        );
      } else {
        bytes.push(
          0xf0 | (codePoint >> 18),
          0x80 | ((codePoint >> 12) & 0x3f),
          0x80 | ((codePoint >> 6) & 0x3f),
          0x80 | (codePoint & 0x3f)
        );
      }
    }
    return new Uint8Array(bytes);
  }

  private _writeToWasm(bytes: Uint8Array): void | Promise<boolean> {
    if (!this._wasm || !this._parserHandle) {
      return;
    }
    if (!bytes.length) {
      return;
    }

    const dataPtr = this._wasm.ghostty_wasm_alloc_u8_array(bytes.length);
    if (!dataPtr) {
      return;
    }

    const mem = new Uint8Array(this._wasm.memory.buffer, dataPtr, bytes.length);
    mem.set(bytes);
    this._wasm.ghostty_raw_parser_write(this._parserHandle, dataPtr, bytes.length);
    this._wasm.ghostty_wasm_free_u8_array(dataPtr, bytes.length);
  }

  private _drainEvents(): void | Promise<boolean> {
    if (!this._wasm || !this._parserHandle) {
      return;
    }

    const eventsPtr = this._wasm.ghostty_raw_parser_events_ptr(this._parserHandle);
    const eventsLen = this._wasm.ghostty_raw_parser_events_len(this._parserHandle);
    if (!eventsPtr || !eventsLen) {
      this._wasm.ghostty_raw_parser_events_clear(this._parserHandle);
      return;
    }

    this._pendingEvents = { ptr: eventsPtr, len: eventsLen };
    this._eventIndex = 0;

    const result = this._processEvents();
    if (result) {
      return result;
    }

    this._wasm.ghostty_raw_parser_events_clear(this._parserHandle);
    this._pendingEvents = undefined;
  }

  private _continueAfterAsync(): void | Promise<boolean> {
    if (!this._wasm || !this._parserHandle || !this._pendingEvents) {
      return;
    }

    this._eventIndex++;
    const result = this._processEvents();
    if (result) {
      return result;
    }

    this._wasm.ghostty_raw_parser_events_clear(this._parserHandle);
    this._pendingEvents = undefined;
  }

  private _processEvents(): void | Promise<boolean> {
    if (!this._pendingEvents || !this._wasm) {
      return;
    }

    const { ptr, len } = this._pendingEvents;
    const mem = this._wasm.memory.buffer;
    const view = new DataView(mem);

    let textStart = 0;
    let textLen = 0;

    for (; this._eventIndex < len; this._eventIndex++) {
      const base = ptr + this._eventIndex * this._eventSize;
      const tag = view.getInt32(base, true);

      if (tag !== RawEventTag.PRINT && textLen > 0) {
        this._flushText(view, ptr, textStart, textLen);
        textLen = 0;
      }

      switch (tag) {
        case RawEventTag.PRINT: {
          if (textLen === 0) {
            textStart = this._eventIndex;
          }
          textLen++;
          break;
        }
        case RawEventTag.EXECUTE: {
          const code = view.getUint32(base + 4, true);
          this._handleExecute(code);
          break;
        }
        case RawEventTag.ESC: {
          const event = this._readEvent(view, base);
          const ident = this._buildIdent(event.intermediates, event.final, false, [0x30, 0x7e]);
          const handlers = this._escHandlers[ident];
          const handlerResult = this._callEscHandlers(handlers, ident);
          if (handlerResult) {
            return handlerResult;
          }
          break;
        }
        case RawEventTag.CSI: {
          const event = this._readEvent(view, base);
          const params = this._buildParams(event.params, event.paramsLen, event.paramsSep);
          const ident = this._buildIdent(event.intermediates, event.final, true);
          const handlers = this._csiHandlers[ident];
          const handlerResult = this._callCsiHandlers(handlers, ident, params);
          if (handlerResult) {
            return handlerResult;
          }
          break;
        }
        case RawEventTag.OSC: {
          const event = this._readEvent(view, base);
          const oscResult = this._handleOsc(event.code, event.dataPtr, event.dataLen);
          if (oscResult) {
            return oscResult;
          }
          break;
        }
        case RawEventTag.DCS_HOOK: {
          const event = this._readEvent(view, base);
          const params = this._buildParams(event.params, event.paramsLen, event.paramsSep);
          const ident = this._buildIdent(event.intermediates, event.final, true);
          this._dcsParser.hook(ident, params);
          this.precedingJoinState = 0;
          break;
        }
        case RawEventTag.DCS_PUT: {
          const code = view.getUint32(base + 4, true);
          this._dcsPutBuffer[0] = code;
          this._dcsParser.put(this._dcsPutBuffer, 0, 1);
          break;
        }
        case RawEventTag.DCS_UNHOOK: {
          const dcsResult = this._dcsParser.unhook(true);
          if (dcsResult) {
            this._parseStack.state = ParserStackType.DCS;
            this.precedingJoinState = 0;
            return dcsResult as Promise<boolean>;
          }
          this.precedingJoinState = 0;
          break;
        }
        case RawEventTag.APC_START: {
          this._apcParser.start();
          this.precedingJoinState = 0;
          break;
        }
        case RawEventTag.APC_PUT: {
          const code = view.getUint32(base + 4, true);
          this._apcPutBuffer[0] = code;
          this._apcParser.put(this._apcPutBuffer, 0, 1);
          break;
        }
        case RawEventTag.APC_END: {
          const apcResult = this._apcParser.end(true);
          if (apcResult) {
            this._parseStack.state = ParserStackType.APC;
            this.precedingJoinState = 0;
            return apcResult as Promise<boolean>;
          }
          this.precedingJoinState = 0;
          break;
        }
      }
    }

    if (textLen > 0) {
      this._flushText(view, ptr, textStart, textLen);
    }

    return;
  }

  private _flushText(view: DataView, ptr: number, start: number, count: number): void {
    let remaining = count;
    let offset = 0;
    while (remaining > 0) {
      const chunk = Math.min(remaining, this._utf32Scratch.length);
      for (let i = 0; i < chunk; i++) {
        const base = ptr + (start + offset + i) * this._eventSize;
        const code = view.getUint32(base + 4, true);
        this._utf32Scratch[i] = code;
      }
      this._printHandler(this._utf32Scratch, 0, chunk);
      remaining -= chunk;
      offset += chunk;
    }
  }

  private _handleExecute(code: number): void {
    if (this._executeHandlers[code]) {
      this._executeHandlers[code]();
    } else {
      this._executeHandlerFb(code);
    }
    this.precedingJoinState = 0;
  }

  private _callEscHandlers(handlers: EscHandlerType[] | undefined, ident: number): void | Promise<boolean> {
    if (!handlers) {
      this._escHandlerFb(ident);
      this.precedingJoinState = 0;
      return;
    }
    let j = handlers.length - 1;
    for (; j >= 0; j--) {
      const handlerResult = handlers[j]();
      if (handlerResult === true) {
        break;
      } else if (handlerResult instanceof Promise) {
        this._parseStack.state = ParserStackType.ESC;
        this._parseStack.handlers = handlers;
        this._parseStack.handlerPos = j;
        this.precedingJoinState = 0;
        return handlerResult;
      }
    }
    if (j < 0) {
      this._escHandlerFb(ident);
    }
    this.precedingJoinState = 0;
  }

  private _callCsiHandlers(handlers: CsiHandlerType[] | undefined, ident: number, params: IParams): void | Promise<boolean> {
    if (!handlers) {
      this._csiHandlerFb(ident, params);
      this.precedingJoinState = 0;
      return;
    }
    let j = handlers.length - 1;
    for (; j >= 0; j--) {
      const handlerResult = handlers[j](params);
      if (handlerResult === true) {
        break;
      } else if (handlerResult instanceof Promise) {
        this._parseStack.state = ParserStackType.CSI;
        this._resumeParams = params;
        this._parseStack.handlers = handlers;
        this._parseStack.handlerPos = j;
        this.precedingJoinState = 0;
        return handlerResult;
      }
    }
    if (j < 0) {
      this._csiHandlerFb(ident, params);
    }
    this.precedingJoinState = 0;
  }

  private _handleOsc(oscId: number, dataPtr: number, dataLen: number): void | Promise<boolean> {
    console.log('handle osc');
    if (!this._wasm) {
      return;
    }

    let payload = '';
    if (dataLen > 0) {
      if (!dataPtr || dataPtr + dataLen > this._wasm.memory.buffer.byteLength) {
        return;
      }
      const bytes = new Uint8Array(this._wasm.memory.buffer, dataPtr, dataLen);
      payload = this._textDecoder.decode(bytes);
    }
    if (payload.indexOf('\u0000') !== -1) {
      if (oscId === 8) {
        const parts = payload.split('\u0000').filter((part, index, all) => {
          if (part.length > 0) {
            return true;
          }
          return index < all.length - 1;
        });
        if (parts.length > 0) {
          const uri = parts[parts.length - 1] ?? '';
          const params = parts.slice(0, -1).join(':');
          payload = `${params};${uri}`;
        } else {
          payload = '';
        }
      } else {
        payload = payload.replace(/\u0000+/g, '');
      }
    }
    const oscPrefix = `${oscId};`;
    const rawPayload = payload.startsWith(oscPrefix)
      ? payload.slice(oscPrefix.length)
      : payload;
    let oscPayload = rawPayload;
    if (oscId === 8 && oscPayload && !oscPayload.startsWith(';')) {
      const sepIndex = oscPayload.indexOf(';');
      const paramsPart = sepIndex === -1 ? oscPayload : oscPayload.slice(0, sepIndex);
      if (!paramsPart.includes('=')) {
        oscPayload = `;${oscPayload}`;
      }
    }
    const oscString = `${oscPrefix}${oscPayload}`;

    this._oscParser.start();
    const length = this._decodeToScratch(oscString);
    this._oscParser.put(this._utf32Scratch, 0, length);
    const handlerResult = this._oscParser.end(true);
    if (handlerResult) {
      this._parseStack.state = ParserStackType.OSC;
      this.precedingJoinState = 0;
      return handlerResult as Promise<boolean>;
    }
    this.precedingJoinState = 0;
  }

  private _buildParams(params: Uint16Array, length: number, sepBits: number): Params {
    const result = new Params(this._eventMaxParams, 256);
    if (length === 0) {
      result.addParam(0);
      return result;
    }

    let i = 0;
    while (i < length) {
      result.addParam(params[i]);
      if (sepBits & (1 << i)) {
        i++;
        while (i < length) {
          result.addSubParam(params[i]);
          if ((sepBits & (1 << i)) === 0) {
            break;
          }
          i++;
        }
      }
      i++;
    }

    return result;
  }

  private _buildIdent(intermediates: string, final: string, allowPrefix: boolean, finalRange: number[] = [0x40, 0x7e]): number {
    let prefix: string | undefined;
    let inters = intermediates;
    if (allowPrefix && intermediates.length) {
      const first = intermediates.charCodeAt(0);
      if (first >= 0x3c && first <= 0x3f) {
        prefix = intermediates.charAt(0);
        inters = intermediates.substring(1);
      }
    }
    return this._identifier({ prefix, intermediates: inters || undefined, final }, finalRange);
  }

  private _readEvent(view: DataView, base: number): {
    final: string;
    intermediates: string;
    params: Uint16Array;
    paramsLen: number;
    paramsSep: number;
    code: number;
    dataPtr: number;
    dataLen: number;
  } {
    const code = view.getUint32(base + 4, true);
    const final = String.fromCharCode(view.getUint8(base + 8));
    const intermediatesLen = Math.min(view.getUint8(base + 9), this._eventMaxIntermediates);
    const paramsLen = Math.min(view.getUint8(base + 10), this._eventMaxParams);
    const paramsSep = view.getUint32(base + 12, true);

    let intermediates = '';
    const interOffset = base + 16;
    for (let i = 0; i < intermediatesLen; i++) {
      intermediates += String.fromCharCode(view.getUint8(interOffset + i));
    }

    const paramsOffset = base + 16 + this._eventMaxIntermediates;
    const params = new Uint16Array(paramsLen);
    for (let i = 0; i < paramsLen; i++) {
      params[i] = view.getUint16(paramsOffset + i * 2, true);
    }

    const rawDataPtrOffset = paramsOffset + this._eventMaxParams * 2;
    const dataPtrOffset = (rawDataPtrOffset + (this._ptrSize - 1)) & ~(this._ptrSize - 1);
    const dataPtr = view.getUint32(dataPtrOffset, true);
    const dataLen = view.getUint32(dataPtrOffset + this._ptrSize, true);

    return {
      final,
      intermediates,
      params,
      paramsLen,
      paramsSep,
      code,
      dataPtr,
      dataLen
    };
  }

  private _decodeToScratch(text: string): number {
    if (this._utf32Scratch.length < text.length * 2) {
      this._utf32Scratch = new Uint32Array(text.length * 2);
    }
    return this._oscBuffer.decode(text, this._utf32Scratch);
  }
}
