/**
 * Copyright (c) 2024 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import { Terminal, ITerminalAddon, IDisposable } from '@xterm/xterm';
import type { Event } from 'vs/base/common/event';


declare module '@xterm/addon-progress' {
  /**
   * An xterm.js addon that provides an interface for ConEmu's progress
   * sequence.
   */
  export class ProgressAddon implements ITerminalAddon, IDisposable {
    
    /**
     * Creates a new progress addon
     */
    constructor();

    /**
     * Activates the addon
     * @param terminal The terminal the addon is being loaded in.
     */
    public activate(terminal: Terminal): void;
    
    /**
     * Disposes the addon.
     */
    public dispose(): void;

    /**
     * An event that fires when the tracked progress changes.
     */
    public readonly onChange: Event<IProgressState> | undefined;

    /**
     * Gets or sets the current progress tracked by the addon.
     * This can also be used to reset a stuck progress indicator
     * back to initial with `{state: 0, value: 0}`
     * or to restore an indicator.
     */
    public progress: IProgressState;
  }
  
  /**
   * Progress state tracked by the addon.
   */
  export interface IProgressState {
    state: 0 | 1 | 2 | 3 | 4;
    value: number;
  }
}
