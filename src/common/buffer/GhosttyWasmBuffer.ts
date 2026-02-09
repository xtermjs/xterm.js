/**
 * Copyright (c) 2026 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import { GhosttyWasmRuntime, IGhosttyWasmExports } from 'common/parser/GhosttyWasmRuntime';
import { IExtendedAttrs } from 'common/Types';

const CELL_STRIDE = 3;

export class GhosttyWasmBuffer {
  private readonly _wasm: IGhosttyWasmExports;
  private _handle: number;
  private _cols: number;
  private _rows: number;
  private _maxRows: number;

  private _combined = new Map<number, Map<number, string>>();
  private _extended = new Map<number, Map<number, IExtendedAttrs>>();

  private _cellScratchPtr: number;

  constructor(cols: number, rows: number, maxRows: number) {
    this._wasm = GhosttyWasmRuntime.getInstanceSync();
    this._cols = cols;
    this._rows = rows;
    this._maxRows = maxRows;

    this._handle = this._wasm.ghostty_xterm_buffer_new(cols, rows, maxRows);
    if (!this._handle) {
      throw new Error('Failed to allocate Ghostty xterm buffer');
    }

    this._cellScratchPtr = this._wasm.ghostty_wasm_alloc_u8_array(CELL_STRIDE * 4);
    if (!this._cellScratchPtr) {
      this._wasm.ghostty_xterm_buffer_free(this._handle);
      this._handle = 0;
      throw new Error('Failed to allocate Ghostty cell scratch buffer');
    }
  }

  public dispose(): void {
    if (this._handle) {
      this._wasm.ghostty_xterm_buffer_free(this._handle);
      this._handle = 0;
    }
    if (this._cellScratchPtr) {
      this._wasm.ghostty_wasm_free_u8_array(this._cellScratchPtr, CELL_STRIDE * 4);
      this._cellScratchPtr = 0;
    }
  }

  public get cols(): number {
    return this._cols;
  }

  public get rows(): number {
    return this._rows;
  }

  public get maxRows(): number {
    return this._maxRows;
  }

  public resize(cols: number, rows: number, maxRows: number): void {
    const oldCols = this._cols;
    if (!this._wasm.ghostty_xterm_buffer_resize(this._handle, cols, rows, maxRows)) {
      throw new Error('Failed to resize Ghostty xterm buffer');
    }
    this._cols = cols;
    this._rows = rows;
    this._maxRows = maxRows;

    if (cols < oldCols) {
      for (const [row, rowMap] of this._combined) {
        for (const col of rowMap.keys()) {
          if (col >= cols) {
            rowMap.delete(col);
          }
        }
        if (rowMap.size === 0) {
          this._combined.delete(row);
        }
      }
      for (const [row, rowMap] of this._extended) {
        for (const col of rowMap.keys()) {
          if (col >= cols) {
            rowMap.delete(col);
          }
        }
        if (rowMap.size === 0) {
          this._extended.delete(row);
        }
      }
    }
  }

  public clear(): void {
    this._wasm.ghostty_xterm_buffer_clear(this._handle);
    this._combined.clear();
    this._extended.clear();
  }

  public getCell(row: number, col: number): [number, number, number] {
    this._wasm.ghostty_xterm_buffer_get_cell(this._handle, row, col, this._cellScratchPtr);
    const view = new DataView(this._wasm.memory.buffer, this._cellScratchPtr, CELL_STRIDE * 4);
    const content = view.getUint32(0, true);
    const fg = view.getUint32(4, true);
    const bg = view.getUint32(8, true);
    return [content, fg, bg];
  }

  public setCell(row: number, col: number, content: number, fg: number, bg: number): void {
    this._wasm.ghostty_xterm_buffer_set_cell(this._handle, row, col, content, fg, bg);
  }

  public clearRow(row: number, content: number, fg: number, bg: number): void {
    this._wasm.ghostty_xterm_buffer_clear_row(this._handle, row, content, fg, bg);
    this._combined.delete(row);
    this._extended.delete(row);
  }

  public copyRow(srcRow: number, dstRow: number): void {
    this._wasm.ghostty_xterm_buffer_copy_row(this._handle, srcRow, dstRow);
    const combined = this._combined.get(srcRow);
    if (combined) {
      this._combined.set(dstRow, new Map(combined));
    } else {
      this._combined.delete(dstRow);
    }
    const extended = this._extended.get(srcRow);
    if (extended) {
      this._extended.set(dstRow, new Map(extended));
    } else {
      this._extended.delete(dstRow);
    }
  }

  public getRowWrap(row: number): boolean {
    return this._wasm.ghostty_xterm_buffer_get_row_wrap(this._handle, row) !== 0;
  }

  public setRowWrap(row: number, wrap: boolean): void {
    this._wasm.ghostty_xterm_buffer_set_row_wrap(this._handle, row, wrap ? 1 : 0);
  }

  public getCombined(row: number, col: number): string | undefined {
    return this._combined.get(row)?.get(col);
  }

  public setCombined(row: number, col: number, data: string): void {
    let rowMap = this._combined.get(row);
    if (!rowMap) {
      rowMap = new Map();
      this._combined.set(row, rowMap);
    }
    rowMap.set(col, data);
  }

  public clearCombined(row: number, col: number): void {
    const rowMap = this._combined.get(row);
    if (!rowMap) {
      return;
    }
    rowMap.delete(col);
    if (rowMap.size === 0) {
      this._combined.delete(row);
    }
  }

  public getExtended(row: number, col: number): IExtendedAttrs | undefined {
    return this._extended.get(row)?.get(col);
  }

  public getExtendedRow(row: number): Map<number, IExtendedAttrs> | undefined {
    return this._extended.get(row);
  }

  public setExtended(row: number, col: number, data: IExtendedAttrs): void {
    let rowMap = this._extended.get(row);
    if (!rowMap) {
      rowMap = new Map();
      this._extended.set(row, rowMap);
    }
    rowMap.set(col, data);
  }

  public clearExtended(row: number, col: number): void {
    const rowMap = this._extended.get(row);
    if (!rowMap) {
      return;
    }
    rowMap.delete(col);
    if (rowMap.size === 0) {
      this._extended.delete(row);
    }
  }
}
