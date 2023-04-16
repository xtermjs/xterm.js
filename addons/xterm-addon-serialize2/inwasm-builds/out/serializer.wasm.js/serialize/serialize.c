
    /* write combined chars on JS side */
    __attribute__((import_module("env"), import_name("single_combined"))) void* single_combined(unsigned short* dst, int x);
    __attribute__((import_module("env"), import_name("load_link"))) void* load_link(unsigned short* dst, int link);

    // FIXME: import mask values as template strings from JS
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

    typedef struct __attribute__((packed, aligned(4))) {
      unsigned int content;
      unsigned int fg;
      unsigned int bg;
    } Cell;

    /**
     * Optimized itoa implementation for unsigned short to utf16.
     *
     * Note: Clang compiles with the div instruction in wasm.
     * Since tests with shift mul in source show no runtime difference,
     * wasm engines prolly optimize the division on their own.
     */
    unsigned int *LUT100 = (unsigned int*) 256;

    __attribute__((noinline))
    unsigned short* itoa16(unsigned short n, unsigned short *dst) {
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

    /* TODO: target support flags */
    #define S_SGR         1     /* include SGR flags */
    #define S_COLORS      2     /* include 256 indexed colors */
    #define S_RGB         4     /* include RGB colors */
    #define S_REMPTY      8     /* right truncate empty cells */
    #define S_CURSOR      16    /* include cursor move sequences */
    #define S_ALT_SWITCH  32    /* include normal buffer, if on alternate */
    #define S_DECAWM      64    /* dont break soft wraps */


    /**
     * Set SGR colors for FG / BG / UL.
     * c denotes the color target as {FG: '3', BG: '4', UL: '5'}.
     */
    __attribute__((noinline))
    static unsigned short* set_color16(unsigned short *d, unsigned int v, char c) {
      int mode = v & CM_MASK;
      if (mode == CM_DEFAULT) {
        *(unsigned long long*) d = 0x3b00390000ULL | c;
        d += 3;
      } else if (mode == CM_P16) {
        unsigned long long color = 48 + (v & 7);
        if (v & 8) {
          /* bright for FG | BG (no UL color here) */
          if (c == '3') {
            *(unsigned long long*) d = 0x003b00000039ULL | color << 16;
            d += 3;
          } else if (c == '4') {
            *(unsigned long long*) d = 0x003b000000300031ULL | color << 32;
            d += 4;
          }
        } else {
          /* handles normal FG | BG | UL */
          *(unsigned long long*) d = 0x3b00000000ULL | color << 16 | c;
          d += 3;
        }
      } else if (mode == CM_P256) {
        *d++ = c;
        *(unsigned long long*) d = 0x3b0035003b0038ULL;
        d += 4;
        d = itoa16(v & 0xFF, d);
        *d++ = ';';
      } else {
        *d++ = c;
        *(unsigned long long*) d = 0x3b0032003b0038ULL;
        d += 4;
        d = itoa16((v >> 16) & 0xFF, d);
        *d++ = ';';
        d = itoa16((v >> 8) & 0xFF, d);
        *d++ = ';';
        d = itoa16(v & 0xFF, d);
        *d++ = ';';
      }
      return d;
    }

    // FIXME: any nicer way to express this?
    #define SGR_FLAG(V, DIFF, FLAG, HI, LO)                     if ((DIFF) & (FLAG)) {                                        if ((V) & (FLAG)) {                                           *(unsigned int*) d = 0x3b0000 | (HI);                       d += 2;                                                   } else {                                                      *(unsigned long long*) d = 0x3b00000032ULL | (LO);          d += 3;                                                   }                                                         }                                                       
    #define W_CSI(dst) *(unsigned int*) dst = 0x5b001b; dst += 2;

    unsigned short* diff_attr16(
      unsigned short* d,
      unsigned int fg,
      unsigned int bg,
      unsigned int diff_fg,
      unsigned int diff_bg,
      unsigned int ul,
      unsigned int diff_ul
    ) {
      W_CSI(d)

      if (!fg && !bg) {
        *d++ = ';';
      } else {
        /* fg flags */
        if (diff_fg >> 26) {
          SGR_FLAG(fg, diff_fg, INVERSE, '7', '7' << 16)
          SGR_FLAG(fg, diff_fg, BOLD, '1', '2' << 16)
          //SGR_FLAG(fg, diff_fg, UNDERLINE, '4', '4' << 16) // covered by ext ul attribs
          SGR_FLAG(fg, diff_fg, BLINK, '5', '5' << 16)
          SGR_FLAG(fg, diff_fg, INVISIBLE, '8', '8' << 16)
          SGR_FLAG(fg, diff_fg, STRIKETHROUGH, '9', '9' << 16)
        }
        /* fg color */
        if (diff_fg & COLOR_MASK) d = set_color16(d, fg, '3');

        /* bg flags */
        if (diff_bg >> 26) {
          SGR_FLAG(bg, diff_bg, ITALIC, '3', '3')
          SGR_FLAG(bg, diff_bg, DIM, '2', '2')
        }
        /* bg color */
        if (diff_bg & COLOR_MASK) d = set_color16(d, bg, '4');

        /* ul ext attributes */
        /* safety measure: check against HAS_EXTENDED in case we have spurious ext attrib values */
        if (bg & HAS_EXTENDED) {
          if (diff_ul & UNDERLINE_STYLE) {
            *d++ = '4';
            *d++ = ':';
            *d++ = ((ul & UNDERLINE_STYLE) >> 26) + 48;
            *d++ = ';';
          }
          if (diff_ul & COLOR_MASK) d = set_color16(d, ul, '5');
        }
      }
      *(d - 1) = 'm';
      return d;
    }

    unsigned int old_fg = 0;
    unsigned int old_bg = 0;
    unsigned int old_ul = 0;
    unsigned int old_link = 0;

    void reset(int fg, int bg, int ul, int link) {
      old_fg = fg;
      old_bg = bg;
      old_ul = ul;
      old_link = link;
    }

    // FIXME: how to get rid of the weird BCE hack?
    void* line16(Cell *src, int length, unsigned short *dst) {
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
        ul = *((unsigned int *) (4096 * 4) + i);
        if (cell.fg != old_fg || bg != old_bg || ul != old_ul) {
          /*
            we are in the middle of jumped over cells,
            thus still need to apply BG changes first
           */
          if (cur_jmp) {
            if (old_bg != bce) {
              W_CSI(dst)
              dst = itoa16(cur_jmp, dst);
              *dst++ = 'X';
            }
            W_CSI(dst)
            dst = itoa16(cur_jmp, dst);
            *dst++ = 'C';
            cur_jmp = 0;
          }
          /* write new SGR sequence, advance fg/bg/ul colors */
          dst = diff_attr16(dst, cell.fg, cell.bg, cell.fg ^ old_fg, cell.bg ^ old_bg, ul, ul ^ old_ul);
          old_fg = cell.fg;
          old_bg = bg;
          old_ul = ul;
        }

        /* OSC 8 link handling */
        link = *((unsigned int *) (4096 * 4) + (length + i));
        if (link != old_link) {
          if (old_link) {
            // simply close old link - OSC 8 ; ; BEL
            *(unsigned long long*) dst = 0x003b0038005d001bULL;   // ; 8 ] ESC
            dst += 4;
            *(unsigned int*) dst = 0x0007003b;   // BEL ;
            dst += 2;
          }
          if ((cell.bg & HAS_EXTENDED) && link) {
            dst = load_link(dst, link);
            old_link = link;
          } else {
            old_link = 0;
          }
        }


        /* text content handling */
        if (cell.content & HAS_CONTENT_MASK) {
          /*
            we are in the middle of jumped over cells, thus apply cursor jump
            we have to check here again in case there were no SGR changes
           */
          if (cur_jmp) {
            if (old_bg != bce) {
              W_CSI(dst)
              dst = itoa16(cur_jmp, dst);
              *dst++ = 'X';
            }
            W_CSI(dst)
            dst = itoa16(cur_jmp, dst);
            *dst++ = 'C';
            cur_jmp = 0;
          }
          /* combined chars are written from JS (expensive?) */
          if (cell.content & IS_COMBINED_MASK) {
            // FIXME: preload combined in a single action similar to ext attribs?
            dst = single_combined(dst, i);
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

      /*
        clear cells to the right if we have jumped over cells
        and bce color != current bg
       */
      if (cur_jmp && old_bg != bce) {
        W_CSI(dst)
        dst = itoa16(cur_jmp, dst);
        *dst++ = 'X';
      }

      return dst;
    }
    