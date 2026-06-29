/**
 * Copyright (c) 2025 The xterm.js authors. All rights reserved.
 * @license MIT
 *
 * Deterministic generators that mimic the output of an AI/agent TUI CLI (e.g.
 * Copilot CLI): boxed panels, braille spinners, streaming colored text, status
 * lines, full-screen redraws and large unique-glyph floods.
 *
 * Everything here is seeded/precomputed and contains NO `Math.random`, `Date`
 * or other non-determinism, so the produced byte streams are stable across runs
 * and machines. This lets WebGL/atlas stress tests assert exact render results.
 */

/** A tiny deterministic PRNG (mulberry32) so "random-looking" output is stable. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const BRAILLE_SPINNER = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
const SGR_FG = [31, 32, 33, 34, 35, 36, 37, 90, 91, 92, 93, 94, 95, 96];
const WORDS = [
  'analyzing', 'repository', 'reading', 'TextureAtlas', 'rendering', 'glyph',
  'webgl', 'terminal', 'buffer', 'scrollback', 'tokenizing', 'synthesizing',
  'patch', 'diff', 'commit', 'validate', 'compile', 'searching', 'context'
];

/** Box-drawing characters (custom-glyph range that stresses the WebGL atlas). */
const BOX = { tl: '┌', tr: '┐', bl: '└', br: '┘', h: '─', v: '│' };

const CSI = '\x1b[';
const RESET = `${CSI}0m`;
const CLEAR_HOME = `${CSI}2J${CSI}H`;
const ENTER_ALT = `${CSI}?1049h`;
const EXIT_ALT = `${CSI}?1049l`;

export interface ISyntheticTuiOptions {
  /** PRNG seed for stable pseudo-random content. */
  seed?: number;
  /** Number of full-screen redraw frames to emit. */
  frames?: number;
  /** Terminal columns to format for. */
  cols?: number;
  /** Terminal rows to format for. */
  rows?: number;
  /** Wrap each frame in alternate-buffer enter/exit (TUI app behavior). */
  useAltBuffer?: boolean;
}

function pad(text: string, width: number): string {
  if (text.length >= width) {
    return text.slice(0, width);
  }
  return text + ' '.repeat(width - text.length);
}

function boxLine(kind: 'top' | 'bottom' | 'mid', content: string, width: number): string {
  const inner = Math.max(0, width - 2);
  if (kind === 'top') {
    return `${BOX.tl}${BOX.h.repeat(inner)}${BOX.tr}`;
  }
  if (kind === 'bottom') {
    return `${BOX.bl}${BOX.h.repeat(inner)}${BOX.br}`;
  }
  return `${BOX.v}${pad(content, inner)}${BOX.v}`;
}

/**
 * Generates an array of frame chunks that look like an animated agent TUI. Write
 * each chunk with a render in between to mimic streaming redraws. Each frame
 * clears the screen, redraws a bordered panel, a spinner, several colored
 * "assistant" lines and a status footer.
 * @param options Generation options.
 */
export function generateSyntheticTuiFrames(options: ISyntheticTuiOptions = {}): string[] {
  const seed = options.seed ?? 1;
  const frameCount = options.frames ?? 24;
  const cols = options.cols ?? 80;
  const rows = options.rows ?? 24;
  const rand = mulberry32(seed);

  const panelWidth = Math.min(cols, 72);
  const bodyRows = Math.max(3, rows - 6);
  const frames: string[] = [];

  for (let f = 0; f < frameCount; f++) {
    let frame = CLEAR_HOME;
    const spinner = BRAILLE_SPINNER[f % BRAILLE_SPINNER.length];
    frame += boxLine('top', '', panelWidth) + '\r\n';
    frame += boxLine('mid', ` ${spinner} Copilot is working...`, panelWidth) + '\r\n';
    frame += boxLine('bottom', '', panelWidth) + '\r\n';

    for (let r = 0; r < bodyRows; r++) {
      const fg = SGR_FG[Math.floor(rand() * SGR_FG.length)];
      const wordCount = 3 + Math.floor(rand() * 6);
      let line = '';
      for (let w = 0; w < wordCount; w++) {
        const word = WORDS[Math.floor(rand() * WORDS.length)];
        line += `${CSI}${fg}m${word}${RESET} `;
      }
      frame += line + '\r\n';
    }

    frame += `${CSI}2m── tokens ${1000 + f * 37} · ${spinner} streaming ──${RESET}`;
    frames.push(frame);
  }

  if (options.useAltBuffer) {
    frames[0] = ENTER_ALT + frames[0];
    frames[frames.length - 1] = frames[frames.length - 1] + EXIT_ALT;
  }
  return frames;
}

