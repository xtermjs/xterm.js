/**
 * Copyright (c) 2024 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import type { Terminal, ITerminalAddon } from '@xterm/xterm';
import type { WebFontsAddon as IWebFontsApi } from '@xterm/addon-web-fonts';


/**
 * Unquote a font family name.
 */
function unquote(s: string): string {
  if (s[0] === '"' && s[s.length - 1] === '"') return s.slice(1, -1);
  if (s[0] === '\'' && s[s.length - 1] === '\'') return s.slice(1, -1);
  return s;
}


/**
 * Quote a font family name conditionally.
 * @see https://mathiasbynens.be/notes/unquoted-font-family
 */
function quote(s: string): string {
  const pos = s.match(/([-_a-zA-Z0-9\xA0-\u{10FFFF}]+)/u);
  const neg = s.match(/^(-?\d|--)/m);
  if (!neg && pos && pos[1] === s) return s;
  return `"${s.replace(/"/g, '\\"')}"`;
}


function splitFamily(family: string | undefined): string[] {
  if (!family) return [];
  return family.split(',').map(e => unquote(e.trim()));
}


function createFamily(families: string[]): string {
  return families.map(quote).join(', ');
}


/**
 * Hash a font face from it properties.
 * Used in `loadFonts` to avoid bloating
 * `document.fonts` from multiple calls.
 */
function hashFontFace(ff: FontFace): string {
  return JSON.stringify([
    unquote(ff.family),
    ff.stretch,
    ff.style,
    ff.unicodeRange,
    ff.weight
  ]);
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
function _loadFonts(fonts?: (string | FontFace)[]): Promise<FontFace[]> {
  const ffs = Array.from(document.fonts);
  if (!fonts || !fonts.length) {
    return Promise.all(ffs.map(ff => ff.load()));
  }
  let toLoad: FontFace[] = [];
  const ffsHashed = ffs.map(ff => hashFontFace(ff));
  for (const font of fonts) {
    if (font instanceof FontFace) {
      const fontHashed = hashFontFace(font);
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
        return Promise.reject(`font family "${font}" not registered in document.fonts`);
      }
    }
  }
  return Promise.all(toLoad.map(ff => ff.load()));
}


export function loadFonts(fonts?: (string | FontFace)[]): Promise<FontFace[]> {
  return document.fonts.ready.then(() => _loadFonts(fonts));
}


export class WebFontsAddon implements ITerminalAddon, IWebFontsApi {
  private _term: Terminal | undefined;

  constructor(public initialRelayout: boolean = true) { }

  public dispose(): void {
    this._term = undefined;
  }

  public activate(term: Terminal): void {
    this._term = term;
    if (this.initialRelayout) {
      document.fonts.ready.then(() => this.relayout());
    }
  }

  public loadFonts(fonts?: (string | FontFace)[]): Promise<FontFace[]> {
    return loadFonts(fonts);
  }

  public async relayout(): Promise<void> {
    if (!this._term) {
      return;
    }
    await document.fonts.ready;
    const family = this._term.options.fontFamily;
    const families = splitFamily(family);
    const webFamilies = Array.from(new Set(Array.from(document.fonts).map(e => unquote(e.family))));
    const dirty: string[] = [];
    const clean: string[] = [];
    for (const fam of families) {
      (webFamilies.indexOf(fam) !== -1 ? dirty : clean).push(fam);
    }
    if (!dirty.length) {
      return;
    }
    await _loadFonts(dirty);
    if (this._term) {
      this._term.options.fontFamily = clean.length ? createFamily(clean) : 'monospace';
      this._term.options.fontFamily = family;
    }
  }
}
