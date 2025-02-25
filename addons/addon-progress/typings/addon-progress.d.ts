/**
 * Copyright (c) 2024 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import { Terminal, ITerminalAddon, IDisposable, IEvent } from '@xterm/xterm';

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
    public readonly onChange: IEvent<IProgressState>;

    /**
     * Gets or sets the current progress tracked by the addon. This can be used
     * to reset a stuck progress indicator back to initial with
     * `{ state: 0, value: 0 }` or to restore an indicator.
     */
    public progress: IProgressState;
  }

  /**
   * Progress state tracked by the addon.
   */
  export interface IProgressState {
    /**
     * The progress state.
     *
     * - `0`: No progress. Setting this will resets progress value to 0
     *   regardless of the {@link value} used.
     * - `1`: Normal percentage-based from 0 to 100.
     * - `2`: Error with an optional progress value from 0 to 100.
     * - `3`: Indeterminate progress, any progress value will be ignored. This
     *   is used to indicate work is happening but a percentage value cannot be
     *   determined.
     * - `4`: Pause or warning state with an optional progress value.
     */
    state: 0 | 1 | 2 | 3 | 4;

    /**
     * The percentage value of progress from 0 to 100. See {@link state} for
     * whether this is relevant.
     */
    value: number;
  }
}
