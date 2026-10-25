/**
 * Copyright (c) 2026 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import { assert } from 'chai';
import { parseProgramStatusReport, ProgramStatusStore } from './ProgramStatus';

function encodeBytes(bytes: ArrayLike<number>): string {
  return btoa(String.fromCharCode(...Array.from(bytes)));
}

function encode(text: string): string {
  return encodeBytes(new TextEncoder().encode(text));
}

describe('parseProgramStatusReport', () => {
  describe('records', () => {
    it('reads every key', () => {
      const data = `state=blocked:kind=permission:progress=40:app=terraform:id=deploy/eu-west:title=${encode('EU West')}:msg=${encode('Approve deploy?')}`;
      assert.deepStrictEqual(parseProgramStatusReport(data), {
        clear: false,
        record: {
          id: 'deploy/eu-west',
          state: 'blocked',
          kind: 'permission',
          progress: 40,
          app: 'terraform',
          title: 'EU West',
          message: 'Approve deploy?'
        }
      });
    });

    it('reads the root record from a report without an id', () => {
      assert.deepStrictEqual(parseProgramStatusReport('state=working'), {
        clear: false,
        record: { id: '', state: 'working' }
      });
    });

    it('reads the example from the specification', () => {
      const data = 'state=blocked:kind=permission:app=terraform:msg=QXBwbHkgMyB0byBhZGQsIDEgdG8gY2hhbmdlLCAwIHRvIGRlc3Ryb3k/';
      assert.deepStrictEqual(parseProgramStatusReport(data), {
        clear: false,
        record: {
          id: '',
          state: 'blocked',
          kind: 'permission',
          app: 'terraform',
          message: 'Apply 3 to add, 1 to change, 0 to destroy?'
        }
      });
    });

    it('trims whitespace around keys and values', () => {
      assert.deepStrictEqual(parseProgramStatusReport(' state = working :\t app\t=\r\ncargo\v:\fprogress= 5 '), {
        clear: false,
        record: { id: '', state: 'working', progress: 5, app: 'cargo' }
      });
    });

    it('keeps the last value of a repeated key', () => {
      assert.deepStrictEqual(parseProgramStatusReport('state=working:app=first:state=done:app=second'), {
        clear: false,
        record: { id: '', state: 'done', app: 'second' }
      });
    });

    it('skips pairs that it cannot read', () => {
      assert.deepStrictEqual(parseProgramStatusReport('state=working:noequals:=value:App=cargo:app=a b:msg=ab~:progress=50'), {
        clear: false,
        record: { id: '', state: 'working', progress: 50 }
      });
    });

    it('ignores unknown keys and empty pairs', () => {
      assert.deepStrictEqual(parseProgramStatusReport('state=idle::future=1:x=y:'), {
        clear: false,
        record: { id: '', state: 'idle' }
      });
    });
  });

  describe('state', () => {
    it('rejects a report without a valid state', () => {
      for (const data of ['', 'app=cargo', 'state=paused', 'state=', 'state=Working', 'state=working,done']) {
        assert.strictEqual(parseProgramStatusReport(data), undefined, data);
      }
    });

    it('keeps kind only for a blocked record', () => {
      assert.deepStrictEqual(parseProgramStatusReport('state=blocked:kind=question'), {
        clear: false,
        record: { id: '', state: 'blocked', kind: 'question' }
      });
      assert.deepStrictEqual(parseProgramStatusReport('state=working:kind=question'), {
        clear: false,
        record: { id: '', state: 'working' }
      });
      assert.deepStrictEqual(parseProgramStatusReport('state=blocked:kind=payment'), {
        clear: false,
        record: { id: '', state: 'blocked' }
      });
    });

    it('keeps progress from 0 to 100 for a working or blocked record', () => {
      const progressOf = (data: string): number | undefined => {
        const report = parseProgramStatusReport(data);
        return report?.clear === false ? report.record.progress : undefined;
      };
      assert.strictEqual(progressOf('state=working:progress=0'), 0);
      assert.strictEqual(progressOf('state=blocked:progress=100'), 100);
      assert.strictEqual(progressOf('state=working:progress=007'), 7);
      assert.strictEqual(progressOf('state=done:progress=50'), undefined);
      assert.strictEqual(progressOf('state=idle:progress=50'), undefined);
      for (const progress of ['101', '-1', '1.5', '', '1e2', '0x10', '+5']) {
        assert.deepStrictEqual(parseProgramStatusReport(`state=working:progress=${progress}`), {
          clear: false,
          record: { id: '', state: 'working' }
        }, progress);
      }
    });

    it('keeps app only when it is one id segment', () => {
      for (const app of ['', 'a,b', 'a/b', 'a=b']) {
        assert.deepStrictEqual(parseProgramStatusReport(`state=idle:app=${app}`), {
          clear: false,
          record: { id: '', state: 'idle' }
        }, app);
      }
      assert.deepStrictEqual(parseProgramStatusReport(`state=idle:app=${'a'.repeat(32)}`), {
        clear: false,
        record: { id: '', state: 'idle', app: 'a'.repeat(32) }
      });
    });
  });

  describe('clear', () => {
    it('reads a clear report with or without an id', () => {
      assert.deepStrictEqual(parseProgramStatusReport('state=clear'), { clear: true, id: '' });
      assert.deepStrictEqual(parseProgramStatusReport('state=clear:id=build/test'), { clear: true, id: 'build/test' });
    });

    it('rejects a clear report with an invalid value', () => {
      assert.strictEqual(parseProgramStatusReport('state=clear:msg=a'), undefined);
      assert.strictEqual(parseProgramStatusReport('state=clear:id='), undefined);
      assert.strictEqual(parseProgramStatusReport('state=clear:id=a//b'), undefined);
    });
  });

  describe('limits', () => {
    it('accepts a payload of 4087 bytes and rejects one of 4088', () => {
      assert.ok(parseProgramStatusReport(`state=idle:pad=${'a'.repeat(4072)}`));
      assert.strictEqual(parseProgramStatusReport(`state=idle:pad=${'a'.repeat(4073)}`), undefined);
    });

    it('counts the payload in UTF-8 bytes', () => {
      assert.ok(parseProgramStatusReport(`state=idle:pad=${'\u00e9'.repeat(2036)}`));
      assert.strictEqual(parseProgramStatusReport(`state=idle:pad=${'\u00e9'.repeat(2037)}`), undefined);
      assert.ok(parseProgramStatusReport(`state=idle:pad=${'\u{1F600}'.repeat(1018)}`));
      assert.strictEqual(parseProgramStatusReport(`state=idle:pad=${'\u{1F600}'.repeat(1018)}a`), undefined);
    });

    it('rejects a report with a key longer than 16 bytes', () => {
      assert.ok(parseProgramStatusReport(`state=idle:${'k'.repeat(16)}=1`));
      assert.ok(parseProgramStatusReport(`state=idle:${'\u00e9'.repeat(8)}=1`));
      assert.strictEqual(parseProgramStatusReport(`state=idle:${'k'.repeat(17)}=1`), undefined);
      assert.strictEqual(parseProgramStatusReport(`state=idle:${'K'.repeat(17)}=1`), undefined);
      assert.strictEqual(parseProgramStatusReport(`state=idle:${'\u00e9'.repeat(9)}=1`), undefined);
    });

    it('rejects a report with a value over its encoded limit', () => {
      for (const pair of [
        `msg=${'A'.repeat(2733)}`,
        `msg=${'\u00e9'.repeat(1367)}`,
        `title=${'A'.repeat(257)}`,
        `app=${'a'.repeat(33)}`,
        `id=${['a'.repeat(32), 'a'.repeat(32), 'a'.repeat(32), 'a'.repeat(30)].join('/')}`
      ]) {
        assert.strictEqual(parseProgramStatusReport(`state=idle:${pair}`), undefined, pair);
      }
    });

    it('accepts values at their limits', () => {
      const id = ['a'.repeat(32), 'a'.repeat(32), 'a'.repeat(32), 'a'.repeat(29)].join('/');
      const title = 't'.repeat(192);
      const message = 'm'.repeat(2048);
      assert.deepStrictEqual(parseProgramStatusReport(`state=idle:id=${id}:title=${encode(title)}:msg=${encode(message)}`), {
        clear: false,
        record: { id, state: 'idle', title, message }
      });
    });

    it('skips a value within its encoded limit that has characters outside base64', () => {
      assert.deepStrictEqual(parseProgramStatusReport(`state=idle:msg=${'\u00e9'.repeat(1366)}`), {
        clear: false,
        record: { id: '', state: 'idle' }
      });
    });

    it('rejects a msg that decodes to more than 2048 bytes', () => {
      assert.strictEqual(parseProgramStatusReport(`state=idle:msg=${encode('m'.repeat(2049))}`), undefined);
    });
  });

  describe('text', () => {
    it('decodes base64 with or without padding', () => {
      for (const [msg, message] of [['QQ==', 'A'], ['QQ', 'A'], ['QUI=', 'AB'], ['QUI', 'AB'], ['QUJD', 'ABC']]) {
        assert.deepStrictEqual(parseProgramStatusReport(`state=idle:msg=${msg}`), {
          clear: false,
          record: { id: '', state: 'idle', message }
        }, msg);
      }
    });

    it('rejects malformed base64', () => {
      for (const msg of ['a', 'QQ=', 'QQ===', 'Q===', 'QR', 'Q=Q=', 'a_b-', 'QUJD=']) {
        assert.strictEqual(parseProgramStatusReport(`state=idle:msg=${msg}`), undefined, msg);
        assert.strictEqual(parseProgramStatusReport(`state=idle:title=${msg}`), undefined, msg);
      }
    });

    it('rejects text that is not UTF-8', () => {
      for (const bytes of [[0xC3, 0x28], [0xC0, 0xAF], [0xED, 0xA0, 0x80], [0xFF]]) {
        assert.strictEqual(parseProgramStatusReport(`state=idle:msg=${encodeBytes(bytes)}`), undefined, bytes.join());
      }
    });

    it('rejects text with control characters', () => {
      for (const text of ['\x00', '\x07', 'a\nb', '\t', '\x1b[31m', '\x7f', '\u0085', '\u009b']) {
        assert.strictEqual(parseProgramStatusReport(`state=idle:msg=${encode(text)}`), undefined, JSON.stringify(text));
      }
    });

    it('keeps other characters as they are', () => {
      for (const message of ['\u202eevil', '\ufeffhi', '\u{1F600}', 'na\u00efve', '\u200b']) {
        assert.deepStrictEqual(parseProgramStatusReport(`state=idle:msg=${encode(message)}`), {
          clear: false,
          record: { id: '', state: 'idle', message }
        }, JSON.stringify(message));
      }
    });
  });

  describe('id', () => {
    it('accepts ids of up to 8 segments of up to 32 characters', () => {
      for (const id of ['a/b/c/d/e/f/g/h', 'a'.repeat(32), 'A-z_0.9+x']) {
        assert.deepStrictEqual(parseProgramStatusReport(`state=idle:id=${id}`), {
          clear: false,
          record: { id, state: 'idle' }
        }, id);
      }
    });

    it('rejects a report with a malformed id', () => {
      for (const id of ['', 'a//b', '/a', 'a/', 'a b', 'a/b/c/d/e/f/g/h/i', 'a'.repeat(33), 'a,b', 'a=b']) {
        assert.strictEqual(parseProgramStatusReport(`state=idle:id=${id}`), undefined, id);
      }
    });
  });
});

describe('ProgramStatusStore', () => {
  let store: ProgramStatusStore;

  beforeEach(() => {
    store = new ProgramStatusStore();
  });

  function ids(): string[] {
    return store.records.map(record => record.id);
  }

  it('replaces a record whole', () => {
    store.replace({ id: 'a', state: 'blocked', kind: 'permission', message: 'Allow?' });
    store.replace({ id: 'a', state: 'working' });
    assert.deepStrictEqual(store.records, [{ id: 'a', state: 'working' }]);
  });

  it('orders records from the oldest update to the newest', () => {
    store.replace({ id: 'a', state: 'working' });
    store.replace({ id: 'b', state: 'working' });
    store.replace({ id: 'a', state: 'done' });
    assert.deepStrictEqual(ids(), ['b', 'a']);
  });

  it('clears a record and its descendants', () => {
    for (const id of ['', 'build', 'build/test', 'build/test/unit', 'builder']) {
      store.replace({ id, state: 'working' });
    }
    assert.strictEqual(store.clear('build'), true);
    assert.deepStrictEqual(ids(), ['', 'builder']);
    assert.strictEqual(store.clear('build'), false);
  });

  it('clears every record for the empty id', () => {
    store.replace({ id: '', state: 'working' });
    store.replace({ id: 'a', state: 'working' });
    assert.strictEqual(store.clear(''), true);
    assert.deepStrictEqual(store.records, []);
    assert.strictEqual(store.clear(''), false);
  });

  it('removes working and blocked records', () => {
    store.replace({ id: 'a', state: 'idle' });
    store.replace({ id: 'b', state: 'working' });
    store.replace({ id: 'c', state: 'done' });
    store.replace({ id: 'd', state: 'blocked' });
    store.replace({ id: 'e', state: 'error' });
    assert.strictEqual(store.removeActiveRecords(), true);
    assert.deepStrictEqual(ids(), ['a', 'c', 'e']);
    assert.strictEqual(store.removeActiveRecords(), false);
  });

  it('evicts the least recently updated record when it holds 256', () => {
    for (let i = 0; i < 256; i++) {
      store.replace({ id: `r${i}`, state: 'idle' });
    }
    store.replace({ id: 'r0', state: 'done' });
    store.replace({ id: 'new', state: 'idle' });
    assert.strictEqual(ids().length, 256);
    assert.deepStrictEqual(ids().slice(0, 2), ['r2', 'r3']);
    assert.deepStrictEqual(ids().slice(-2), ['r0', 'new']);
  });

  it('evicts nothing when it updates a record that it holds', () => {
    for (let i = 0; i < 256; i++) {
      store.replace({ id: `r${i}`, state: 'idle' });
    }
    store.replace({ id: 'r100', state: 'done' });
    assert.strictEqual(ids().length, 256);
    assert.strictEqual(ids()[0], 'r0');
    assert.strictEqual(ids()[255], 'r100');
  });

  it('fills in effectiveApp from the record or its nearest ancestor', () => {
    store.replace({ id: '', state: 'idle', app: 'grok' });
    store.replace({ id: 'a', state: 'working', app: 'cargo' });
    store.replace({ id: 'a/b', state: 'working' });
    store.replace({ id: 'a/b/c', state: 'blocked' });
    store.replace({ id: 'x/y', state: 'done' });
    assert.deepStrictEqual(store.records.map(record => [record.id, record.effectiveApp]), [
      ['', 'grok'],
      ['a', 'cargo'],
      ['a/b', 'cargo'],
      ['a/b/c', 'cargo'],
      ['x/y', 'grok']
    ]);
  });

  it('leaves out effectiveApp when no record on the path has an app', () => {
    store.replace({ id: 'a/b', state: 'working' });
    assert.deepStrictEqual(store.records, [{ id: 'a/b', state: 'working' }]);
  });

  it('updates effectiveApp when an ancestor changes', () => {
    store.replace({ id: 'a', state: 'working', app: 'cargo' });
    store.replace({ id: 'a/b', state: 'working' });
    store.replace({ id: 'a', state: 'working', app: 'rustc' });
    assert.deepStrictEqual(store.records.map(record => [record.id, record.effectiveApp]), [['a/b', 'rustc'], ['a', 'rustc']]);
    store.replace({ id: 'a', state: 'done' });
    assert.deepStrictEqual(store.records.map(record => [record.id, record.effectiveApp]), [['a/b', undefined], ['a', undefined]]);
  });

  it('returns the same frozen list until the records change', () => {
    store.replace({ id: 'a', state: 'working', app: 'cargo' });
    const records = store.records;
    assert.ok(Object.isFrozen(records));
    assert.ok(Object.isFrozen(records[0]));
    assert.strictEqual(store.records, records);
    store.clear('missing');
    assert.strictEqual(store.records, records);
    store.replace({ id: 'b', state: 'working' });
    assert.notStrictEqual(store.records, records);
  });
});