/**
 * Generates a single string that writes `count` distinct Unicode glyphs, wrapping
 * at `cols`. Distinct codepoints each need their own texture-atlas slot, so this
 * is the primary lever for forcing the atlas to allocate (and, with a low
 * `maxAtlasPages`, merge) pages.
 *
 * Codepoints are drawn deterministically from CJK Unified Ideographs
 * (U+4E00..U+9FFF), which provides 20,000+ unique, mono-width glyphs.
 * @param count Number of distinct glyphs to emit.
 * @param cols Columns to wrap at (CJK glyphs are width-2, so half this many per row).
 * @param offset Starting offset into the codepoint range, so consecutive chunks
 * emit non-overlapping distinct glyphs.
 */
export function generateUniqueGlyphFlood(count: number, cols: number = 80, offset: number = 0): string {
  const base = 0x4E00;
  const range = 0x9FFF - 0x4E00; // 20,991 unique codepoints
  const perRow = Math.max(1, Math.floor(cols / 2));
  let out = '';
  for (let i = 0; i < count; i++) {
    out += String.fromCodePoint(base + ((offset + i) % range));
    if ((i + 1) % perRow === 0) {
      out += '\r\n';
    }
  }
  return out;
}

/**
 * Generates a deterministic block of mixed "interesting" glyphs spanning the
 * ranges most likely to exercise the renderer: ASCII, box drawing, block
 * elements, braille and powerline symbols. Useful as a stable reference payload.
 * @param seed PRNG seed.
 * @param lines Number of lines to emit.
 * @param cols Approximate columns per line.
 */
export function generateMixedGlyphBlock(seed: number = 1, lines: number = 10, cols: number = 60): string {
  const rand = mulberry32(seed);
  const ranges: [number, number][] = [
    [0x21, 0x7E],      // printable ASCII
    [0x2500, 0x257F],  // box drawing
    [0x2580, 0x259F],  // block elements
    [0x2800, 0x28FF],  // braille
    [0x2190, 0x21FF]   // arrows
  ];
  let out = '';
  for (let l = 0; l < lines; l++) {
    for (let c = 0; c < cols; c++) {
      const [lo, hi] = ranges[Math.floor(rand() * ranges.length)];
      out += String.fromCodePoint(lo + Math.floor(rand() * (hi - lo)));
    }
    out += '\r\n';
  }
  return out;
}

/**
 * Emits ASCII letters/words each in a distinct 256-color foreground+background.
 * Every (char,color) pair is a unique atlas glyph, so this fills/merges atlas
 * pages with realistic English text (no CJK). Deterministic.
 * @param cells Number of colored cells to emit.
 * @param offset Color offset so consecutive chunks use new color combos.
 */
export function generateColoredAsciiFlood(cells: number, offset: number = 0): string {
  const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let out = '';
  for (let i = 0; i < cells; i++) {
    const ch = letters[(offset + i) % letters.length];
    const fg = (offset + i) % 256;
    const bg = (offset + i * 7) % 256;
    out += `\x1b[38;5;${fg}m\x1b[48;5;${bg}m${ch}`;
    if ((i + 1) % 78 === 0) { out += '\x1b[0m\r\n'; }
  }
  return out + '\x1b[0m';
}
