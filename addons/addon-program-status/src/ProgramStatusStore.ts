/**
 * Copyright (c) 2026 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import type { IProgramStatusRecord } from '@xterm/addon-program-status';

const enum Constants {
  MAX_RECORDS = 256
}

/**
 * The records of one terminal, one per id.
 */
export class ProgramStatusStore {
  // set() deletes an id before setting it again, and a Map iterates in insertion order, so the
  // first entry is the least recently updated record.
  private readonly _byId = new Map<string, IProgramStatusRecord>();
  private _records: ReadonlyArray<IProgramStatusRecord> | undefined;

  /**
   * The records, least recently updated first, with `effectiveApp` filled in. The same frozen
   * array comes back until a record changes.
   */
  public get records(): ReadonlyArray<IProgramStatusRecord> {
    if (this._records === undefined) {
      const records: IProgramStatusRecord[] = [];
      for (const record of this._byId.values()) {
        const effectiveApp = this._findApp(record.id);
        records.push(effectiveApp === undefined ? record : Object.freeze({ ...record, effectiveApp }));
      }
      this._records = Object.freeze(records);
    }
    return this._records;
  }

  /**
   * Stores a record in place of the one with the same id. When the store is full, a new id
   * pushes out the least recently updated record.
   */
  public set(record: IProgramStatusRecord): void {
    if (!this._byId.delete(record.id) && this._byId.size === Constants.MAX_RECORDS) {
      const [leastRecent] = this._byId.keys();
      this._byId.delete(leastRecent);
    }
    this._byId.set(record.id, record);
    this._records = undefined;
  }

  /**
   * Deletes the record at `id` and every record beneath it. The root id, `''`, covers them all.
   * @returns Whether a record was deleted.
   */
  public deleteSubtree(id: string): boolean {
    if (id === '') {
      if (this._byId.size === 0) {
        return false;
      }
      this._byId.clear();
      this._records = undefined;
      return true;
    }
    let deleted = this._byId.delete(id);
    const childPrefix = id + '/';
    for (const key of this._byId.keys()) {
      if (key.startsWith(childPrefix)) {
        this._byId.delete(key);
        deleted = true;
      }
    }
    if (deleted) {
      this._records = undefined;
    }
    return deleted;
  }

  /**
   * Deletes the `working` and `blocked` records, which go stale once the process exits or a new
   * prompt starts.
   * @returns Whether a record was deleted.
   */
  public deleteWorkingAndBlocked(): boolean {
    let deleted = false;
    for (const [id, record] of this._byId) {
      if (record.state === 'working' || record.state === 'blocked') {
        this._byId.delete(id);
        deleted = true;
      }
    }
    if (deleted) {
      this._records = undefined;
    }
    return deleted;
  }

  /**
   * The `app` of the record at `id` or, failing that, of the closest record above it that has one.
   */
  private _findApp(id: string): string | undefined {
    for (let end = id.length; end > 0; end = id.lastIndexOf('/', end - 1)) {
      const app = this._byId.get(id.slice(0, end))?.app;
      if (app !== undefined) {
        return app;
      }
    }
    return this._byId.get('')?.app;
  }
}
