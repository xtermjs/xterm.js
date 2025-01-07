/**
 * Copyright (c) 2024 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import { Terminal, ITerminalAddon, IDisposable } from '@xterm/xterm';
import type { ProgressState } from '../src/ProgressAddon';

declare module '@xterm/addon-progress' {
  /** xterm.js addon providing an interface for ConEmu's progress sequence */
  export class ProgressAddon implements ITerminalAddon {
    constructor();
    public activate(terminal: Terminal): void;
    public dispose(): void;

    /** register progress handler */
    public register(handler: ProgressHandler): IDisposable;

    /** getter / setter for current progress */
    public progress: IProgress;
  }
  
  /** progress object interface */
  export interface IProgress {
    state: ProgressState;
    value: number;
  }
  
  /** Progress handler type */
  export type ProgressHandler = (state: ProgressState, value: number) => void;
}
