/**
 * Copyright (c) 2018 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import type { Terminal } from '@xterm/xterm';
import { Font } from 'font-ligatures';

import load from './font';

const enum LoadingState {
  UNLOADED,
  LOADING,
  LOADED,
  FAILED
}

// Caches 100K characters worth of ligatures. In practice this works out to
// about 650 KB worth of cache, when a moderate number of ligatures are present.
const CACHE_SIZE = 100000;

/**
 * Enable ligature support for the provided Terminal instance. To function
 * properly, this must be called after `open()` is called on the therminal. If
 * the font currently in use supports ligatures, the terminal will automatically
 * start to render them.
 * @param term Terminal instance from xterm.js
 */
export function enableLigatures(term: Terminal, fallbackLigatures: string[] = []): number {
  let currentFontName: string | undefined = undefined;
  let font: Font | undefined = undefined;
  let loadingState: LoadingState = LoadingState.UNLOADED;
  let loadError: any | undefined = undefined;

  return term.registerCharacterJoiner((text: string): [number, number][] => {
    // If the font hasn't been loaded yet, load it and return an empty result
    const termFont = term.options.fontFamily;
    if (
      termFont &&
      (loadingState === LoadingState.UNLOADED || currentFontName !== termFont)
    ) {
      font = undefined;
      loadingState = LoadingState.LOADING;
      currentFontName = termFont;
      const currentCallFontName = currentFontName;

      load(currentCallFontName, CACHE_SIZE)
        .then(f => {
          // Another request may have come in while we were waiting, so make
          // sure our font is still vaild.
          if (currentCallFontName === term.options.fontFamily) {
            loadingState = LoadingState.LOADED;
            font = f;

            // Only refresh things if we actually found a font
            if (f) {
              term.refresh(0, term.rows - 1);
            }
          }
        })
        .catch(e => {
          // Another request may have come in while we were waiting, so make
          // sure our font is still vaild.
          if (currentCallFontName === term.options.fontFamily) {
            loadingState = LoadingState.FAILED;
            if (term.options.logLevel === 'debug') {
              console.debug(loadError, new Error('Failure while loading font'));
            }
            font = undefined;
            loadError = e;
          }
        });
    }

    if (font && loadingState === LoadingState.LOADED) {
      // We clone the entries to avoid the internal cache of the ligature finder
      // getting messed up.
      return font.findLigatureRanges(text).map<[number, number]>(
        range => [range[0], range[1]]
      );
    }

    return getFallbackRanges(text, fallbackLigatures);
  });
}

function getFallbackRanges(text: string, fallbackLigatures: string[]): [number, number][] {
  const ranges: [number, number][] = [];
  for (let i = 0; i < text.length; i++) {
    for (let j = 0; j < fallbackLigatures.length; j++) {
      if (text.startsWith(fallbackLigatures[j], i)) {
        ranges.push([i, i + fallbackLigatures[j].length]);
        i += fallbackLigatures[j].length - 1;
        break;
      }
    }
  }
  return ranges;
}
