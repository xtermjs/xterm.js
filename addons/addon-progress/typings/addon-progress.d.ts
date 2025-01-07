/**
 * Copyright (c) 2024 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import { Terminal, ITerminalAddon, IDisposable } from '@xterm/xterm';
import type { Event } from 'vs/base/common/event';
import type { ProgressState } from '../src/ProgressAddon';

declare module '@xterm/addon-progress' {
  /** xterm.js addon providing an interface for ConEmu's progress sequence */
  export class ProgressAddon implements ITerminalAddon, IDisposable {
    constructor();
    public activate(terminal: Terminal): void;
    public dispose(): void;

    public readonly onChange: Event<IProgress> | undefined;

    /** getter / setter for current progress */
    public progress: IProgress;
  }
  
  /** progress object interface */
  export interface IProgress {
    state: ProgressState;
    value: number;
  }
}
