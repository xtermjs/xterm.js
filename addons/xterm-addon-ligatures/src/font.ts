/**
 * Copyright (c) 2018 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import { Font, loadBuffer } from 'font-ligatures';

import parse from './parse';

interface IFontMetadata {
  family: string;
  fullName: string;
  postscriptName: string;
  blob: () => Promise<Blob>;
}

interface IFontAccessNavigator {
  fonts: {
    query: () => Promise<IFontMetadata[]>;
  };
  permissions: {
    request?: (permission: { name: string }) => Promise<{state: string}>;
  };
}

let fontsPromise: Promise<Record<string, IFontMetadata[]>> | undefined = undefined;

/**
 * Loads the font ligature wrapper for the specified font family if it could be
 * resolved, throwing if it is unable to find a suitable match.
 * @param fontFamily The CSS font family definition to resolve
 * @param cacheSize The size of the ligature cache to maintain if the font is resolved
 */
export default async function load(fontFamily: string, cacheSize: number): Promise<Font | undefined> {
  if (!fontsPromise) {
    // Web environment that supports font access API
    if (typeof navigator !== 'undefined' && 'fonts' in navigator) {
      try {
        const status = await (navigator as unknown as IFontAccessNavigator).permissions.request?.({
          name: 'local-fonts'
        });
        if (status && status.state !== 'granted') {
          throw new Error('Permission to access local fonts not granted.');
        }
      } catch (err: any) {
        // A `TypeError` indicates the 'local-fonts'
        // permission is not yet implemented, so
        // only `throw` if this is _not_ the problem.
        if (err.name !== 'TypeError') {
          throw err;
        }
      }
      const fonts: Record<string, IFontMetadata[]> = {};
      try {
        const fontsIterator = await (navigator as unknown as IFontAccessNavigator).fonts.query();
        for (const metadata of fontsIterator) {
          if (!fonts.hasOwnProperty(metadata.family)) {
            fonts[metadata.family] = [];
          }
          fonts[metadata.family].push(metadata);
        }
        fontsPromise = Promise.resolve(fonts);
      } catch (err: any) {
        console.error(err.name, err.message);
      }
    }
    // Latest proposal https://bugs.chromium.org/p/chromium/issues/detail?id=1312603
    else if (typeof window !== 'undefined' && 'queryLocalFonts' in window) {
      const fonts: Record<string, IFontMetadata[]> = {};
      try {
        const fontsIterator = await (window as any).queryLocalFonts();
        for (const metadata of fontsIterator) {
          if (!fonts.hasOwnProperty(metadata.family)) {
            fonts[metadata.family] = [];
          }
          fonts[metadata.family].push(metadata);
        }
        fontsPromise = Promise.resolve(fonts);
      } catch (err: any) {
        console.error(err.name, err.message);
      }
    }
    if (!fontsPromise) {
      fontsPromise = Promise.resolve({});
    }
  }

  const fonts = await fontsPromise;
  for (const family of parse(fontFamily)) {
    // If we reach one of the generic font families, the font resolution
    // will end for the browser and we can't determine the specific font
    // used. Throw.
    if (genericFontFamilies.includes(family)) {
      return undefined;
    }

    if (fonts.hasOwnProperty(family) && fonts[family].length > 0) {
      const font = fonts[family][0];
      if ('blob' in font) {
        const bytes = await font.blob();
        const buffer = await bytes.arrayBuffer();
        return loadBuffer(buffer, { cacheSize });
      }
      return undefined;
    }
  }

  // If none of the fonts could resolve, throw an error
  return undefined;
}

// https://drafts.csswg.org/css-fonts-4/#generic-font-families
const genericFontFamilies = [
  'serif',
  'sans-serif',
  'cursive',
  'fantasy',
  'monospace',
  'system-ui',
  'emoji',
  'math',
  'fangsong'
];
