/**
 * @file serialize.c
 * @brief Wasm terminal line serializer
 * @version 0.1
 * @copyright Copyright (c) 2023 The xterm.js authors. All rights reserved.
 * @license MIT 
 */

/**
 * TODO: proper memory layout
 *
 * memory layout:
 *    0 -   16: global state variables        size: 4 * int32
 *   16 -  256: free
 *  256 -  656: LUT100                        size: 100 * int32
 *  656 - 1024: free
 * 1024 - ????: extended attribs + urlId      size: 2 * int32 * cols = 8 * cols
 * ???? - ????: line data (src)               size: 3 * int32 * cols = 12 * cols
 * ???? - ????: dst
 */


#ifndef TS_OVERRIDE
  /**
   * Note on the defines here:
   * Simply copied over from TS sources and unmaintained here.
   * The defines are still in place here just to make the editor happy.
   *
   * They get overloaded with real values imported on TS side. 
   */

  #define CODEPOINT_MASK    0x1FFFFF
  #define IS_COMBINED_MASK  0x200000
  #define HAS_CONTENT_MASK  0x3FFFFF
  #define WIDTH_MASK        0xC00000
  #define WIDTH_SHIFT       22

  /* bit 1..8     blue in RGB, color in P256 and P16 */
  #define BLUE_MASK         0xFF
  #define BLUE_SHIFT        0
  #define PCOLOR_MASK       0xFF
  #define PCOLOR_SHIFT      0

  /* bit 9..16    green in RGB */
  #define GREEN_MASK        0xFF00
  #define GREEN_SHIFT       8

  /* bit 17..24   red in RGB */
  #define RED_MASK          0xFF0000
  #define RED_SHIFT         16

  /* bit 25..26   color mode: DEFAULT (0) | P16 (1) | P256 (2) | RGB (3) */
  #define CM_MASK           0x3000000
  #define CM_DEFAULT        0
  #define CM_P16            0x1000000
  #define CM_P256           0x2000000
  #define CM_RGB            0x3000000

  /* bit 1..24  RGB room */
  #define RGB_MASK          0xFFFFFF
  #define COLOR_MASK        0x3FFFFFF   /* == CM_MASK | RGB_MASK */

  /* fg flags:   bit 27..32 */
  #define INVERSE           0x4000000
  #define BOLD              0x8000000
  #define UNDERLINE         0x10000000
  #define BLINK             0x20000000
  #define INVISIBLE         0x40000000
  #define STRIKETHROUGH     0x80000000

  /* bg flags:   bit 27..32 (upper 2 unused) */
  #define ITALIC            0x4000000
  #define DIM               0x8000000
  #define HAS_EXTENDED      0x10000000
  #define PROTECTED         0x20000000

  /* ext flags:   bit 27..32 (upper 3 unused) */
  #define UNDERLINE_STYLE   0x1C000000

  /* underline style */
  #define UL_NONE           0
  #define UL_SINGLE         1
  #define UL_DOUBLE         2
  #define UL_CURLY          3
  #define UL_DOTTED         4
  #define UL_DASHED         5


  /* memory locations */
  #define P_LUT100 256
  #define P_EXT 16384

#endif /* TS_OVERRIDE */



/**
 * Imported functions from JS side.
 */

/**
 * Write combined string data for a single cell on JS side.
 * The callback should write all codepoints of the combined string
 * for cell `x` beginning at `dst` and return the new write position. 
 */
__attribute__((import_module("env"), import_name("writeCombined")))
unsigned short* js_write_combined(unsigned short* dst, int x);

/**
 * Write URL sequence on JS side.
 * The callback should write the URL sequence beginning at `dst`
 * for the URL with the urlID `link` (from OscLinkService),
 * and return the new write position. 
 */
__attribute__((import_module("env"), import_name("writeLink")))
unsigned short* js_write_link(unsigned short* dst, int link);


/**
 * Cell struct as defined in Bufferline.ts
 * FIXME: Enhance with bitfield unions? (might save some bit juggling further down...)
 */
typedef struct __attribute__((packed, aligned(4))) {
  unsigned int content;
  unsigned int fg;
  unsigned int bg;
} Cell;


// FIXME: any nicer way to express this?
#define SGR_FLAG(V, DIFF, FLAG, HI, LO)                   \
if ((DIFF) & (FLAG)) {                                    \
  if ((V) & (FLAG)) {                                     \
    *(unsigned int*) dst = 0x3b0000 | (HI);               \
    dst += 2;                                             \
  } else {                                                \
    *(unsigned long long*) dst = 0x3b00000032ULL | (LO);  \
    dst += 3;                                             \
  }                                                       \
}                                                         \

#define W_CSI(dst) *(unsigned int*) dst = 0x5b001b; dst += 2;


/**
 * State to be preserve between multiple lines.
 */
unsigned int old_fg = 0;
unsigned int old_bg = 0;
unsigned int old_ul = 0;
unsigned int old_link = 0;


