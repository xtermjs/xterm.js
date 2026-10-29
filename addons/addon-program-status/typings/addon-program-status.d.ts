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
     * Every record the terminal holds, least recently updated first.
     */
    public readonly records: ReadonlyArray<IProgramStatusRecord>;

    /**
     * An event that fires with the full list of records after any change.
     */
    public readonly onChange: IEvent<ReadonlyArray<IProgramStatusRecord>>;

    /**
     * Deletes the record at `id` and every record beneath it, as a
     * `state=clear` report does.
     * @param id The id to clear. The default, the root record's empty id,
     * clears every record.
     */
    public clear(id?: string): void;

    /**
     * Tells the addon that the attached process has exited, which drops
     * `working` and `blocked` records. Call it once the process's final
     * output has been parsed, for example from the callback of
     * `terminal.write('', callback)`.
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
   * The status that the last report with this id gave. Each report replaces
   * its record whole, so nothing carries over from an earlier report.
   *
   * `title` and `message` come from the program and are untrusted. Reports
   * with control characters are refused, but bidirectional overrides and
   * invisible formatting characters can still appear. Strip them before the
   * text is shown anywhere outside the terminal.
   */
  export interface IProgramStatusRecord {
    /**
     * The id from the report, a path of segments joined by `/`, such as
     * `deploy/us-east`. Reports without an id address the root record, whose
     * id is the empty string.
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
     * What a `blocked` record is waiting for.
     *
     * - `permission`: Approval to do something.
     * - `question`: An answer the user has to type.
     * - `auth`: A login, token or credential.
     */
    readonly kind?: 'permission' | 'question' | 'auth';

    /**
     * Percent complete, 0 to 100, on a `working` or `blocked` record. Absent
     * means unknown.
     */
    readonly progress?: number;

    /**
     * The machine-readable name of the program, such as `cargo`, when the
     * record's report has one.
     */
    readonly app?: string;

    /**
     * `app` if the record has one. Otherwise the `app` of the closest record
     * above it in the id path that has one, which may be the root record.
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
