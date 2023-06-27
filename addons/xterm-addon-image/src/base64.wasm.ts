/**
 * Copyright (c) 2023 The xterm.js authors. All rights reserved.
 * @license MIT
 */
import { InWasm, IWasmInstance, OutputMode, OutputType } from 'inwasm';


// memory addresses in uint32
const enum P32 {
  D0 = 256,
  D1 = 512,
  D2 = 768,
  D3 = 1024,
  STATE = 1280,
  STATE_WP = 1280,
  STATE_SP = 1281,
  STATE_DP = 1282,
  STATE_ESIZE = 1283,
  STATE_BSIZE = 1284,
  STATE_DATA = 1288   // 16 aligned
}

/**
 * wasm base64 decoder.
 */
const wasmDecode = InWasm({
  name: 'decode',
  type: OutputType.INSTANCE,
  mode: OutputMode.SYNC,
  srctype: 'Clang-C',
  imports: {
    env: { memory: new WebAssembly.Memory({ initial: 1 }) }
  },
  exports: {
    dec: () => 0,
    end: () => 0
  },
  compile: {
    switches: ['-Wl,-z,stack-size=0', '-Wl,--stack-first']
  },
  code: `
    typedef struct {
      unsigned int wp;
      unsigned int sp;
      unsigned int dp;
      unsigned int e_size;
      unsigned int b_size;
      unsigned int dummy[3];
      unsigned char data[0];
    } State;

    unsigned int *D0 = (unsigned int *) ${P32.D0*4};
    unsigned int *D1 = (unsigned int *) ${P32.D1*4};
    unsigned int *D2 = (unsigned int *) ${P32.D2*4};
    unsigned int *D3 = (unsigned int *) ${P32.D3*4};
    State *state = (State *) ${P32.STATE*4};

    __attribute__((noinline)) int dec() {
      unsigned int nsp = (state->wp - 1) & ~3;
      unsigned char *src = state->data + state->sp;
      unsigned char *end = state->data + nsp;
      unsigned char *dst = state->data + state->dp;
      unsigned int accu;

      while (src < end) {
        if ((accu = D0[src[0]] | D1[src[1]] | D2[src[2]] | D3[src[3]]) >> 24) return 1;
        *((unsigned int *) dst) = accu;
        dst += 3;
        src += 4;
      }
      state->sp = nsp;
      state->dp = dst - state->data;
      return 0;
    }

    int end() {
      int rem = state->wp - state->sp;
      if (rem > 4 && dec()) return 1;
      rem = state->wp - state->sp;
      if (rem < 2) return 1;

      unsigned char *src = state->data + state->sp;
      unsigned int accu = D0[src[0]] | D1[src[1]];
      int dp = 1;
      if (rem > 2 && src[2] != 61) {
        accu |= D2[src[2]];
        dp++;
      }
      if (rem == 4 && src[3] != 61) {
        accu |= D3[src[3]];
        dp++;
      }
      if (accu >> 24) return 1;
      *((unsigned int *) (state->data + state->dp)) = accu;
      state->dp += dp;
      return state->dp != state->b_size;
    }
    `
});

