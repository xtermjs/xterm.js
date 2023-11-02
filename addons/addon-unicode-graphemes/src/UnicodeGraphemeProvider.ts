/**
 * Copyright (c) 2023 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import { IUnicodeVersionProvider } from '@xterm/xterm';
import { UnicodeCharProperties, UnicodeCharWidth } from 'common/services/Services';
import { UnicodeService } from 'common/services/UnicodeService';
import * as UC from './third-party/UnicodeProperties';

export class UnicodeGraphemeProvider implements IUnicodeVersionProvider {
  public readonly version;
  public ambiguousCharsAreWide: boolean = false;
  public readonly handleGraphemes: boolean;

  constructor(handleGraphemes: boolean = true) {
    this.version = handleGraphemes ? '15-graphemes' : '15';
    this.handleGraphemes = handleGraphemes;
  }

  private static readonly _plainNarrowProperties: UnicodeCharProperties
    = UnicodeService.createPropertyValue(UC.GRAPHEME_BREAK_Other, 1, false);

  public charProperties(codepoint: number, preceding: UnicodeCharProperties): UnicodeCharProperties {
    // Optimize the simple ASCII case, under the condition that
    // UnicodeService.extractCharKind(preceding) === GRAPHEME_BREAK_Other
    // (which also covers the case that preceding === 0).
    if ((codepoint >= 32 && codepoint < 127) && (preceding >> 3) === 0) {
      return UnicodeGraphemeProvider._plainNarrowProperties;
    }

    let charInfo = UC.getInfo(codepoint);
    let w = UC.infoToWidthInfo(charInfo);
    let shouldJoin = false;
    if (w >= 2) {
      // Treat emoji_presentation_selector as WIDE.
      w = w === 3 || this.ambiguousCharsAreWide || codepoint === 0xfe0f ? 2 : 1;
    } else {
      w = 1;
    }
    if (preceding !== 0) {
      const oldWidth = UnicodeService.extractWidth(preceding);
      if (this.handleGraphemes) {
        charInfo = UC.shouldJoin(UnicodeService.extractCharKind(preceding), charInfo);
      } else {
        charInfo = w === 0 ? 1 : 0;
      }
      shouldJoin = charInfo > 0;
      if (shouldJoin) {
        if (oldWidth > w) {
          w = oldWidth;
        } else if (charInfo === 32) { // UC.GRAPHEME_BREAK_SAW_Regional_Pair)
          w = 2;
        }
      }
    }
    return UnicodeService.createPropertyValue(charInfo, w, shouldJoin);
  }

  public wcwidth(codepoint: number): UnicodeCharWidth {
    const charInfo = UC.getInfo(codepoint);
    const w = UC.infoToWidthInfo(charInfo);
    const kind = (charInfo & UC.GRAPHEME_BREAK_MASK) >> UC.GRAPHEME_BREAK_SHIFT;
    if (kind === UC.GRAPHEME_BREAK_Extend || kind === UC.GRAPHEME_BREAK_Prepend) {
      return 0;
    }
    if (w >= 2 && (w === 3 || this.ambiguousCharsAreWide)) {
      return 2;
    }
    return 1;
  }
}
