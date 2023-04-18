/* eslint-disable */

import { InWasm, OutputMode, OutputType } from 'inwasm';
import { ITerminal } from 'browser/Types';
import { IBufferLine, IExtendedAttrs } from 'common/Types';

interface IExtendedAttrsInternal extends IExtendedAttrs {
  _urlId: number;
  _ext: number;
}

interface IBufferLineInternal extends IBufferLine {
  _data: Uint32Array;
  _extendedAttrs: {[index: number]: IExtendedAttrsInternal | undefined};
  _combined: {[index: number]: string};
}

const wasmSerialize = InWasm({
  name: 'serialize',
  type: OutputType.INSTANCE,
  mode: OutputMode.SYNC,
  srctype: 'Clang-C',
  imports: {
    env: {
      memory: new WebAssembly.Memory({ initial: 1 }),
      single_combined: (dst: number, x: number) => 0,
      load_link: (dst: number, linkId: number) => 0
    }
  },
  exports: {
    line16: (src: number, length: number, dst: number) => 0,
    reset: (fg: number, bg: number, ul: number, link: number) => {}
  },
  compile: {
    switches: ['-Wl,-z,stack-size=0', '-Wl,--stack-first']
  },
  code: `${require('fs').readFileSync('src-wasm/serialize.c')}`,
  trackChanges: ['src-wasm/serialize.c'],
  trackMode: 'content'
});

// itoa LUT
// note: performant decimal conversion of numbers is actually a hard problem
// we use a LUT approach with 0-99 precomputed in utf16 for better performance
const LUT100 = new Uint32Array(100);
for (let i1 = 0; i1 < 10; ++i1) {
  for (let i2 = 0; i2 < 10; ++i2) {
    LUT100[i1 * 10 + i2] = (48 + i2) << 16 | (48 + i1);
  }
}

const mem = new WebAssembly.Memory({ initial: 3000 });
const d16 = new Uint16Array(mem.buffer);
const d32 = new Uint32Array(mem.buffer);
let _single_comb: (dst: number, x: number) => number = (dst, x) => dst;
const single_combined: (dst: number, x: number) => number = (dst, x) => _single_comb(dst, x);
let _load_link: (dst: number, x: number) => number = (dst, x) => dst;
const load_link: (dst: number, x: number) => number = (dst, x) => _load_link(dst, x);
const inst = wasmSerialize({ env: { memory: mem, single_combined, load_link } });
d32.set(LUT100, 64);
const td = new TextDecoder('UTF-16LE');


export function serialize(t: ITerminal): string {
  // reset FG/BG/ext
  inst.exports.reset(0, 0, 0, 0);

  const buffer = t.buffer;
  const len = t.buffer.lines.length;
  let wPos = 150*65536;

  let line: IBufferLineInternal;
  
  // single call is pretty wasteful? preload combines once instead?
  _single_comb = (dst, x) => {
    let dp = dst >> 1;
    const comb: string = (line as any)._combined[x] || '';
    for (let i = 0; i < comb.length; ++i) {
      d16[dp++] = comb.charCodeAt(i);
    }
    return dp << 1;
  };

  // write link to buffer
  _load_link = (dst, linkId) => {
    const entry = (t as any)._oscLinkService._dataByLinkId.get(linkId);
    if (!entry) {
      return dst;
    }
    const osc8 = `\x1b]8;${entry.data.id ? 'id='+entry.data.id : ''};${entry.data.uri}\x07`;
    let dp = dst >> 1;
    for (let i = 0; i < osc8.length; ++i) {
      d16[dp++] = osc8.charCodeAt(i);
    }
    return dp << 1;
  };

  const ext = d32.subarray(4096, 4096 + t.cols*2);
  const ext2 = ext.subarray(t.cols);
  let clearExt = false;

  for (let row = 0; row < len; ++row) {
    line = buffer.lines.get(row) as IBufferLineInternal;
    if (!line) break;

    // insert CRLF
    if (!line.isWrapped) {
      const wPos16 = wPos >> 1;
      d16[wPos16] = 13;
      d16[wPos16+1] = 10;
      wPos += 4;
    }

    // TODO: start of line hook goes here...

    // load extended attributes
    if (clearExt) {
      ext.fill(0);
      clearExt = false;
    }
    const keys = Object.keys(line._extendedAttrs) as unknown as number[];
    if (keys.length) {
      for (let k = 0; k < keys.length; ++k) {
        const rk = keys[k];
        ext[rk] = line._extendedAttrs[rk]!._ext;      // UL color & style
        ext2[rk] = line._extendedAttrs[rk]!._urlId;   // OSC 8 link
      }
      clearExt = true;
    }

    d32.set(line._data, 16384);
    wPos = inst.exports.line16(65536, t.cols, wPos);

    // TODO: end of line hook goes here...
  }
  const final_data = d16.subarray(75*65536, wPos >> 1);
  // strip empty lines at bottom
  let fdp = final_data.length - 1;
  while (fdp && final_data[fdp] === 10 && final_data[fdp-1] === 13) fdp -= 2;

  // strip leading CRLF
  const offset = final_data[0] === 13 && final_data[1] === 10 ? 2 : 0;

  // return as string
  // TODO: compose from hook parts (needs to store wPos line offsets?)
  return td.decode(d16.subarray(75*65536+offset, 75*65536+fdp+1));
}
