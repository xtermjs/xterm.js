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

  constructor() {
  }

  charProperties(codepoint: number, preceding: UnicodeCharProperties): UnicodeCharProperties {
    let charInfo = UC.getInfo(codepoint);
    let w = UC.infoToWidthInfo(charInfo);
    let shouldJoin = false;
    if (w >= 2) {
      const preferWide = false; //this.ambiguousCharsAreWide(context);
      // Treat emoji_presentation_selector as WIDE.
      w = w == 3 || preferWide || codepoint === 0xfe0f ? 2 : 1;
    } else
      w = 1;
    if (preceding !== 0) {
      let oldWidth = UnicodeService.extractWidth(preceding);
      charInfo = UC.shouldJoin(UnicodeService.extractCharKind(preceding), charInfo);
      shouldJoin = charInfo > 0;
      if (shouldJoin) {
        if (oldWidth > w)
          w = oldWidth;
          else if (charInfo === 32) // FIXME UC.GRAPHEME_BREAK_SAW_Regional_Pair)
          w = 2;
      }
    }
    return UnicodeService.createPropertyValue(charInfo, w, shouldJoin);
  }

  public wcwidth(num: number): UnicodeCharWidth {
    return UC.infoToWidth(UC.getInfo(num));
  }
}
