/**
 * Copyright (c) 2026 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import { assert } from 'chai';
import type { IProgramStatusRecord } from '@xterm/addon-program-status';
import { DisposableStore } from 'common/Lifecycle';
import { Terminal } from 'headless/public/Terminal';
import { ProgramStatusAddon } from './ProgramStatusAddon';

const REPLY = '\x1b]7501;?\x1b\\';

function writeP(terminal: Terminal, data: string): Promise<void> {
  return new Promise(r => terminal.write(data, r));
}

function report(payload: string): string {
  return `\x1b]7501;${payload}\x1b\\`;
}

describe('ProgramStatusAddon', () => {
  let store: DisposableStore;
  let terminal: Terminal;
  let addon: ProgramStatusAddon;
  let changes: ReadonlyArray<IProgramStatusRecord>[];
  let replies: string[];

  beforeEach(() => {
    store = new DisposableStore();
    terminal = store.add(new Terminal({ cols: 80, rows: 24 }));
    addon = new ProgramStatusAddon();
    terminal.loadAddon(addon);
    changes = [];
    replies = [];
    store.add(addon.onChange(records => changes.push(records)));
    store.add(terminal.onData(data => replies.push(data)));
  });

  afterEach(() => {
    store.dispose();
  });

  it('keeps the records that programs report', async () => {
    await writeP(terminal, report(`state=working:app=cargo:msg=${btoa('Building')}`));
    assert.deepStrictEqual(addon.records, [
      { id: '', state: 'working', app: 'cargo', effectiveApp: 'cargo', message: 'Building' }
    ]);
    assert.strictEqual(changes.length, 1);
    assert.strictEqual(changes[0], addon.records);
  });

  it('accepts BEL as the terminator', async () => {
    await writeP(terminal, '\x1b]7501;state=done\x07');
    assert.deepStrictEqual(addon.records, [{ id: '', state: 'done' }]);
  });

  it('removes records with a clear report', async () => {
    await writeP(terminal, report('state=working:id=build') + report('state=working:id=build/test') + report('state=done:id=deploy'));
    await writeP(terminal, report('state=clear:id=build'));
    assert.deepStrictEqual(addon.records, [{ id: 'deploy', state: 'done' }]);
    assert.strictEqual(changes.length, 4);
  });

  it('fires nothing for a report that it rejects or that changes nothing', async () => {
    await writeP(terminal, report('state=paused') + report('state=clear:id=a//b') + report('state=clear:id=missing'));
    assert.deepStrictEqual(addon.records, []);
    assert.deepStrictEqual(changes, []);
  });

  it('answers the query with ST whichever terminator the query used', async () => {
    await writeP(terminal, '\x1b]7501;?\x1b\\\x1b]7501;?\x07');
    assert.deepStrictEqual(replies, [REPLY, REPLY]);
  });

  it('answers the query before a DA1 query that follows it', async () => {
    await writeP(terminal, '\x1b]7501;?\x1b\\\x1b[c');
    assert.deepStrictEqual(replies, [REPLY, '\x1b[?1;2c']);
  });

  it('answers only a query whose body is exactly ?', async () => {
    await writeP(terminal, '\x1b]7501; ?\x1b\\\x1b]7501;??\x1b\\');
    assert.deepStrictEqual(replies, []);
  });

  it('sends no reply while stdin is disabled', async () => {
    terminal.options.disableStdin = true;
    await writeP(terminal, '\x1b]7501;?\x1b\\');
    assert.deepStrictEqual(replies, []);
  });

  it('clears every record on RIS and still resets the terminal', async () => {
    await writeP(terminal, report('state=working') + 'hello');
    await writeP(terminal, '\x1bc');
    assert.deepStrictEqual(addon.records, []);
    assert.strictEqual(changes.length, 2);
    assert.strictEqual(terminal.buffer.active.getLine(0)?.translateToString(true), '');
    assert.strictEqual(terminal.buffer.active.cursorX, 0);
    await writeP(terminal, report('state=done'));
    assert.deepStrictEqual(addon.records, [{ id: '', state: 'done' }]);
  });

  it('keeps records through a soft reset and the alternate screen', async () => {
    await writeP(terminal, report('state=working'));
    await writeP(terminal, '\x1b[!p\x1b[?1049h' + report('state=blocked:id=pager') + '\x1b[?1049l');
    assert.deepStrictEqual(addon.records, [{ id: '', state: 'working' }, { id: 'pager', state: 'blocked' }]);
  });

  it('keeps records through terminal.reset() until the embedder clears them', async () => {
    await writeP(terminal, report('state=working'));
    terminal.reset();
    assert.strictEqual(addon.records.length, 1);
    addon.clear();
    assert.deepStrictEqual(addon.records, []);
    assert.strictEqual(changes.length, 2);
  });

  it('clears a record and its descendants', async () => {
    await writeP(terminal, report('state=working:id=a') + report('state=working:id=a/b') + report('state=working:id=ab'));
    addon.clear('a');
    assert.deepStrictEqual(addon.records.map(record => record.id), ['ab']);
    assert.strictEqual(changes.length, 4);
    addon.clear('a');
    assert.strictEqual(changes.length, 4);
  });

  for (const method of ['processExited', 'promptStarted'] as const) {
    it(`removes working and blocked records on ${method}()`, async () => {
      await writeP(terminal, ['working', 'blocked', 'done', 'error', 'idle'].map(state => report(`state=${state}:id=${state}`)).join(''));
      addon[method]();
      assert.deepStrictEqual(addon.records.map(record => record.id), ['done', 'error', 'idle']);
      assert.strictEqual(changes.length, 6);
      addon[method]();
      assert.strictEqual(changes.length, 6);
    });
  }

  it('drops its records and stops answering once disposed', async () => {
    await writeP(terminal, report('state=working'));
    addon.dispose();
    assert.deepStrictEqual(addon.records, []);
    await writeP(terminal, report('state=done') + '\x1b]7501;?\x1b\\');
    assert.deepStrictEqual(addon.records, []);
    assert.deepStrictEqual(replies, []);
    assert.strictEqual(changes.length, 1);
  });
});
