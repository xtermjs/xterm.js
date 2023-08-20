/**
 * Copyright (c) 2020 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import { Attributes, BgFlags, Content, ExtFlags, UnderlineStyle } from 'common/buffer/Constants';

// export some privates for local usage
export { Attributes, BgFlags, Content, ExtFlags, UnderlineStyle };

export const enum Cell {
  CONTENT = 0,  // codepoint and wcwidth information (enum Content)
  FG = 1,       // foreground color in lower 3 bytes (rgb), attrs in 4th byte (enum FgFlags)
  BG = 2,       // background color in lower 3 bytes (rgb), attrs in 4th byte (enum BgFlags)
  SIZE = 3      // size of single cell on buffer array
}