/**
 * itoa implementation for unsigned short to utf16.
 *
 * Note: Clang compiles with the div instruction into wasm.
 * Since tests with shift mul in source show no runtime difference,
 * wasm engines prolly optimize the division on their own.
 */
const unsigned int * LUT100 = (unsigned int *) P_LUT100;

__attribute__((noinline))
unsigned short* itoa(unsigned short n, unsigned short *dst) {
  if (n < 10) {
    *dst++ = n + 48;
  } else if (n < 100) {
    *(unsigned int*) dst = LUT100[n];
    dst += 2;
  } else if (n < 1000) {
    int h = n / 100;
    *dst++ = h + 48;
    *(unsigned int*) dst = LUT100[n - h * 100];
    dst += 2;
  } else if (n < 10000) {
    int h = n / 100;
    *(unsigned int*) dst = LUT100[h];
    *((unsigned int*) dst+1) = LUT100[n - h * 100];
    dst += 4;
  } else {
    int h = n / 10000;
    *dst++ = h + 48;
    n -= h * 10000;
    h = n / 100;
    *(unsigned int*) dst = LUT100[h];
    *((unsigned int*) dst+1) = LUT100[n - h * 100];
    dst += 4;
  }
  return dst;
}


/**
 * Set SGR colors for FG / BG / UL.
 * c denotes the color target as {FG: '3', BG: '4', UL: '5'}.
 */
__attribute__((noinline))
static unsigned short* color(unsigned short *dst, unsigned int v, char c) {
  int mode = v & CM_MASK;
  if (mode == CM_DEFAULT) {
    /* default is 39; | 49; | 59; */
    *(unsigned long long*) dst = 0x3b00390000ULL | c;
    dst += 3;
  } else if (mode == CM_P16) {
    unsigned long long color = 48 + (v & 7);
    if (v & 8) {
      /* bright for FG | BG (no UL color here) */
      if (c == '3') {
        *(unsigned long long*) dst = 0x003b00000039ULL | color << 16;
        dst += 3;
      } else if (c == '4') {
        *(unsigned long long*) dst = 0x003b000000300031ULL | color << 32;
        dst += 4;
      }
    } else {
      /* handles normal FG | BG | UL */
      *(unsigned long long*) dst = 0x3b00000000ULL | color << 16 | c;
      dst += 3;
    }
  } else if (mode == CM_P256) {
    /* 256 indexed written in ; notation */
    *dst++ = c;
    *(unsigned long long*) dst = 0x3b0035003b0038ULL;
    dst += 4;
    dst = itoa(v & 0xFF, dst);
    *dst++ = ';';
  } else {
    /* RGB written in ; notation */
    *dst++ = c;
    *(unsigned long long*) dst = 0x3b0032003b0038ULL;
    dst += 4;
    dst = itoa((v >> 16) & 0xFF, dst);
    *dst++ = ';';
    dst = itoa((v >> 8) & 0xFF, dst);
    *dst++ = ';';
    dst = itoa(v & 0xFF, dst);
    *dst++ = ';';
  }
  return dst;
}

/**
 * Write SGR sequence into `dst` from FG, BG and UL diffs.
 */
unsigned short* sgr(
  unsigned short* dst,
  unsigned int fg,
  unsigned int bg,
  unsigned int diff_fg,
  unsigned int diff_bg,
  unsigned int ul,
  unsigned int diff_ul
) {
  W_CSI(dst)

  if (!fg && !bg) {
    /* SGR 0 */
    *dst++ = ';';
  } else {
    /* fg flags */
    if (diff_fg >> 26) {
      SGR_FLAG(fg, diff_fg, INVERSE, '7', '7' << 16)
      SGR_FLAG(fg, diff_fg, BOLD, '1', '2' << 16)
      // SGR_FLAG(fg, diff_fg, UNDERLINE, '4', '4' << 16) // commented out: covered by ext ul attribs
      SGR_FLAG(fg, diff_fg, BLINK, '5', '5' << 16)
      SGR_FLAG(fg, diff_fg, INVISIBLE, '8', '8' << 16)
      SGR_FLAG(fg, diff_fg, STRIKETHROUGH, '9', '9' << 16)
    }
    /* fg color */
    if (diff_fg & COLOR_MASK) dst = color(dst, fg, '3');

    /* bg flags */
    if (diff_bg >> 26) {
      SGR_FLAG(bg, diff_bg, ITALIC, '3', '3')
      SGR_FLAG(bg, diff_bg, DIM, '2', '2')
    }
    /* bg color */
    if (diff_bg & COLOR_MASK) dst = color(dst, bg, '4');

    /* ul ext attributes */
    /* safety measure: check against HAS_EXTENDED in case we have spurious ext attrib values */
    if (bg & HAS_EXTENDED) {
      if (diff_ul & UNDERLINE_STYLE) {
        *dst++ = '4';
        *dst++ = ':';
        *dst++ = ((ul & UNDERLINE_STYLE) >> 26) + 48;
        *dst++ = ';';
      }
      if (diff_ul & COLOR_MASK) dst = color(dst, ul, '5');
    }
  }

  /* all params above are added with final ';', overwrite last one hereby -1 */
  *(dst - 1) = 'm';
  return dst;
}


