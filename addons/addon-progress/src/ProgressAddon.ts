/**
 * Copyright (c) 2024 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import type { Terminal, ITerminalAddon, IDisposable } from '@xterm/xterm';
import type { ProgressAddon as IProgressApi, IProgressState } from '@xterm/addon-progress';
import type { Emitter, Event } from 'vs/base/common/event';


const enum ProgressType {
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
  private _st: ProgressType = ProgressType.REMOVE;
  private _pr = 0;
  // HACK: This uses ! to align with the API, this should be fixed when 5283 is resolved
  private _onChange!: Emitter<IProgressState>;
  public onChange!: Event<IProgressState>;

  public dispose(): void {
    this._seqHandler?.dispose();
    this._onChange?.dispose();
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
        case ProgressType.REMOVE:
          this.progress = { state: st, value: 0 };
          break;
        case ProgressType.SET:
          if (pr < 0) return true;  // faulty sequence, just exit
          this.progress = { state: st, value: pr };
          break;
        case ProgressType.ERROR:
        case ProgressType.PAUSE:
          if (pr < 0) return true;  // faulty sequence, just exit
          this.progress = { state: st, value: pr || this._pr };
          break;
        case ProgressType.INDETERMINATE:
          this.progress = { state: st, value: this._pr };
          break;
      }
      return true;
    });
    // FIXME: borrow emitter ctor from xterm, to be changed once #5283 is resolved
    this._onChange = new (terminal as any)._core._onData.constructor();
    this.onChange = this._onChange!.event;
  }

  public get progress(): IProgressState {
    return { state: this._st, value: this._pr };
  }

  public set progress(progress: IProgressState) {
    if (progress.state < 0 || progress.state > 4) {
      console.warn(`progress state out of bounds, not applied`);
      return;
    }
    this._st = progress.state;
    this._pr = Math.min(Math.max(progress.value, 0), 100);
    this._onChange?.fire({ state: this._st, value: this._pr });
  }
}
