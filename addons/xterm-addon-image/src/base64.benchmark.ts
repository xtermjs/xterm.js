import { ThroughputRuntimeCase, perfContext } from 'xterm-benchmark';
import { Base64Decoder } from './base64.wasm';

// eslint-disable-next-line
declare const Buffer: any;

function toBytes(s: string): Uint8Array {
  const bytes = new Uint8Array(s.length);
  for (let i = 0; i < s.length; ++i) {
    bytes[i] = s.charCodeAt(i) & 0xFF;
  }
  return bytes;
}

const d256 = 'ABCD'.repeat(64);
const d4096 = 'ABCD'.repeat(64 * 16);
const d65536 = 'ABCD'.repeat(64 * 16 * 16);
const d1M = 'ABCD'.repeat(64 * 16 * 16 * 16);
const b256   = toBytes(d256);
const b4096  = toBytes(d4096);
const b65536 = toBytes(d65536);
const b1M    = toBytes(d1M);
const dec = new Base64Decoder(4000000);


const RUNS = 100;

perfContext('Base64', () => {
  perfContext('Node - Buffer', () => {
    new ThroughputRuntimeCase('decode - 256', () => {
      Buffer.from(d256, 'base64');
      return { payloadSize: d256.length };
    }, { repeat: RUNS }).showAverageThroughput();

    new ThroughputRuntimeCase('decode - 4096', () => {
      Buffer.from(d4096, 'base64');
      return { payloadSize: d4096.length };
    }, { repeat: RUNS }).showAverageThroughput();

    new ThroughputRuntimeCase('decode - 65536', () => {
      Buffer.from(d65536, 'base64');
      return { payloadSize: d65536.length };
    }, { repeat: RUNS }).showAverageThroughput();

    new ThroughputRuntimeCase('decode - 1048576', () => {
      Buffer.from(d1M, 'base64');
      return { payloadSize: d1M.length };
    }, { repeat: RUNS }).showAverageThroughput();
  });

  perfContext('Base64Decoder', () => {
    new ThroughputRuntimeCase('decode - 256', () => {
      dec.init(192);
      dec.put(b256, 0, b256.length);
      dec.end();
      return { payloadSize: b256.length };
    }, { repeat: RUNS }).showAverageThroughput();

    new ThroughputRuntimeCase('decode - 4096', () => {
      dec.init(3072);
      dec.put(b4096, 0, b4096.length);
      dec.end();
      return { payloadSize: b4096.length };
    }, { repeat: RUNS }).showAverageThroughput();

    new ThroughputRuntimeCase('decode - 65536', () => {
      dec.init(49152);
      dec.put(b65536, 0, b65536.length);
      dec.end();
      return { payloadSize: b65536.length };
    }, { repeat: RUNS }).showAverageThroughput();

    new ThroughputRuntimeCase('decode - 1048576', () => {
      dec.init(786432);
      dec.put(b1M, 0, b1M.length);
      dec.end();
      return { payloadSize: b1M.length };
    }, { repeat: RUNS }).showAverageThroughput();
  });
});
