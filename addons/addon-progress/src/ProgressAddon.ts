/**
 * Copyright (c) 2024 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import type { Terminal, ITerminalAddon, IDisposable } from '@xterm/xterm';
import type { ProgressAddon as IProgressApi, IProgress, ProgressHandler } from '@xterm/addon-progress';


const enum ProgressState {
  REMOVE = 0,
  SET = 1,
  ERROR = 2,
  INDETERMINATE = 3,
  PAUSE = 4
}


/**
 * Strict integer parsing, only decimal digits allowed.
 */
function toInt(s: string): number {
  let v = 0;
  for (let i = 0; i < s.length; ++i) {
    const c = s.charCodeAt(i);
    if (c < 0x30 || 0x39 < c) {
      return -1;
    }
    v = v * 10 + c - 48;
  }
  return v;
}


export class ProgressAddon implements ITerminalAddon, IProgressApi {
  private _seqHandler: IDisposable | undefined;
  private _st: ProgressState = ProgressState.REMOVE;
  private _pr = 0;
  private _handlers: ProgressHandler[] = [];

  public dispose(): void {
    this._seqHandler?.dispose();
    this._handlers.length = 0;
  }

  public activate(terminal: Terminal): void {
    this._seqHandler = terminal.parser.registerOscHandler(9, data => {
      if (!data.startsWith('4;')) {
        return false;
      }
      const parts = data.split(';');

      if (parts.length > 3) {
        return true;  // faulty sequence, just exit
      }
      if (parts.length === 2) {
        parts.push('');
      }
      const st = toInt(parts[1]);
      const pr = toInt(parts[2]);

      switch (st) {
        case ProgressState.REMOVE:
          this.progress = { state: st, value: 0 };
          break;
        case ProgressState.SET:
          if (pr < 0) return true;  // faulty sequence, just exit
          this.progress = { state: st, value: pr };
          break;
        case ProgressState.ERROR:
        case ProgressState.PAUSE:
          if (pr < 0) return true;  // faulty sequence, just exit
          this.progress = { state: st, value: pr || this._pr };
          break;
        case ProgressState.INDETERMINATE:
          this.progress = { state: st, value: this._pr };
          break;
      }
      return true;
    });
  }

  public register(handler: ProgressHandler): IDisposable {
    const handlers = this._handlers;
    handlers.push(handler);
    return {
      dispose: () => {
        const idx = handlers.indexOf(handler);
        if (idx !== -1) {
          handlers.splice(idx, 1);
        }
      }
    };
  }

  public get progress(): IProgress {
    return { state: this._st, value: this._pr };
  }

  public set progress(progress: IProgress) {
    if (0 <= progress.state && progress.state <= 4)
    {
      this._st = progress.state;
      this._pr = Math.min(Math.max(progress.value, 0), 100);

      // call progress handlers
      for (let i = 0; i < this._handlers.length; ++i) {
        this._handlers[i](this._st, this._pr);
      }
    } else {
      console.warn(`progress state out of bounds, not applied`);
    }
  }
}
