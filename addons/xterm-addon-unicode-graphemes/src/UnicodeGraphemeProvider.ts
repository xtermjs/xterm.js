/**
 * Copyright (c) 2023 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import { IUnicodeVersionProvider } from 'xterm';
import { UnicodeCharProperties, UnicodeCharWidth } from 'common/services/Services';
import { UnicodeService } from 'common/services/UnicodeService';
import * as UC from './UnicodeProperties';

export class UnicodeGraphemeProvider implements IUnicodeVersionProvider {
  public readonly version = '15-graphemes';
  public ambiguousCharsAreWide: boolean = false;
  constructor() {
  }

  public charProperties(codepoint: number, preceding: UnicodeCharProperties): UnicodeCharProperties {
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
      charInfo = UC.shouldJoin(UnicodeService.extractCharKind(preceding), charInfo);
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
    return (kind === UC.GRAPHEME_BREAK_Extend || kind === UC.GRAPHEME_BREAK_Prepend) ? 0
      : (w >= 2 && (w === 3 || this.ambiguousCharsAreWide)) ? 2 : 1;
  }
}
