/**
 * Copyright (c) 2026 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import { Params } from './Params';
import { Op, ScanResult } from './ScanTypes';
import { PARSER_WASM_BASE64 } from './wasm/parser.wasm.embed';

export { Op };

const WASM_IMPORTS = {
  env: {
    memory: new WebAssembly.Memory({ initial: 1024, maximum: 1024 })
  }
};

let wasmModule: WebAssembly.Instance | undefined;
let wasmExports: {
  memory: WebAssembly.Memory;
  reset: () => void;
  scan: (offset: number, length: number) => number;
  set_state: (state: number, collect: number) => void;
  get_input_ptr: () => number;
  get_kinds_ptr: () => number;
  get_starts_ptr: () => number;
  get_lengths_ptr: () => number;
  get_aux_ptr: () => number;
  get_param_starts_ptr: () => number;
  get_param_counts_ptr: () => number;
  get_params_ptr: () => number;
  get_state_ptr: () => number;
  get_header_ptr: () => number;
  sync_params_from: (srcPtr: number, len: number) => void;
  export_params_to: (dstPtr: number, maxLen: number) => void;
  get_params_len: () => number;
  get_subparams_len: () => number;
  get_subparams_ptr: () => number;
  get_subparams_idx_ptr: () => number;
};

async function initWasm(): Promise<void> {
  if (wasmModule) return;
  const bytes = Uint8Array.from(atob(PARSER_WASM_BASE64), c => c.charCodeAt(0));
  const mod = await WebAssembly.instantiate(bytes, WASM_IMPORTS);
  wasmModule = mod.instance;
  wasmExports = wasmModule.exports as typeof wasmExports;
}

function ensureWasm(): typeof wasmExports {
  if (!wasmExports) {
    throw new Error('WasmEscapeScanner not initialized. Call WasmEscapeScanner.init() first.');
  }
  return wasmExports;
}

export class WasmEscapeScanner {
  private static _initPromise: Promise<void> | undefined;
  private static _syncReady = false;

  public static init(): Promise<void> {
    if (!this._initPromise) {
      this._initPromise = initWasm().then(() => {
        this._syncReady = true;
        wasmExports.reset();
      });
    }
    return this._initPromise;
  }

  /** Synchronous init for unit tests (Node supports sync instantiate). */
  public static initSync(): void {
    if (this._syncReady) return;
    const binary = globalThis.atob(PARSER_WASM_BASE64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    const mod = new WebAssembly.Module(bytes);
    wasmModule = new WebAssembly.Instance(mod, WASM_IMPORTS);
    wasmExports = wasmModule.exports as typeof wasmExports;
    wasmExports.reset();
    this._syncReady = true;
  }

  public static reset(): void {
    ensureWasm().reset();
  }

  public static get currentState(): number {
    const mem = new Uint32Array(ensureWasm().memory.buffer);
    const statePtr = ensureWasm().get_state_ptr() >> 2;
    return mem[statePtr];
  }

  public static set currentState(value: number) {
    const ex = ensureWasm();
    const mem = new Uint32Array(ex.memory.buffer);
    const statePtr = ex.get_state_ptr() >> 2;
    ex.set_state(value, mem[statePtr + 1]);
  }

  public static get collect(): number {
    const mem = new Uint32Array(ensureWasm().memory.buffer);
    return mem[(ensureWasm().get_state_ptr() >> 2) + 1];
  }

  public static set collect(value: number) {
    const ex = ensureWasm();
    ex.set_state(memState(ex), value);
  }

  public static syncParserState(currentState: number, collect: number, params: Params): void {
    const ex = ensureWasm();
    ex.set_state(currentState, collect);
    if (params.length === 0) {
      ex.sync_params_from(ex.get_params_ptr(), 0);
      return;
    }
    const mem = ex.memory.buffer;
    const paramsPtr = ex.get_params_ptr();
    const view = new Int32Array(mem, paramsPtr, params.length);
    for (let i = 0; i < params.length; i++) {
      view[i] = params.params[i];
    }
    ex.sync_params_from(paramsPtr, params.length);
  }

  public static exportParamsTo(params: Params): void {
    const ex = ensureWasm();
    const len = ex.get_params_len();
    params.reset();
    if (len === 0) {
      params.resetZdm();
      return;
    }
    const mem = ex.memory.buffer;
    const dstPtr = ex.get_params_ptr();
    ex.export_params_to(dstPtr, len);
    const pView = new Int32Array(mem, dstPtr, len);
    const subLen = ex.get_subparams_len();
    const subView = subLen > 0 ? new Int32Array(mem, ex.get_subparams_ptr(), subLen) : undefined;
    const idxView = new Uint16Array(mem, ex.get_subparams_idx_ptr(), len);

    params.resetZdm();
    params.params[0] = pView[0];
    params.length = 1;
    if (subView && len > 0) {
      const start0 = idxView[0] >> 8;
      const end0 = idxView[0] & 0xFF;
      for (let k = start0; k < end0; k++) {
        params.addSubParam(subView[k]);
      }
    }
    for (let i = 1; i < len; i++) {
      params.addParam(pView[i]);
      if (subView) {
        const start = idxView[i] >> 8;
        const end = idxView[i] & 0xFF;
        for (let k = start; k < end; k++) {
          params.addSubParam(subView[k]);
        }
      }
    }
  }

  public static scan(data: Uint32Array, length: number, offset = 0): ScanResult {
    const ex = ensureWasm();
    const inputPtr = ex.get_input_ptr();
    const mem = ex.memory.buffer;
    const inputView = new Uint32Array(mem, inputPtr, length);
    inputView.set(data.subarray(0, length));

    const opCount = ex.scan(offset, length);
    if (opCount < 0) {
      throw new Error('Wasm parser op buffer overflow');
    }

    const count = opCount;
    const kinds = new Uint8Array(mem, ex.get_kinds_ptr(), count);
    const starts = new Uint32Array(mem, ex.get_starts_ptr(), count);
    const lengths = new Uint32Array(mem, ex.get_lengths_ptr(), count);
    const aux = new Uint32Array(mem, ex.get_aux_ptr(), count);
    const paramStarts = new Uint32Array(mem, ex.get_param_starts_ptr(), count);
    const paramCounts = new Uint16Array(mem, ex.get_param_counts_ptr(), count);

    const headerView = new Uint32Array(mem, ex.get_header_ptr(), 4);
    const paramsLen = headerView[2];
    const nextOffset = headerView[3];

    const params = new Uint32Array(mem, ex.get_params_ptr(), paramsLen);

    return {
      kinds: kinds.slice(),
      starts: starts.slice(),
      lengths: lengths.slice(),
      aux: aux.slice(),
      params: params.slice(),
      paramStarts: paramStarts.slice(),
      paramCounts: paramCounts.slice(),
      opCount: count,
      nextOffset
    };
  }
}

function memState(ex: typeof wasmExports): number {
  const mem = new Uint32Array(ex.memory.buffer);
  return mem[ex.get_state_ptr() >> 2];
}
