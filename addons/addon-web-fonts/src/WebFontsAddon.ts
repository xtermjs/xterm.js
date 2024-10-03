/**
 * Copyright (c) 2024 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import type { Terminal, ITerminalAddon } from '@xterm/xterm';
import type { WebFontsAddon as IWebFontsApi } from '@xterm/addon-web-fonts';


/**
 * Unquote family name.
 */
function unquote(s: string): string {
  if (s[0] === '"' && s[s.length - 1] === '"') return s.slice(1, -1);
  if (s[0] === '\'' && s[s.length - 1] === '\'') return s.slice(1, -1);
  return s;
}


/**
 * Quote family name.
 * @see https://mathiasbynens.be/notes/unquoted-font-family
 */
function quote(s: string): string {
  const pos = s.match(/([-_a-zA-Z0-9\xA0-\u{10FFFF}]+)/u);
  const neg = s.match(/^(-?\d|--)/m);
  if (!neg && pos && pos[1] === s) return s;
  return `"${s.replace('"', '\\"')}"`;
}


function splitFamily(family: string | undefined): string[] {
  if (!family) return [];
  return family.split(',').map(e => unquote(e.trim()));
}


function createFamily(families: string[]): string {
  return families.map(quote).join(', ');
}


function _loadFonts(fonts?: (string | FontFace)[]): Promise<FontFace[]> {
  const ffs = Array.from(document.fonts);
  if (!fonts || !fonts.length) {
    return Promise.all(ffs.map(ff => ff.load()));
  }
  let toLoad: FontFace[] = [];
  const ffsHashed = ffs.map(ff => WebFontsAddon.hashFontFace(ff));
  for (const font of fonts) {
    if (font instanceof FontFace) {
      const fontHashed = WebFontsAddon.hashFontFace(font);
      const idx = ffsHashed.indexOf(fontHashed);
      if (idx === -1) {
        document.fonts.add(font);
        ffs.push(font);
        ffsHashed.push(fontHashed);
        toLoad.push(font);
      } else {
        toLoad.push(ffs[idx]);
      }
    } else {
      // string as font
      const familyFiltered = ffs.filter(ff => font === unquote(ff.family));
      toLoad = toLoad.concat(familyFiltered);
      if (!familyFiltered.length) {
        console.warn(`font family "${font}" not registered in document.fonts`);
      }
    }
  }
  return Promise.all(toLoad.map(ff => ff.load()));
}



export class WebFontsAddon implements ITerminalAddon, IWebFontsApi {
  constructor(public forceInitialRelayout: boolean = true) { }
  public dispose(): void { }

  public activate(terminal: Terminal): void {
    if (this.forceInitialRelayout) {
      document.fonts.ready.then(() => this.relayout(terminal));
    }
  }

  /**
   * Force a terminal re-layout by altering `options.FontFamily`.
   *
   * Found webfonts in `fontFamily` are temporarily removed until the webfont
   * resources are fully loaded.
   *
   * This method is meant as a fallback fix for sloppy integrations,
   * that wrongly placed a webfont at the terminal contructor options.
   * It is likely to lead to terminal flickering in all browsers (FOUT).
   *
   * To avoid triggering this fallback in your integration, make sure to have
   * the needed webfonts loaded at the time `terminal.open` is called.
   */
  public relayout(terminal: Terminal): void {
    const family = terminal.options.fontFamily;
    const families = splitFamily(family);
    const webFamilies = WebFontsAddon.getFontFamilies();
    const dirty: string[] = [];
    const clean: string[] = [];
    for (const fam of families) {
      (webFamilies.indexOf(fam) !== -1 ? dirty : clean).push(fam);
    }
    if (dirty.length) {
      _loadFonts(dirty).then(() => {
        terminal.options.fontFamily = clean.length ? createFamily(clean) : 'monospace';
        terminal.options.fontFamily = family;
      });
    }
  }

  /**
   * Hash a font face from it properties.
   * Used in `loadFonts` to avoid bloating
   * `document.fonts` from multiple calls.
   */
  public static hashFontFace(ff: FontFace): string {
    return JSON.stringify([
      unquote(ff.family),
      ff.stretch,
      ff.style,
      ff.unicodeRange,
      ff.weight
    ]);
  }

  /**
   * Return font families known in `document.fonts`.
   */
  public static getFontFamilies(): string[] {
    return Array.from(new Set(Array.from(document.fonts).map(e => unquote(e.family))));
  }

  /**
   * Wait for webfont resources to be loaded.
   *
   * Without any argument, all fonts currently listed in
   * `document.fonts` will be loaded.
   * For a more fine-grained loading strategy you can populate
   * the `fonts` argument with:
   * - font families      :   loads all fontfaces in `document.fonts`
   *                          matching the family names
   * - fontface objects   :   loads given fontfaces and adds them to
   *                          `document.fonts`
   *
   * The returned promise will resolve, when all loading is done.
   */
  public static loadFonts(fonts?: (string | FontFace)[]): Promise<FontFace[]> {
    return document.fonts.ready.then(() => _loadFonts(fonts));
  }
}







