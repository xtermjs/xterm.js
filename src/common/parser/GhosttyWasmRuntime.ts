/**
 * Copyright (c) 2026 The xterm.js authors. All rights reserved.
 * @license MIT
 */

/* eslint-disable @typescript-eslint/naming-convention */
export interface IGhosttyWasmExports {
  memory: WebAssembly.Memory;
  ghostty_raw_parser_new(allocPtr: number): number;
  ghostty_raw_parser_free(parser: number): void;
  ghostty_raw_parser_reset(parser: number): void;
  ghostty_raw_parser_write(parser: number, dataPtr: number, len: number): void;
  ghostty_raw_parser_events_ptr(parser: number): number;
  ghostty_raw_parser_events_len(parser: number): number;
  ghostty_raw_parser_events_clear(parser: number): void;
  ghostty_raw_parser_event_size(): number;
  ghostty_raw_parser_max_params(): number;
  ghostty_raw_parser_max_intermediates(): number;
  ghostty_wasm_alloc_u8_array(len: number): number;
  ghostty_wasm_free_u8_array(ptr: number, len: number): void;
  ghostty_xterm_buffer_new(cols: number, rows: number, maxRows: number): number;
  ghostty_xterm_buffer_free(buffer: number): void;
  ghostty_xterm_buffer_resize(buffer: number, cols: number, rows: number, maxRows: number): number;
  ghostty_xterm_buffer_clear(buffer: number): void;
  ghostty_xterm_buffer_get_cols(buffer: number): number;
  ghostty_xterm_buffer_get_rows(buffer: number): number;
  ghostty_xterm_buffer_get_max_rows(buffer: number): number;
  ghostty_xterm_buffer_get_cell(buffer: number, row: number, col: number, outPtr: number): void;
  ghostty_xterm_buffer_set_cell(buffer: number, row: number, col: number, content: number, fg: number, bg: number): void;
  ghostty_xterm_buffer_clear_row(buffer: number, row: number, content: number, fg: number, bg: number): void;
  ghostty_xterm_buffer_copy_row(buffer: number, srcRow: number, dstRow: number): void;
  ghostty_xterm_buffer_get_row_wrap(buffer: number, row: number): number;
  ghostty_xterm_buffer_set_row_wrap(buffer: number, row: number, wrap: number): void;
}
/* eslint-enable @typescript-eslint/naming-convention */

export class GhosttyWasmRuntime {
  private static _instancePromise: Promise<IGhosttyWasmExports> | undefined;
  private static _instanceSync: IGhosttyWasmExports | undefined;

  public static getInstance(): Promise<IGhosttyWasmExports> {
    this._instancePromise ??= this._loadAsync();
    return this._instancePromise;
  }

  public static getInstanceSync(): IGhosttyWasmExports {
    this._instanceSync ??= this._loadSync();
    return this._instanceSync;
  }

  private static async _loadAsync(): Promise<IGhosttyWasmExports> {
    const wasmUrl = GhosttyWasmRuntime._getWasmUrl();
    const isNode = typeof globalThis !== 'undefined' && !!(globalThis as any).process?.versions?.node;
    if (isNode) {
      const requireFn = (globalThis as any).require
        ?? (globalThis as any).process?.mainModule?.require
        ?? (globalThis as any).__xtermRequire;
      const fs = requireFn?.('fs') as { readFile(path: string, cb: (err: Error | null, data?: Uint8Array) => void): void } | undefined;
      if (!fs) {
        throw new Error('Node.js async WASM loading requires require("fs")');
      }
      const wasmBytes = await new Promise<Uint8Array>((resolve, reject) => {
        fs.readFile(wasmUrl, (err, data) => {
          if (err || !data) {
            reject(err ?? new Error(`Failed to load Ghostty WASM from ${wasmUrl}`));
            return;
          }
          resolve(data);
        });
      });
      const env = { log: () => {} };
      const { instance } = await WebAssembly.instantiate(wasmBytes, { env });
      return instance.exports as unknown as IGhosttyWasmExports;
    }

    const response = await fetch(wasmUrl);
    if (!response.ok) {
      throw new Error(`Failed to load Ghostty WASM from ${wasmUrl}`);
    }
    const wasmBytes = await response.arrayBuffer();
    const env = { log: () => {} };
    const { instance } = await WebAssembly.instantiate(wasmBytes, { env });
    return instance.exports as unknown as IGhosttyWasmExports;
  }

  private static _loadSync(): IGhosttyWasmExports {
    const wasmUrl = GhosttyWasmRuntime._getWasmUrl();
    const isNode = typeof globalThis !== 'undefined' && !!(globalThis as any).process?.versions?.node;
    if (!isNode && typeof document !== 'undefined') {
      const request = new XMLHttpRequest();
      request.open('GET', wasmUrl, false);
      request.overrideMimeType('text/plain; charset=x-user-defined');
      request.send(null);
      if (request.status !== 200 || !request.responseText) {
        throw new Error(`Failed to load Ghostty WASM from ${wasmUrl}`);
      }
      const binary = request.responseText;
      const wasmBytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) {
        wasmBytes[i] = binary.charCodeAt(i) & 0xFF;
      }
      const module = new WebAssembly.Module(wasmBytes);
      const env = { log: () => {} };
      const instance = new WebAssembly.Instance(module, { env });
      return instance.exports as unknown as IGhosttyWasmExports;
    }

    // Node.js sync load for tests and headless usage.
    const requireFn = (globalThis as any).require
      ?? (globalThis as any).process?.mainModule?.require
      ?? (globalThis as any).__xtermRequire;
    const fs = requireFn?.('fs') as { readFileSync(path: string): Uint8Array } | undefined;
    if (!fs) {
      throw new Error('Node.js sync WASM loading requires require("fs")');
    }
    const wasmBytes = fs.readFileSync(wasmUrl);
    const module = new WebAssembly.Module(wasmBytes);
    const env = { log: () => {} };
    const instance = new WebAssembly.Instance(module, { env });
    return instance.exports as unknown as IGhosttyWasmExports;
  }

  private static _getWasmUrl(): string {
    const override = (globalThis as any).XTERM_GHOSTTY_WASM_URL as string | undefined;
    if (override) {
      return override;
    }
    if (typeof document !== 'undefined') {
      return 'vendor/ghostty-wasm/ghostty-vt.wasm';
    }
    return 'vendor/ghostty-wasm/ghostty-vt.wasm';
  }
}
