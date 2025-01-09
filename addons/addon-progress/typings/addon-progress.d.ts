/**
 * Copyright (c) 2024 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import { Terminal, ITerminalAddon, IDisposable } from '@xterm/xterm';
import type { Event } from 'vs/base/common/event';
import type { ProgressState } from '../src/ProgressAddon';

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
    public readonly onChange: Event<IProgress> | undefined;

    /**
     * Gets or sets the current progress tracked by the addon.
     */
    public progress: IProgress;
  }
  
  /**
   * Progress tracked by the addon.
   */
  export interface IProgress {
    state: ProgressState;
    value: number;
  }
}