// SIMD version - commented out for now due to missing Safari support
// const wasmDecode = InWasm({
//   name: 'decode',
//   type: OutputType.INSTANCE,
//   mode: OutputMode.SYNC,
//   srctype: 'Clang-C',
//   imports: {
//     env: { memory: new WebAssembly.Memory({ initial: 1 }) }
//   },
//   exports: {
//     dec: () => 0,
//     end: () => 0
//   },
//   compile: {
//     switches: ['-msimd128', '-Wl,-z,stack-size=0', '-Wl,--stack-first']
//   },
//   code: `
//     #include <wasm_simd128.h>
//     typedef struct {
//       unsigned int wp;
//       unsigned int sp;
//       unsigned int dp;
//       unsigned int e_size;
//       unsigned int b_size;
//       unsigned int dummy[3];
//       unsigned char data[0];
//     } State;
//
//     unsigned int *D0 = (unsigned int *) ${P32.D0*4};
//     unsigned int *D1 = (unsigned int *) ${P32.D1*4};
//     unsigned int *D2 = (unsigned int *) ${P32.D2*4};
//     unsigned int *D3 = (unsigned int *) ${P32.D3*4};
//     State *state = (State *) ${P32.STATE*4};
//
//     #define packed_byte(x) wasm_i8x16_splat((char) x)
//     #define packed_dword(x) wasm_i32x4_splat(x)
//     #define masked(x, mask) wasm_v128_and(x, wasm_i32x4_splat(mask))
//
//     int dec4() {
//       unsigned int nsp = (state->wp - 1) & ~3;
//       unsigned char *src = state->data + state->sp;
//       unsigned char *end = state->data + nsp;
//       unsigned char *dst = state->data + state->dp;
//       unsigned int accu;
//
//       while (src < end) {
//         if ((accu = D0[src[0]] | D1[src[1]] | D2[src[2]] | D3[src[3]]) >> 24) return 1;
//         *((unsigned int *) dst) = accu;
//         dst += 3;
//         src += 4;
//       }
//       state->sp = nsp;
//       state->dp = dst - state->data;
//       return 0;
//     }
//
//     int dec() {
//       unsigned int nsp = (state->wp - 1) & ~15;
//       unsigned char *src = state->data + state->sp;
//       unsigned char *end = state->data + nsp;
//       unsigned char *dst = state->data + state->dp;
//       unsigned int accu;
//
//       v128_t err = wasm_i8x16_splat(0);
//
//       while (src < end) {
//         v128_t data = wasm_v128_load((v128_t *) src);
//
//         // wasm-simd rewrite of http://0x80.pl/notesen/2016-01-17-sse-base64-decoding.html#vector-lookup-pshufb
//         const v128_t higher_nibble = wasm_u32x4_shr(data, 4) & packed_byte(0x0f);
//         const char linv = 1;
//         const char hinv = 0;
//
//         const v128_t lower_bound_LUT = wasm_i8x16_make(
//             /* 0 */ linv, /* 1 */ linv, /* 2 */ 0x2b, /* 3 */ 0x30,
//             /* 4 */ 0x41, /* 5 */ 0x50, /* 6 */ 0x61, /* 7 */ 0x70,
//             /* 8 */ linv, /* 9 */ linv, /* a */ linv, /* b */ linv,
//             /* c */ linv, /* d */ linv, /* e */ linv, /* f */ linv
//         );
//         const v128_t upper_bound_LUT = wasm_i8x16_make(
//             /* 0 */ hinv, /* 1 */ hinv, /* 2 */ 0x2b, /* 3 */ 0x39,
//             /* 4 */ 0x4f, /* 5 */ 0x5a, /* 6 */ 0x6f, /* 7 */ 0x7a,
//             /* 8 */ hinv, /* 9 */ hinv, /* a */ hinv, /* b */ hinv,
//             /* c */ hinv, /* d */ hinv, /* e */ hinv, /* f */ hinv
//         );
//         // the difference between the shift and lower bound
//         const v128_t shift_LUT = wasm_i8x16_make(
//             /* 0 */ 0x00,        /* 1 */ 0x00,        /* 2 */ 0x3e - 0x2b, /* 3 */ 0x34 - 0x30,
//             /* 4 */ 0x00 - 0x41, /* 5 */ 0x0f - 0x50, /* 6 */ 0x1a - 0x61, /* 7 */ 0x29 - 0x70,
//             /* 8 */ 0x00,        /* 9 */ 0x00,        /* a */ 0x00,        /* b */ 0x00,
//             /* c */ 0x00,        /* d */ 0x00,        /* e */ 0x00,        /* f */ 0x00
//         );
//
//         const v128_t upper_bound = wasm_i8x16_swizzle(upper_bound_LUT, higher_nibble);
//         const v128_t lower_bound = wasm_i8x16_swizzle(lower_bound_LUT, higher_nibble);
//
//         const v128_t below = wasm_i8x16_lt(data, lower_bound);
//         const v128_t above = wasm_i8x16_gt(data, upper_bound);
//         const v128_t eq_2f = wasm_i8x16_eq(data, packed_byte(0x2f));
//
//         // in_range = not (below or above) or eq_2f
//         // outside  = not in_range = below or above and not eq_2f (from deMorgan law)
//         const v128_t outside = wasm_v128_andnot(eq_2f, above | below);
//         err = wasm_v128_or(err, outside);
//
//         const v128_t shift  = wasm_i8x16_swizzle(shift_LUT, higher_nibble);
//         const v128_t t0     = wasm_i8x16_add(data, shift);
//         v128_t v = wasm_i8x16_add(t0, wasm_v128_and(eq_2f, packed_byte(-3)));
//
//         // pack bytes
//         const v128_t ca = masked(v, 0x003f003f);
//         const v128_t db = masked(v, 0x3f003f00);
//         const v128_t t00 = wasm_v128_or(wasm_u32x4_shr(db, 8), wasm_i32x4_shl(ca, 6));
//         v128_t res = wasm_v128_or(wasm_u32x4_shr(t00, 16), wasm_i32x4_shl(t00, 12));
//         res = wasm_i8x16_swizzle(res, wasm_i8x16_const(2, 1, 0, 6, 5, 4, 10, 9, 8, 14, 13, 12, 16, 16, 16, 16));
//
//         wasm_v128_store((v128_t *) dst, res);
//         dst += 12;
//         src += 16;
//       }
//
//       if (wasm_i8x16_bitmask(err) != 0) return 1;
//
//       state->sp = nsp;
//       state->dp = dst - state->data;
//       return 0;
//     }
//
//     int end() {
//       int rem = state->wp - state->sp;
//       if (rem > 4 && dec4()) return 1;
//       rem = state->wp - state->sp;
//       if (rem < 2) return 1;
//
//       unsigned char *src = state->data + state->sp;
//       unsigned int accu = D0[src[0]] | D1[src[1]];
//       int dp = 1;
//       if (rem > 2 && src[2] != 61) {
//         accu |= D2[src[2]];
//         dp++;
//       }
//       if (rem == 4 && src[3] != 61) {
//         accu |= D3[src[3]];
//         dp++;
//       }
//       if (accu >> 24) return 1;
//       *((unsigned int *) (state->data + state->dp)) = accu;
//       state->dp += dp;
//       return state->dp != state->b_size;
//     }
//     `
// });

