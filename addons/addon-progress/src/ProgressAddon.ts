/**
 * Copyright (c) 2024 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import type { Terminal, ITerminalAddon } from '@xterm/xterm';
import type { ProgressAddon as IProgressApi, IProgress } from '@xterm/addon-progress';
import { Emitter } from 'vs/base/common/event';
import { Disposable } from 'vs/base/common/lifecycle';


export const enum ProgressState {
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


export class ProgressAddon extends Disposable implements ITerminalAddon, IProgressApi {
  private _st: ProgressState = ProgressState.REMOVE;
  private _pr = 0;
  private readonly _onChange = this._register(new Emitter<IProgress>());
  public readonly onChange = this._onChange.event;

  public activate(terminal: Terminal): void {
    this._register(terminal.parser.registerOscHandler(9, data => {
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
    }));
  }

  public get progress(): IProgress {
    return { state: this._st, value: this._pr };
  }

  public set progress(progress: IProgress) {
    if (progress.state < 0 || progress.state > 4) {
      console.warn(`progress state out of bounds, not applied`);
      return;
    }
    this._st = progress.state;
    this._pr = Math.min(Math.max(progress.value, 0), 100);
    this._onChange.fire({ state: this._st, value: this._pr });
  }
}
