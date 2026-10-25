/**
 * Copyright (c) 2026 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import { Terminal, ITerminalAddon, IDisposable, IEvent } from '@xterm/xterm';

declare module '@xterm/addon-program-status' {
  /**
   * An xterm.js addon that keeps the records that programs report through the
   * program status sequence, OSC 7501, and answers its feature detection query.
   *
   * Load it only where the records are shown: a terminal that answers the
   * query tells programs that their status is visible.
   */
  export class ProgramStatusAddon implements ITerminalAddon, IDisposable {

    /**
     * Creates a new program status addon.
     */
    constructor();

    /**
     * Activates the addon.
     * @param terminal The terminal the addon is being loaded in.
     */
    public activate(terminal: Terminal): void;

    /**
     * Disposes the addon. This removes its handlers and records without
     * firing {@link onChange}.
     */
    public dispose(): void;

    /**
     * The current records, from the oldest update to the newest.
     */
    public readonly records: ReadonlyArray<IProgramStatusRecord>;

    /**
     * An event that fires with the full list of records after any change.
     */
    public readonly onChange: IEvent<ReadonlyArray<IProgramStatusRecord>>;

    /**
     * Removes a record and its descendants.
     * @param id The record to remove. With no id, or the root record's empty
     * id, every record is removed.
     */
    public clear(id?: string): void;

    /**
     * Removes `working` and `blocked` records. Call this after the attached
     * process exits and its last output is parsed, for example in the
     * callback of `terminal.write('', callback)`.
     */
    public processExited(): void;

    /**
     * Removes `working` and `blocked` records. Call this when a new top-level
     * shell prompt starts, not for repaints, right or continuation prompts, or
     * prompt marks inside a running command.
     */
    public promptStarted(): void;
  }

  /**
   * One record, as the last report with its id described it.
   *
   * The text is untrusted. It has no control characters, but it can contain
   * text direction overrides and invisible formatting characters, which an
   * embedder should remove before it shows the text outside the terminal.
   */
  export interface IProgramStatusRecord {
    /**
     * The record's path, segments joined by `/`. An empty string identifies
     * the root record.
     */
    readonly id: string;

    /**
     * What the program is doing.
     *
     * - `idle`: At rest, waiting for the user's next instruction.
     * - `working`: Running.
     * - `done`: Finished a piece of work that the user has not seen yet.
     * - `blocked`: Cannot continue until the user does something.
     * - `error`: Failed and stopped.
     */
    readonly state: 'idle' | 'working' | 'done' | 'blocked' | 'error';

    /**
     * What a `blocked` program needs from the user.
     */
    readonly kind?: 'permission' | 'question' | 'auth';

    /**
     * Progress from 0 to 100 for a `working` or `blocked` record.
     */
    readonly progress?: number;

    /**
     * The program name from this record's last report.
     */
    readonly app?: string;

    /**
     * The program name from this record or its nearest ancestor that has
     * one.
     */
    readonly effectiveApp?: string;

    /**
     * A short label, decoded from the report's `title`.
     */
    readonly title?: string;

    /**
     * One line about the record, decoded from the report's `msg`.
     */
    readonly message?: string;
  }
}