// FIXME: currently broken in inwasm
type ExtractDefinition<Type> = Type extends () => IWasmInstance<infer X> ? X : never;
type DecodeDefinition = ExtractDefinition<typeof wasmDecode>;

// base64 map
const MAP = new Uint8Array(
  'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'
    .split('')
    .map(el => el.charCodeAt(0))
);

// init decoder maps in LE order
const D = new Uint32Array(1024);
D.fill(0xFF000000);
for (let i = 0; i < MAP.length; ++i) D[MAP[i]] = i << 2;
for (let i = 0; i < MAP.length; ++i) D[256 + MAP[i]] = i >> 4 | ((i << 4) & 0xFF) << 8;
for (let i = 0; i < MAP.length; ++i) D[512 + MAP[i]] = (i >> 2) << 8 | ((i << 6) & 0xFF) << 16;
for (let i = 0; i < MAP.length; ++i) D[768 + MAP[i]] = i << 16;

const EMPTY = new Uint8Array(0);

/**
 * base64 streamline inplace decoder.
 *
 * Features / assumptions:
 * - optimized uint32 read/write (only LE support!)
 * - lazy chunkwise decoding
 * - errors out on any non base64 chars (no support for NL formatted base64)
 * - decodes in wasm
 * - inplace decoding to save memory
 * - supports a keepSize for lazy memory release
 */
