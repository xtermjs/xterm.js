/**
 * Copyright (c) 2026 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import { assert } from 'chai';
import type { IProgramStatusRecord } from '@xterm/addon-program-status';
import { ProgramStatusStore } from './ProgramStatusStore';

function record(id: string, state: IProgramStatusRecord['state'], app?: string): IProgramStatusRecord {
  return Object.freeze(app === undefined ? { id, state } : { id, state, app });
}

function storeOf(...records: IProgramStatusRecord[]): ProgramStatusStore {
  const store = new ProgramStatusStore();
  for (const r of records) {
    store.set(r);
  }
  return store;
}

function idsOf(store: ProgramStatusStore): string[] {
  return store.records.map(r => r.id);
}

describe('ProgramStatusStore', () => {
  describe('set', () => {
    it('replaces the whole record with the same id', () => {
      const store = storeOf(Object.freeze({ id: 'us-east', state: 'working', progress: 40, title: 'US East' }));
      store.set(record('us-east', 'done'));
      assert.deepStrictEqual(store.records, [{ id: 'us-east', state: 'done' }]);
    });

    it('lists records from the least to the most recently updated', () => {
      const store = storeOf(record('us-east', 'working'), record('eu-west', 'working'), record('ap-south', 'working'));
      store.set(record('us-east', 'done'));
      assert.deepStrictEqual(idsOf(store), ['eu-west', 'ap-south', 'us-east']);
    });

    it('deletes the least recently updated record to make room for a new id', () => {
      const store = new ProgramStatusStore();
      for (let i = 0; i < 256; i++) {
        store.set(record(`host-${i}`, 'idle'));
      }
      store.set(record('host-0', 'done'));
      store.set(record('host-256', 'working'));
      const ids = idsOf(store);
      assert.strictEqual(ids.length, 256);
      assert.notInclude(ids, 'host-1');
      assert.deepStrictEqual(ids.slice(-2), ['host-0', 'host-256']);
    });

    it('updates an id it holds without deleting anything when full', () => {
      const store = new ProgramStatusStore();
      for (let i = 0; i < 256; i++) {
        store.set(record(`host-${i}`, 'idle'));
      }
      store.set(record('host-100', 'error'));
      const ids = idsOf(store);
      assert.strictEqual(ids.length, 256);
      assert.strictEqual(ids[0], 'host-0');
      assert.strictEqual(ids[255], 'host-100');
    });
  });

  describe('deleteSubtree', () => {
    it('deletes a record and every record beneath it', () => {
      const store = storeOf(record('deploy/eu-west/canary', 'working'), record('deploy', 'working'), record('deploy/eu-westish', 'done'), record('deploy/eu-west', 'blocked'), record('deploy/us-east', 'working'));
      assert.isTrue(store.deleteSubtree('deploy/eu-west'));
      assert.deepStrictEqual(idsOf(store), ['deploy', 'deploy/eu-westish', 'deploy/us-east']);
    });

    it('deletes the records beneath an id it does not hold', () => {
      const store = storeOf(record('deploy/us-east', 'done'), record('deploy/eu-west', 'blocked'), record('backup', 'working'));
      assert.isTrue(store.deleteSubtree('deploy'));
      assert.deepStrictEqual(idsOf(store), ['backup']);
    });

    it('deletes every record for the root id', () => {
      const store = storeOf(record('', 'idle'), record('deploy', 'working'), record('backup/nightly', 'done'));
      assert.isTrue(store.deleteSubtree(''));
      assert.deepStrictEqual(store.records, []);
    });

    it('returns false when nothing matches', () => {
      const store = new ProgramStatusStore();
      assert.isFalse(store.deleteSubtree(''));
      store.set(record('deploy', 'done'));
      assert.isFalse(store.deleteSubtree('backup'));
      assert.isFalse(store.deleteSubtree('dep'));
      assert.deepStrictEqual(idsOf(store), ['deploy']);
    });
  });

  describe('deleteWorkingAndBlocked', () => {
    it('deletes working and blocked records only', () => {
      const store = storeOf(record('us-east', 'working'), record('eu-west', 'blocked'), record('ap-south', 'done'), record('sa-east', 'error'), record('', 'idle'));
      assert.isTrue(store.deleteWorkingAndBlocked());
      assert.deepStrictEqual(idsOf(store), ['ap-south', 'sa-east', '']);
      assert.isFalse(store.deleteWorkingAndBlocked());
    });
  });

  describe('effectiveApp', () => {
    it('is the record\'s own app when it has one', () => {
      const store = storeOf(record('', 'working', 'deploy'), record('eu-west', 'blocked', 'kubectl'));
      assert.strictEqual(store.records[1].effectiveApp, 'kubectl');
    });

    it('comes from the closest record above that has an app', () => {
      const store = storeOf(record('', 'working', 'deploy'), record('eu-west', 'working', 'helm'), record('eu-west/canary/pod-1', 'working'), record('us-east', 'working'));
      assert.deepStrictEqual(store.records.map(r => r.effectiveApp), ['deploy', 'helm', 'helm', 'deploy']);
    });

    it('is left out when no record above has an app', () => {
      const store = storeOf(record('', 'idle'), record('backup/nightly', 'done'));
      assert.deepStrictEqual(store.records, [{ id: '', state: 'idle' }, { id: 'backup/nightly', state: 'done' }]);
    });

    it('follows changes to the records above', () => {
      const store = storeOf(record('', 'working', 'deploy'), record('eu-west', 'working'));
      assert.strictEqual(store.records[1].effectiveApp, 'deploy');
      store.set(record('', 'working', 'terraform'));
      assert.strictEqual(store.records[0].effectiveApp, 'terraform');
      store.set(record('', 'working'));
      assert.deepStrictEqual(store.records, [{ id: 'eu-west', state: 'working' }, { id: '', state: 'working' }]);
    });

    it('comes after the record\'s own properties', () => {
      const store = storeOf(record('', 'working', 'deploy'), Object.freeze({ id: 'eu-west', state: 'blocked', kind: 'permission', title: 'EU West' }));
      assert.deepStrictEqual(Object.keys(store.records[1]), ['id', 'state', 'kind', 'title', 'effectiveApp']);
    });
  });

  describe('records', () => {
    it('returns the same frozen array until a record changes', () => {
      const store = storeOf(record('', 'working', 'deploy'), record('us-east', 'working'));
      const records = store.records;
      assert.isTrue(Object.isFrozen(records));
      assert.isTrue(Object.isFrozen(records[1]));
      assert.strictEqual(store.records, records);
      store.deleteSubtree('eu-west');
      assert.strictEqual(store.records, records);
      store.deleteWorkingAndBlocked();
      const empty = store.records;
      assert.notStrictEqual(empty, records);
      store.deleteSubtree('');
      assert.strictEqual(store.records, empty);
    });
  });
});
