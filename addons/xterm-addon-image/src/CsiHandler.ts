/**
 * Copyright (c) 2020 The xterm.js authors. All rights reserved.
 * @license MIT
 *
 */

import { IImageAddonOptions } from './Types';


export function decsetImage(opts: IImageAddonOptions) {
  return function (params: (number | number[])[]) {
    for (let i = 0; i < params.length; ++i) {
      switch (params[i]) {
        case 80:
          opts.sixelScrolling = true;
          break;
        case 1070:
          opts.sixelPrivatePalette = true;
          break;
        case 8452:
          opts.cursorRight = true;
          break;
        case 7730:
          opts.cursorBelow = true;
          break;
      }
    }
    return false;
  };
}

export function decrstImage(opts: IImageAddonOptions) {
  return function (params: (number | number[])[]) {
    for (let i = 0; i < params.length; ++i) {
      switch (params[i]) {
        case 80:
          opts.sixelScrolling = false;
          break;
        case 1070:
          opts.sixelPrivatePalette = false;
          break;
        case 8452:
          opts.cursorRight = false;
          break;
        case 7730:
          opts.cursorBelow = false;
          break;
      }
    }
    return false;
  };
}