export class Base64Decoder {
  private _d!: Uint8Array;
  private _m32!: Uint32Array;
  private _inst!: IWasmInstance<DecodeDefinition>;
  private _mem!: WebAssembly.Memory;

  constructor(public keepSize: number) {}

  /**
   * Currently decoded bytes (borrowed).
   * Must be accessed before calling `release` or `init`.
   */
  public get data8(): Uint8Array {
    return this._inst ? this._d.subarray(0, this._m32[P32.STATE_DP]) : EMPTY;
  }

  /**
   * Release memory conditionally based on `keepSize`.
   * If memory gets released, also the wasm instance will be freed and recreated on next `init`,
   * otherwise the instance will be reused.
   */
  public release(): void {
    if (!this._inst) return;
    if (this._mem.buffer.byteLength > this.keepSize) {
      this._inst = this._m32 = this._d = this._mem = null!;
    } else {
      this._m32[P32.STATE_WP] = 0;
      this._m32[P32.STATE_SP] = 0;
      this._m32[P32.STATE_DP] = 0;
    }
  }

  /**
   * Initializes the decoder for new base64 data.
   * Must be called before doing any decoding attempts.
   * `size` is the amount of decoded bytes to be expected.
   * The method will either spawn a new wasm instance or grow
   * the needed memory of an existing instance.
   */
  public init(size: number): void {
    let m = this._m32;
    const bytes = (Math.ceil(size / 3) + P32.STATE_DATA) * 4;
    if (!this._inst) {
      this._mem = new WebAssembly.Memory({ initial: Math.ceil(bytes / 65536) });
      this._inst = wasmDecode({ env: { memory: this._mem } });
      m = new Uint32Array(this._mem.buffer, 0);
      m.set(D, P32.D0);
      this._d = new Uint8Array(this._mem.buffer, P32.STATE_DATA * 4);
    } else if (this._mem.buffer.byteLength < bytes) {
      this._mem.grow(Math.ceil((bytes - this._mem.buffer.byteLength) / 65536));
      m = new Uint32Array(this._mem.buffer, 0);
      this._d = new Uint8Array(this._mem.buffer, P32.STATE_DATA * 4);
    }
    m[P32.STATE_BSIZE] = size;
    m[P32.STATE_ESIZE] = Math.ceil(size / 3) * 4;
    m[P32.STATE_WP] = 0;
    m[P32.STATE_SP] = 0;
    m[P32.STATE_DP] = 0;
    this._m32 = m;
  }

  /**
   * Put bytes in `data` from `start` to `end` (exclusive) into the decoder.
   * Also decodes base64 data inplace once the payload exceeds 2^17 bytes.
   * Returns 1 on error, else 0.
   */
  public put(data: Uint8Array | Uint16Array | Uint32Array, start: number, end: number): number {
    if (!this._inst) return 1;
    const m = this._m32;
    if (end - start + m[P32.STATE_WP] > m[P32.STATE_ESIZE]) return 1;
    this._d.set(data.subarray(start, end), m[P32.STATE_WP]);
    m[P32.STATE_WP] += end - start;
    // max chunk in input handler is 2^17, try to run in "tandem mode"
    // also assures that we dont run into illegal offsets in the wasm part
    return m[P32.STATE_WP] - m[P32.STATE_SP] >= 131072 ? this._inst.exports.dec() : 0;
  }

  /**
   * End the current decoding.
   * Decodes leftover payload and finally checks for the correct amount of
   * decoded bytes by comparing to the value given to `init`.
   * Returns 1 on error, else 0.
   */
  public end(): number {
    return this._inst ? this._inst.exports.end() : 1;
  }
}
