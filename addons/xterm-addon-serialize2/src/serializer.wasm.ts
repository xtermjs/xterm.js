
import { InWasm, OutputMode, OutputType } from 'inwasm';
import { ITerminal } from 'browser/Types';
import { IBufferLine, IExtendedAttrs } from 'common/Types';
import { Attributes, BgFlags, Content, ExtFlags, FgFlags, UnderlineStyle } from 'common/buffer/Constants';

/* eslint-disable */
interface IExtendedAttrsInternal extends IExtendedAttrs {
  _urlId: number;
  _ext: number;
}

interface IBufferLineInternal extends IBufferLine {
  _data: Uint32Array;
  _extendedAttrs: {[index: number]: IExtendedAttrsInternal | undefined};
  _combined: {[index: number]: string};
}
/* eslint-enable */


const wasmSerialize = InWasm({
  name: 'serialize',
  type: OutputType.INSTANCE,
  mode: OutputMode.SYNC,
  srctype: 'Clang-C',
  imports: {
    env: {
      memory: new WebAssembly.Memory({ initial: 1 }),
      writeCombined: (dst: number, x: number) => 0,
      writeLink: (dst: number, linkId: number) => 0
    }
  },
  exports: {
    line: (src: number, length: number, dst: number) => 0,
    reset: (fg: number, bg: number, ul: number, link: number) => {}
  },
  compile: {
    switches: ['-Wl,-z,stack-size=0', '-Wl,--stack-first']
  },
  trackChanges: ['src-wasm/serialize.c'],
  code: `
    #define TS_OVERRIDE

    #define CODEPOINT_MASK    ${Content.CODEPOINT_MASK}
    #define IS_COMBINED_MASK  ${Content.IS_COMBINED_MASK}
    #define HAS_CONTENT_MASK  ${Content.HAS_CONTENT_MASK}
    #define WIDTH_MASK        ${Content.WIDTH_MASK}
    #define WIDTH_SHIFT       ${Content.WIDTH_SHIFT}

    /* bit 1..8     blue in RGB, color in P256 and P16 */
    #define BLUE_MASK         ${Attributes.BLUE_MASK}
    #define BLUE_SHIFT        ${Attributes.BLUE_SHIFT}
    #define PCOLOR_MASK       ${Attributes.PCOLOR_MASK}
    #define PCOLOR_SHIFT      ${Attributes.PCOLOR_SHIFT}

    /* bit 9..16    green in RGB */
    #define GREEN_MASK        ${Attributes.GREEN_MASK}
    #define GREEN_SHIFT       ${Attributes.GREEN_SHIFT}

    /* bit 17..24   red in RGB */
    #define RED_MASK          ${Attributes.RED_MASK}
    #define RED_SHIFT         ${Attributes.RED_SHIFT}

    /* bit 25..26   color mode: DEFAULT (0) | P16 (1) | P256 (2) | RGB (3) */
    #define CM_MASK           ${Attributes.CM_MASK}
    #define CM_DEFAULT        ${Attributes.CM_DEFAULT}
    #define CM_P16            ${Attributes.CM_P16}
    #define CM_P256           ${Attributes.CM_P256}
    #define CM_RGB            ${Attributes.CM_RGB}

    /* bit 1..24  RGB room */
    #define RGB_MASK          ${Attributes.RGB_MASK}
    #define COLOR_MASK        ${Attributes.CM_MASK | Attributes.RGB_MASK}

    /* fg flags:   bit 27..32 */
    #define INVERSE           ${FgFlags.INVERSE}
    #define BOLD              ${FgFlags.BOLD}
    #define UNDERLINE         ${FgFlags.UNDERLINE}
    #define BLINK             ${FgFlags.BLINK}
    #define INVISIBLE         ${FgFlags.INVISIBLE}
    #define STRIKETHROUGH     ${FgFlags.STRIKETHROUGH}

    /* bg flags:   bit 27..32 (upper 2 unused) */
    #define ITALIC            ${BgFlags.ITALIC}
    #define DIM               ${BgFlags.DIM}
    #define HAS_EXTENDED      ${BgFlags.HAS_EXTENDED}
    #define PROTECTED         ${BgFlags.PROTECTED}

    /* ext flags:   bit 27..32 (upper 3 unused) */
    #define UNDERLINE_STYLE   ${ExtFlags.UNDERLINE_STYLE}

    /* underline style */
    #define UL_NONE           ${UnderlineStyle.NONE}
    #define UL_SINGLE         ${UnderlineStyle.SINGLE}
    #define UL_DOUBLE         ${UnderlineStyle.DOUBLE}
    #define UL_CURLY          ${UnderlineStyle.CURLY}
    #define UL_DOTTED         ${UnderlineStyle.DOTTED}
    #define UL_DASHED         ${UnderlineStyle.DASHED}


    /* memory locations */
    #define P_LUT100 256
    #define P_EXT 16384

    ${require('fs').readFileSync('src-wasm/serialize.c')}
  `
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
let writeCombinedOverload: (dst: number, x: number) => number = (dst, x) => dst;
const writeCombined: (dst: number, x: number) => number = (dst, x) => writeCombinedOverload(dst, x);
let writeLinkOverload: (dst: number, x: number) => number = (dst, x) => dst;
const writeLink: (dst: number, x: number) => number = (dst, x) => writeLinkOverload(dst, x);
const inst = wasmSerialize({ env: { memory: mem, writeCombined, writeLink } });
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
  writeCombinedOverload = (dst, x) => {
    let dp = dst >> 1;
    const comb: string = (line as any)._combined[x] || '';
    for (let i = 0; i < comb.length; ++i) {
      d16[dp++] = comb.charCodeAt(i);
    }
    return dp << 1;
  };

  // write link to buffer
  writeLinkOverload = (dst, linkId) => {
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
    wPos = inst.exports.line(65536, t.cols, wPos);

    // TODO: end of line hook goes here...
  }
  const finalData = d16.subarray(75*65536, wPos >> 1);
  // strip empty lines at bottom
  let fdp = finalData.length - 1;
  while (fdp && finalData[fdp] === 10 && finalData[fdp-1] === 13) fdp -= 2;

  // strip leading CRLF
  const offset = finalData[0] === 13 && finalData[1] === 10 ? 2 : 0;

  // return as string
  // TODO: compose from hook parts (needs to store wPos line offsets?)
  return td.decode(d16.subarray(75*65536+offset, 75*65536+fdp+1));
}