/**
 * Exported functions.
 */


/**
 * @brief Reset internal state for FG, BG, UL and link.
 *
 * Should b called at the beginning of a serialization.
 * FG, BG and UL should be set to the terminal's default values (null cell),
 * happens to be 0 for all.
 * `link` is the urlId for a link as in the OscLinkService, 0 for unset.
 */
void reset(int fg, int bg, int ul, int link) {
  old_fg = fg;
  old_bg = bg;
  old_ul = ul;
  old_link = link;
}


/**
 * @brief Serialize terminal bufferline data with SGR attributes,
 * extended attributes and OSC8 hyperlinks.
 *
 * `src` is the start pointer, where Bufferline._data got copied to,
 * `length` denotes the Cell-length (Bufferline.length).
 *
 * The function will write the serialized line data to `dst` as 2-byte UTF-16
 * without additional size check (make sure to have enough space on TS side).
 */
// FIXME: how to get rid of the weird BCE hack?
void* line(Cell *src, int length, unsigned short *dst) {
  int cur_jmp = 0;
  unsigned int bce = old_bg;
  unsigned ul = old_ul;
  unsigned link = old_link;

  for (int i = 0; i < length;) {
    Cell cell = src[i];

    /**
     * apply SGR differences
     * We have to nullify HAS_EXTENDED due to its overloaded meaning,
     * otherwise we would introduce nonsense jump/erase sequences here.
     * SGR ext attributes for UL are covered by the explicit comparison,
     * URL/hyperlink entry needs a separate control path (TODO).
     */
    unsigned bg = cell.bg & ~HAS_EXTENDED;
    ul = *((unsigned int *) P_EXT + i);
    if (cell.fg != old_fg || bg != old_bg || ul != old_ul) {
      if (cur_jmp) {
        /**
         * We are in the middle of jumped over cells,
         * thus still need to apply BG changes first.
         */
        if (old_bg != bce) {
          W_CSI(dst)
          dst = itoa(cur_jmp, dst);
          *dst++ = 'X';
        }
        W_CSI(dst)
        dst = itoa(cur_jmp, dst);
        *dst++ = 'C';
        cur_jmp = 0;
      }
      /* write new SGR sequence, advance fg/bg/ul colors */
      dst = sgr(dst, cell.fg, cell.bg, cell.fg ^ old_fg, cell.bg ^ old_bg, ul, ul ^ old_ul);
      old_fg = cell.fg;
      old_bg = bg;
      old_ul = ul;
    }

    /* OSC 8 link handling */
    link = *((unsigned int *) P_EXT + (length + i));  // FIXME: merge memory segment with UL above
    if (link != old_link) {
      if (old_link) {
        /* close old link */
        *(unsigned long long*) dst = 0x003b0038005d001bULL;   // ; 8 ] ESC
        dst += 4;
        *(unsigned int*) dst = 0x0007003b;   // BEL ;
        dst += 2;
      }
      /**
       * safety measure: check against HAS_EXTENDED in case
       * we have a spurious ext attrib object on JS side
       */
      if ((cell.bg & HAS_EXTENDED) && link) {
        /* compose and write url sequence on JS side */
        dst = js_write_link(dst, link);
        old_link = link;
      } else {
        /* we have spurious ext object, explicitly nullify here */
        old_link = 0;
      }
    }

    /* text content handling */
    if (cell.content & HAS_CONTENT_MASK) {
      if (cur_jmp) {
        /**
         * We are in the middle of jumped over cells, thus apply cursor jump.
         * We have to check again in case there were no SGR changes before.
         */
        if (old_bg != bce) {
          W_CSI(dst)
          dst = itoa(cur_jmp, dst);
          *dst++ = 'X';
        }
        W_CSI(dst)
        dst = itoa(cur_jmp, dst);
        *dst++ = 'C';
        cur_jmp = 0;
      }
      if (cell.content & IS_COMBINED_MASK) {
        /* combined chars are written from JS */
        dst = js_write_combined(dst, i);
      } else {
        /* utf32 to utf16 conversion */
        unsigned int cp = cell.content & 0x1FFFFF;
        if (cp > 0xFFFF) {
          cp -= 0x10000;
          *dst++ = (cp >> 10) + 0xD800;
          *dst++ = (cp % 0x400) + 0xDC00;
        } else {
          *dst++ = cp;
        }
      }
    } else {
      /* empty cells are treated by cursor jumps */
      cur_jmp++;
    }

    /* advance cell read position by wcwidth or 1 */
    int width = cell.content >> WIDTH_SHIFT;
    i += width ? width : 1;
  }

  /* clear cells if we have jumped over cells and bce color != current bg */
  if (cur_jmp && old_bg != bce) {
    W_CSI(dst)
    dst = itoa(cur_jmp, dst);
    *dst++ = 'X';
  }

  return dst;
}
