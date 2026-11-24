/**
 * Copyright (c) 2026 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import { assert } from 'chai';
import { parseProgramStatusReport } from './ProgramStatusParser';

function toBase64(text: string): string {
  return bytesToBase64(new TextEncoder().encode(text));
}

function bytesToBase64(bytes: ArrayLike<number>): string {
  return btoa(String.fromCharCode(...Array.from(bytes)));
}

/**
 * An id of segments with the given lengths, each segment a different letter.
 */
function idOfLengths(...lengths: number[]): string {
  return lengths.map((length, i) => 'abcdefgh'[i].repeat(length)).join('/');
}

describe('parseProgramStatusReport', () => {
  describe('examples from the spec', () => {
    it('reads the reports of one program', () => {
      assert.deepStrictEqual(parseProgramStatusReport('state=working:app=brew:msg=SW5zdGFsbGluZyB1cGRhdGVz'), {
        id: '', state: 'working', app: 'brew', message: 'Installing updates'
      });
      assert.deepStrictEqual(parseProgramStatusReport('state=blocked:kind=auth:app=brew:msg=UGFzc3dvcmQgcmVxdWlyZWQgdG8gaW5zdGFsbCB1cGRhdGVz'), {
        id: '', state: 'blocked', kind: 'auth', app: 'brew', message: 'Password required to install updates'
      });
      assert.deepStrictEqual(parseProgramStatusReport('state=done:app=brew:msg=VXBncmFkZWQgMTIgcGFja2FnZXM='), {
        id: '', state: 'done', app: 'brew', message: 'Upgraded 12 packages'
      });
    });

    it('reads the reports of several records', () => {
      assert.deepStrictEqual(parseProgramStatusReport('state=working:app=deploy:msg=RGVwbG95aW5nIHYyLjQuMQ=='), {
        id: '', state: 'working', app: 'deploy', message: 'Deploying v2.4.1'
      });
      assert.deepStrictEqual(parseProgramStatusReport('state=working:id=us-east:title=VVMgRWFzdA==:progress=40:msg=UHVzaGluZyBpbWFnZQ=='), {
        id: 'us-east', state: 'working', progress: 40, title: 'US East', message: 'Pushing image'
      });
      assert.deepStrictEqual(parseProgramStatusReport('state=blocked:kind=permission:id=eu-west:title=RVUgV2VzdA==:msg=QXBwcm92ZSBkZXBsb3kgdG8gZXUtd2VzdCAocHJvZHVjdGlvbik/'), {
        id: 'eu-west', state: 'blocked', kind: 'permission', title: 'EU West', message: 'Approve deploy to eu-west (production)?'
      });
      assert.deepStrictEqual(parseProgramStatusReport('state=done:id=us-east:title=VVMgRWFzdA==:msg=SGVhbHRoeQ=='), {
        id: 'us-east', state: 'done', title: 'US East', message: 'Healthy'
      });
      assert.deepStrictEqual(parseProgramStatusReport('state=clear:id=us-east'), { state: 'clear', id: 'us-east' });
    });

    it('reads the report from the introduction', () => {
      assert.deepStrictEqual(parseProgramStatusReport('state=blocked:kind=permission:app=terraform:msg=QXBwbHkgMyB0byBhZGQsIDEgdG8gY2hhbmdlLCAwIHRvIGRlc3Ryb3k/'), {
        id: '', state: 'blocked', kind: 'permission', app: 'terraform', message: 'Apply 3 to add, 1 to change, 0 to destroy?'
      });
    });
  });

  describe('pairs', () => {
    it('removes ASCII whitespace around keys and values', () => {
      assert.deepStrictEqual(parseProgramStatusReport('\tstate =blocked: kind= question\r\n:progress =\v75\f'), {
        id: '', state: 'blocked', kind: 'question', progress: 75
      });
    });

    it('keeps other spaces, which leave the pair malformed', () => {
      assert.deepStrictEqual(parseProgramStatusReport('state=done:\u00a0app=brew:msg=SGVhbHRoeQ==\u2003'), { id: '', state: 'done' });
    });

    it('skips malformed pairs and unknown keys', () => {
      assert.deepStrictEqual(parseProgramStatusReport('state=working:ready:=done:STATE=done:App=brew:app=my app:title=VVMg!:progress=12'), {
        id: '', state: 'working', progress: 12
      });
      assert.deepStrictEqual(parseProgramStatusReport(':state=done::color=red:priority=high:'), { id: '', state: 'done' });
    });

    it('takes the last readable value of a repeated key', () => {
      assert.deepStrictEqual(parseProgramStatusReport('progress=10:state=working:progress=20:app=npm:app=pnpm:progress=3 0'), {
        id: '', state: 'working', progress: 20, app: 'pnpm'
      });
      assert.deepStrictEqual(parseProgramStatusReport('state=working:state=work ing'), { id: '', state: 'working' });
      assert.strictEqual(parseProgramStatusReport('state=working:state=paused'), undefined);
    });

    it('checks every copy of a repeated key', () => {
      assert.strictEqual(parseProgramStatusReport('state=done:msg=Q:msg=SGVhbHRoeQ=='), undefined);
      assert.strictEqual(parseProgramStatusReport('state=done:id=us east:id=us-east'), undefined);
      assert.strictEqual(parseProgramStatusReport(`state=done:app=${'x'.repeat(33)}:app=brew`), undefined);
    });

    it('lists record properties in a fixed order', () => {
      const data = `msg=${toBase64('Which image tag?')}:title=${toBase64('US East')}:app=deploy:progress=75:kind=question:state=blocked:id=deploy/us-east`;
      assert.deepStrictEqual(Object.keys(parseProgramStatusReport(data)!), ['id', 'state', 'kind', 'progress', 'app', 'title', 'message']);
    });

    it('returns a frozen record', () => {
      assert.isTrue(Object.isFrozen(parseProgramStatusReport('state=idle')));
    });
  });

  describe('id', () => {
    it('reads the root record from a report without an id', () => {
      assert.deepStrictEqual(parseProgramStatusReport('state=idle'), { id: '', state: 'idle' });
    });

    it('accepts paths of up to eight segments', () => {
      for (const id of ['0/1/2/3/4/5/6/7', 'Z'.repeat(32), 'v2.4.1_rc+1-x']) {
        assert.deepStrictEqual(parseProgramStatusReport(`state=done:id=${id}`), { id, state: 'done' }, id);
      }
    });

    it('discards a report whose id breaks the id grammar', () => {
      const ids = ['us east', 'us-east,eu-west', 'us=east', 'caf\u00e9', 'Z'.repeat(33), 'us/' + 'Z'.repeat(33),
        '', ' ', '/us-east', 'us-east/', 'us//east', '0/1/2/3/4/5/6/7/8'];
      for (const id of ids) {
        assert.strictEqual(parseProgramStatusReport(`state=done:id=${id}`), undefined, id);
      }
    });
  });

  describe('state', () => {
    it('reads each state', () => {
      for (const state of ['idle', 'working', 'done', 'blocked', 'error'] as const) {
        assert.deepStrictEqual(parseProgramStatusReport(`state=${state}`), { id: '', state });
      }
    });

    it('discards a report without a known state', () => {
      for (const data of ['', 'id=us-east', 'state=', 'state=Done', 'state=finished', 'state=done,error', 'state=done:state=finished']) {
        assert.strictEqual(parseProgramStatusReport(data), undefined, data);
      }
    });

    it('reads a clear request', () => {
      assert.deepStrictEqual(parseProgramStatusReport('state=clear'), { state: 'clear', id: '' });
      assert.deepStrictEqual(parseProgramStatusReport('id=deploy/us-east:state=clear'), { state: 'clear', id: 'deploy/us-east' });
    });

    it('ignores the other keys of a clear request but still checks them', () => {
      assert.deepStrictEqual(parseProgramStatusReport('state=clear:id=eu-west:kind=permission:progress=10:app=deploy:title=RVUgV2VzdA=='), {
        state: 'clear', id: 'eu-west'
      });
      for (const data of ['state=clear:msg=Q', 'state=clear:id=us-east/', 'state=clear:id=', `state=clear:${'q'.repeat(17)}=1`]) {
        assert.strictEqual(parseProgramStatusReport(data), undefined, data);
      }
    });
  });

  describe('kind, progress and app', () => {
    it('keeps a known kind on blocked records only', () => {
      for (const kind of ['permission', 'question', 'auth'] as const) {
        assert.deepStrictEqual(parseProgramStatusReport(`state=blocked:kind=${kind}`), { id: '', state: 'blocked', kind });
      }
      assert.deepStrictEqual(parseProgramStatusReport('state=working:kind=auth'), { id: '', state: 'working' });
      assert.deepStrictEqual(parseProgramStatusReport('state=blocked:kind=login'), { id: '', state: 'blocked' });
    });

    it('reads progress from 0 to 100 on working and blocked records', () => {
      for (const [value, progress] of [['0', 0], ['100', 100], ['042', 42], ['0'.repeat(30) + '99', 99]] as const) {
        assert.deepStrictEqual(parseProgramStatusReport(`state=working:progress=${value}`), { id: '', state: 'working', progress }, value);
        assert.deepStrictEqual(parseProgramStatusReport(`state=blocked:progress=${value}`), { id: '', state: 'blocked', progress }, value);
      }
      for (const state of ['idle', 'done', 'error'] as const) {
        assert.deepStrictEqual(parseProgramStatusReport(`state=${state}:progress=50`), { id: '', state }, state);
      }
    });

    it('treats any other progress as absent', () => {
      for (const value of ['101', '1000', '-5', '4.5', '', '5%', '1e1', '0x1', '+7', '9'.repeat(30)]) {
        assert.deepStrictEqual(parseProgramStatusReport(`state=working:progress=${value}`), { id: '', state: 'working' }, value);
      }
    });

    it('keeps app only when it has the form of an id segment', () => {
      for (const app of ['brew', 'v2.4.1_rc+1-x', 'Z'.repeat(32)]) {
        assert.deepStrictEqual(parseProgramStatusReport(`state=idle:app=${app}`), { id: '', state: 'idle', app }, app);
      }
      for (const app of ['', 'brew/cask', 'brew,cask', 'brew=1']) {
        assert.deepStrictEqual(parseProgramStatusReport(`state=idle:app=${app}`), { id: '', state: 'idle' }, app);
      }
    });
  });

  describe('msg and title', () => {
    it('decodes base64 with or without padding', () => {
      for (const [value, message] of [['SGk=', 'Hi'], ['SGk', 'Hi'], ['SGV5', 'Hey'], ['SA==', 'H'], ['SA', 'H']]) {
        assert.deepStrictEqual(parseProgramStatusReport(`state=done:msg=${value}`), { id: '', state: 'done', message }, value);
      }
      assert.deepStrictEqual(parseProgramStatusReport('state=done:title=SGk'), { id: '', state: 'done', title: 'Hi' });
    });

    it('discards a report whose text is not base64', () => {
      for (const value of ['SGVs_G8', 'SGVs-G8', 'SGVs.G8', 'SGVs,G8', 'SGVsb', 'SGVsbA=', 'SGVsb===', 'SGVsbG8h=', 'SG==bG8']) {
        assert.strictEqual(parseProgramStatusReport(`state=done:msg=${value}`), undefined, value);
      }
    });

    it('discards a report whose text is not the canonical encoding', () => {
      for (const value of ['SB', 'SC', 'SE', 'SI', 'SB==', 'SGl', 'SGm', 'SGl=']) {
        assert.strictEqual(parseProgramStatusReport(`state=done:msg=${value}`), undefined, value);
      }
    });

    it('discards a report whose text is not UTF-8', () => {
      for (const bytes of [[0xE2, 0x82], [0xF8, 0x88, 0x80, 0x80, 0x80], [0xC1, 0xBF], [0xED, 0xBF, 0xBF], [0x80]]) {
        assert.strictEqual(parseProgramStatusReport(`state=done:msg=${bytesToBase64(bytes)}`), undefined, bytes.join());
      }
    });

    it('discards a report whose text has control characters', () => {
      for (const text of ['\x01', '\x1f', 'tab\there', 'ok\r', '\x1b]0;x\x07', '\x7f', '\u0080', '\u009f']) {
        assert.strictEqual(parseProgramStatusReport(`state=done:title=${toBase64(text)}`), undefined, JSON.stringify(text));
      }
    });

    it('keeps other characters, which hosts must make safe', () => {
      for (const text of ['\u202ereversed', '\u2066isolate\u2069', 'zero\u200bwidth', '\u00a0', 'caf\u00e9', '\u{1F680}', '\ufeffBOM']) {
        assert.deepStrictEqual(parseProgramStatusReport(`state=done:msg=${toBase64(text)}`), { id: '', state: 'done', message: text }, JSON.stringify(text));
      }
    });
  });

  describe('limits', () => {
    it('accepts a payload of 4087 bytes and discards a longer one', () => {
      const prefix = 'state=idle:x=';
      for (const [fill, extra] of [['y'.repeat(4074), 'y'], ['\u00e9'.repeat(2037), 'y'], ['\u20ac'.repeat(1358), 'y'], ['\u{1F680}'.repeat(1018) + 'yy', 'y']]) {
        assert.deepStrictEqual(parseProgramStatusReport(prefix + fill), { id: '', state: 'idle' });
        assert.strictEqual(parseProgramStatusReport(prefix + fill + extra), undefined);
      }
    });

    it('accepts an id of 128 bytes and discards a longer one', () => {
      const id = idOfLengths(32, 32, 32, 29);
      assert.deepStrictEqual(parseProgramStatusReport(`state=done:id=${id}`), { id, state: 'done' });
      assert.strictEqual(parseProgramStatusReport(`state=done:id=${idOfLengths(32, 32, 32, 30)}`), undefined);
    });

    it('applies the key limit to keys it skips, after removing whitespace', () => {
      assert.deepStrictEqual(parseProgramStatusReport(`state=idle:${'q'.repeat(16)}=1`), { id: '', state: 'idle' });
      assert.deepStrictEqual(parseProgramStatusReport(`state=idle:${'\u00fc'.repeat(8)}=1`), { id: '', state: 'idle' });
      assert.deepStrictEqual(parseProgramStatusReport(`state=idle:${' '.repeat(20)}app = brew`), { id: '', state: 'idle', app: 'brew' });
      for (const key of ['q'.repeat(17), 'Q'.repeat(17), '\u00fc'.repeat(9)]) {
        assert.strictEqual(parseProgramStatusReport(`state=idle:${key}=1`), undefined, key);
      }
    });

    it('discards a report with a value over its encoded limit, even a value it would skip', () => {
      for (const [key, limit] of [['msg', 2732], ['title', 256], ['app', 32]] as const) {
        assert.strictEqual(parseProgramStatusReport(`state=idle:${key}=${'~'.repeat(limit + 1)}`), undefined, key);
        assert.deepStrictEqual(parseProgramStatusReport(`state=idle:${key}=${'~'.repeat(limit)}`), { id: '', state: 'idle' }, key);
        // The limit counts UTF-8 bytes, and ü takes two.
        assert.strictEqual(parseProgramStatusReport(`state=idle:${key}=${'\u00fc'.repeat(limit / 2)}~`), undefined, key);
        assert.deepStrictEqual(parseProgramStatusReport(`state=idle:${key}=${'\u00fc'.repeat(limit / 2)}`), { id: '', state: 'idle' }, key);
      }
      assert.strictEqual(parseProgramStatusReport(`state=idle:msg=${'SGVs'.repeat(684)}`), undefined);
      assert.strictEqual(parseProgramStatusReport(`state=idle:app=${'x'.repeat(33)}`), undefined);
    });

    it('checks the decoded size of msg and title', () => {
      const ascii = '0123456789abcdef'.repeat(128);
      assert.deepStrictEqual(parseProgramStatusReport(`state=idle:msg=${toBase64(ascii)}`), { id: '', state: 'idle', message: ascii });
      assert.strictEqual(parseProgramStatusReport(`state=idle:msg=${toBase64(ascii + '!')}`), undefined);
      const accented = '\u00e9'.repeat(1024);
      assert.deepStrictEqual(parseProgramStatusReport(`state=idle:msg=${toBase64(accented)}`), { id: '', state: 'idle', message: accented });
      assert.strictEqual(parseProgramStatusReport(`state=idle:msg=${toBase64(accented + 'x')}`), undefined);
      const title = 'abc'.repeat(64);
      assert.deepStrictEqual(parseProgramStatusReport(`state=idle:title=${toBase64(title)}`), { id: '', state: 'idle', title });
    });
  });
});