/* eslint-disable */
// TODO: place into test cases
/*
(window as any).__roboto = [
  // cyrillic-ext
  new FontFace(
    'Roboto Mono',
    "url(https://fonts.gstatic.com/s/robotomono/v23/L0x7DF4xlVMF-BfR8bXMIjhOm3CWWoKC.woff2) format('woff2')",
    {
      style: 'italic',
      weight: '100 700',
      display: 'swap',
      unicodeRange: 'U+0460-052F, U+1C80-1C88, U+20B4, U+2DE0-2DFF, U+A640-A69F, U+FE2E-FE2F'
    }
  ),
  // cyrillic
  new FontFace(
    'Roboto Mono',
    "url(https://fonts.gstatic.com/s/robotomono/v23/L0x7DF4xlVMF-BfR8bXMIjhOm3mWWoKC.woff2) format('woff2')",
    {
      style: 'italic',
      weight: '100 700',
      display: 'swap',
      unicodeRange: 'U+0301, U+0400-045F, U+0490-0491, U+04B0-04B1, U+2116'
    }
  ),
  // greek
  new FontFace(
    'Roboto Mono',
    "url(https://fonts.gstatic.com/s/robotomono/v23/L0x7DF4xlVMF-BfR8bXMIjhOm36WWoKC.woff2) format('woff2')",
    {
      style: 'italic',
      weight: '100 700',
      display: 'swap',
      unicodeRange: 'U+0370-0377, U+037A-037F, U+0384-038A, U+038C, U+038E-03A1, U+03A3-03FF'
    }
  ),
  // vietnamese
  new FontFace(
    'Roboto Mono',
    "url(https://fonts.gstatic.com/s/robotomono/v23/L0x7DF4xlVMF-BfR8bXMIjhOm3KWWoKC.woff2) format('woff2')",
    {
      style: 'italic',
      weight: '100 700',
      display: 'swap',
      unicodeRange: 'U+0102-0103, U+0110-0111, U+0128-0129, U+0168-0169, U+01A0-01A1, U+01AF-01B0, U+0300-0301, U+0303-0304, U+0308-0309, U+0323, U+0329, U+1EA0-1EF9, U+20AB'
    }
  ),
  // latin-ext
  new FontFace(
    'Roboto Mono',
    "url(https://fonts.gstatic.com/s/robotomono/v23/L0x7DF4xlVMF-BfR8bXMIjhOm3OWWoKC.woff2) format('woff2')",
    {
      style: 'italic',
      weight: '100 700',
      display: 'swap',
      unicodeRange: 'U+0100-02AF, U+0304, U+0308, U+0329, U+1E00-1E9F, U+1EF2-1EFF, U+2020, U+20A0-20AB, U+20AD-20C0, U+2113, U+2C60-2C7F, U+A720-A7FF'
    }
  ),
  // latin
  new FontFace(
    'Roboto Mono',
    "url(https://fonts.gstatic.com/s/robotomono/v23/L0x7DF4xlVMF-BfR8bXMIjhOm32WWg.woff2) format('woff2')",
    {
      style: 'italic',
      weight: '100 700',
      display: 'swap',
      unicodeRange: 'U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+2074, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD'
    }
  ),
  // cyrillic-ext
  new FontFace(
    'Roboto Mono',
    "url(https://fonts.gstatic.com/s/robotomono/v23/L0x5DF4xlVMF-BfR8bXMIjhGq3-OXg.woff2) format('woff2')",
    {
      style: 'normal',
      weight: '100 700',
      display: 'swap',
      unicodeRange: 'U+0460-052F, U+1C80-1C88, U+20B4, U+2DE0-2DFF, U+A640-A69F, U+FE2E-FE2F'
    }
  ),
  // cyrillic
  new FontFace(
    'Roboto Mono',
    "url(https://fonts.gstatic.com/s/robotomono/v23/L0x5DF4xlVMF-BfR8bXMIjhPq3-OXg.woff2) format('woff2')",
    {
      style: 'normal',
      weight: '100 700',
      display: 'swap',
      unicodeRange: 'U+0301, U+0400-045F, U+0490-0491, U+04B0-04B1, U+2116'
    }
  ),
  // greek
  new FontFace(
    'Roboto Mono',
    "url(https://fonts.gstatic.com/s/robotomono/v23/L0x5DF4xlVMF-BfR8bXMIjhIq3-OXg.woff2) format('woff2')",
    {
      style: 'normal',
      weight: '100 700',
      display: 'swap',
      unicodeRange: 'U+0370-0377, U+037A-037F, U+0384-038A, U+038C, U+038E-03A1, U+03A3-03FF'
    }
  ),
  // vietnamese
  new FontFace(
    'Roboto Mono',
    "url(https://fonts.gstatic.com/s/robotomono/v23/L0x5DF4xlVMF-BfR8bXMIjhEq3-OXg.woff2) format('woff2')",
    {
      style: 'normal',
      weight: '100 700',
      display: 'swap',
      unicodeRange: 'U+0102-0103, U+0110-0111, U+0128-0129, U+0168-0169, U+01A0-01A1, U+01AF-01B0, U+0300-0301, U+0303-0304, U+0308-0309, U+0323, U+0329, U+1EA0-1EF9, U+20AB'
    }
  ),
  // latin-ext
  new FontFace(
    'Roboto Mono',
    "url(https://fonts.gstatic.com/s/robotomono/v23/L0x5DF4xlVMF-BfR8bXMIjhFq3-OXg.woff2) format('woff2')",
    {
      style: 'normal',
      weight: '100 700',
      display: 'swap',
      unicodeRange: 'U+0100-02AF, U+0304, U+0308, U+0329, U+1E00-1E9F, U+1EF2-1EFF, U+2020, U+20A0-20AB, U+20AD-20C0, U+2113, U+2C60-2C7F, U+A720-A7FF'
    }
  ),
  // latin
  new FontFace(
    'Roboto Mono',
    "url(https://fonts.gstatic.com/s/robotomono/v23/L0x5DF4xlVMF-BfR8bXMIjhLq38.woff2) format('woff2')",
    {
      style: 'normal',
      weight: '100 700',
      display: 'swap',
      unicodeRange: 'U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+2074, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD'
    }
  ),
];
*/
