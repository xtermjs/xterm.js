import { assert } from 'chai';
import { Base64Decoder } from './base64.wasm';

// eslint-disable-next-line
declare const Buffer: any;


// some helpers
function toBs(bytes: Uint8Array): string {
  let bs = '';
  for (let i = 0; i < bytes.length; ++i) bs += String.fromCharCode(bytes[i]);
  return bs;
}
function fromBs(bs: string): Uint8Array {
  const r = new Uint8Array(bs.length);
  for (let i = 0; i < r.length; ++i) r[i] = bs.charCodeAt(i);
  return r;
}
function encNative(bytes: Uint8Array): string {
  return typeof Buffer !== 'undefined' ? Buffer.from(bytes).toString('base64') : btoa(toBs(bytes));
}
function rtrim(x: string, c: string): string {
  let end = x.length - 1;
  while (c.indexOf(x[end]) >= 0) end -= 1;
  return x.slice(0, end + 1);
}
const MAP = new Uint8Array(
  'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'
    .split('')
    .map(el => el.charCodeAt(0))
);


describe('Base64Decoder', () => {
  describe('decoding', () => {
    it('single bytes', () => {
      const dec = new Base64Decoder(0);
      for (let i = 0; i < 256; ++i) {
        dec.init(1);
        const inp = new Uint8Array([i]);
        const data = fromBs(encNative(inp));
        assert.strictEqual(dec.put(data, 0, data.length), 0);
        assert.strictEqual(dec.end(), 0);
        assert.deepEqual(dec.data8, inp);
      }
    });
    it('1+2 bytes', () => {
      const dec = new Base64Decoder(0);
      for (let a = 0; a < 256; ++a) {
        for (let b = 0; b < 256; ++b) {
          dec.init(2);
          const inp = new Uint8Array([a, b]);
          const data = fromBs(encNative(inp));
          assert.strictEqual(dec.put(data, 0, data.length), 0);
          assert.strictEqual(dec.end(), 0);
          assert.deepEqual(dec.data8, inp);
        }
      }
    });
    it('2+3 bytes', () => {
      const dec = new Base64Decoder(0);
      for (let a = 0; a < 256; ++a) {
        for (let b = 0; b < 256; ++b) {
          dec.init(3);
          const inp = new Uint8Array([0, a, b]);
          const data = fromBs(encNative(inp));
          assert.strictEqual(dec.put(data, 0, data.length), 0);
          assert.strictEqual(dec.end(), 0);
          assert.deepEqual(dec.data8, inp);
        }
      }
    });
    it('3+4 bytes', () => {
      const dec = new Base64Decoder(0);
      for (let a = 0; a < 256; ++a) {
        for (let b = 0; b < 256; ++b) {
          dec.init(4);
          const inp = new Uint8Array([0, 0, a, b]);
          const data = fromBs(encNative(inp));
          assert.strictEqual(dec.put(data, 0, data.length), 0);
          assert.strictEqual(dec.end(), 0);
          assert.deepEqual(dec.data8, inp);
        }
      }
    });
    it('padding', () => {
      const dec = new Base64Decoder(0);
      const d = fromBs('Hello, here comes the mouse');
      const encData = [];
      const encDataTrimmed = [];
      for (let i = 1; i < d.length; ++i) {
        encData.push(encNative(d.slice(0, i)));
        encDataTrimmed.push(rtrim(encNative(d.slice(0, i)), '='));
      }
      for (let i = 0; i < encData.length; ++i) {
        // with padding
        dec.init(i + 1);
        let enc = fromBs(encData[i]);
        assert.strictEqual(dec.put(enc, 0, enc.length), 0);
        assert.strictEqual(dec.end(), 0);
        assert.deepEqual(dec.data8, d.slice(0, i + 1));
        // w'o padding
        dec.init(i + 1);
        enc = fromBs(encDataTrimmed[i]);
        assert.strictEqual(dec.put(enc, 0, enc.length), 0);
        assert.strictEqual(dec.end(), 0);
        assert.deepEqual(dec.data8, d.slice(0, i + 1));
      }
    });
    it('exit on false byte', () => {
      const dec = new Base64Decoder(0);
      for (let pos = 0; pos < 8; ++pos) {
        const inp = new Uint8Array([65, 65, 65, 65, 65, 65, 65, 65]);
        for (let i = 0; i < 256; ++i) {
          dec.release();
          dec.init(6);
          inp[pos] = i;
          dec.put(inp, 0, 8);
          assert.strictEqual(dec.end(), MAP.includes(i) ? 0 : 1);
        }
      }
    });
  });
  describe('memory', () => {
    it('always release (keepSize 0)', () => {
      const dec = new Base64Decoder(0);
      dec.init(16);
      dec.put(fromBs('A'.repeat(16)), 0, 16);
      dec.end();
      assert.strictEqual(dec.data8.length, 12);
      dec.release();
      assert.strictEqual(dec.data8.length, 0);
      assert.isNull((dec as any)._mem);
    });
    it('keep 1 page (keepSize 65536)', () => {
      const dec = new Base64Decoder(65536);
      dec.init(384);
      dec.put(fromBs('A'.repeat(512)), 0, 512);
      dec.end();
      assert.strictEqual(dec.data8.length, 384);
      dec.release();
      assert.strictEqual(dec.data8.length, 0);
      assert.isNotNull((dec as any)._mem);
      // grow to 2 pages + free afterwards
      dec.init(65536);
      dec.put(fromBs('A'.repeat(65536)), 0, 65536);
      dec.end();
      assert.strictEqual(dec.data8.length, 49152);
      dec.release();
      assert.strictEqual(dec.data8.length, 0);
      assert.isNull((dec as any)._mem);
    });
  });
});
