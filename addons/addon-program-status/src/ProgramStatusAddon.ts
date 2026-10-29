/**
 * Copyright (c) 2026 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import type { Terminal, ITerminalAddon } from '@xterm/xterm';
import type { ProgramStatusAddon as IProgramStatusApi, IProgramStatusRecord } from '@xterm/addon-program-status';
import { Emitter } from 'common/Event';
import { Disposable } from 'common/Lifecycle';
import { parseProgramStatusReport } from './ProgramStatusParser';
import { ProgramStatusStore } from './ProgramStatusStore';

const enum Constants {
  OSC_IDENT = 7501,
  // Handlers do not learn whether BEL or ST ended the query, so the reply always ends with ST.
  REPLY = '\x1b]7501;?\x1b\\'
}

/**
 * @vt: #E[Supported via @xterm/addon-program-status.] OSC 7501  "Program Status"  "OSC 7501 ; Pt BEL"  "Report what a program is doing, or query support with `?`."
 *
 * See [addon readme](https://github.com/xtermjs/xterm.js/tree/master/addons/addon-program-status) for more details.
 */
export class ProgramStatusAddon extends Disposable implements ITerminalAddon, IProgramStatusApi {
  private readonly _recordStore = new ProgramStatusStore();

  private readonly _onChange = this._register(new Emitter<ReadonlyArray<IProgramStatusRecord>>());
  public readonly onChange = this._onChange.event;

  public get records(): ReadonlyArray<IProgramStatusRecord> {
    return this._recordStore.records;
  }

  public activate(terminal: Terminal): void {
    this._register(terminal.parser.registerOscHandler(Constants.OSC_IDENT, data => {
      if (data === '?') {
        // Reply before the parser moves on, so the reply precedes core's reply to a following
        // query such as DA1.
        terminal.input(Constants.REPLY, false);
        return true;
      }
      const report = parseProgramStatusReport(data);
      if (report?.state === 'clear') {
        this.clear(report.id);
      } else if (report) {
        this._recordStore.set(report);
        this._fireChange();
      }
      return true;
    }));
    // RIS removes every record. Returning false lets core run its full reset.
    this._register(terminal.parser.registerEscHandler({ final: 'c' }, () => {
      this.clear();
      return false;
    }));
  }

  public dispose(): void {
    this._recordStore.deleteSubtree('');
    super.dispose();
  }

  public clear(id: string = ''): void {
    if (this._recordStore.deleteSubtree(id)) {
      this._fireChange();
    }
  }

  public processExited(): void {
    if (this._recordStore.deleteWorkingAndBlocked()) {
      this._fireChange();
    }
  }

  public promptStarted(): void {
    if (this._recordStore.deleteWorkingAndBlocked()) {
      this._fireChange();
    }
  }

  private _fireChange(): void {
    this._onChange.fire(this._recordStore.records);
  }
}
