/**
 * Copyright (c) 2018 The xterm.js authors. All rights reserved.
 * @license MIT
 *
 * This file is the entry point for browserify.
 */

import type { ImageAddon } from '@xterm/addon-image';
import type { AttachAddon } from '@xterm/addon-attach';
import type { ClipboardAddon } from '@xterm/addon-clipboard';
import type { FitAddon } from '@xterm/addon-fit';
import type { LigaturesAddon } from '@xterm/addon-ligatures';
import type { ProgressAddon } from '@xterm/addon-progress';
import type { SearchAddon } from '@xterm/addon-search';
import type { SerializeAddon } from '@xterm/addon-serialize';
import type { UnicodeGraphemesAddon } from '@xterm/addon-unicode-graphemes';
import type { Unicode11Addon } from '@xterm/addon-unicode11';
import type { WebLinksAddon } from '@xterm/addon-web-links';
import type { WebglAddon } from '@xterm/addon-webgl';

export type AddonType = 'attach' | 'clipboard' | 'fit' | 'image' | 'progress' | 'search' | 'serialize' | 'unicode11' | 'unicodeGraphemes' | 'webLinks' | 'webgl' | 'ligatures';

export interface IDemoAddon<T extends AddonType> {
  name: T;
  canChange: boolean;
  ctor: (
    T extends 'attach' ? typeof AttachAddon :
      T extends 'clipboard' ? typeof ClipboardAddon :
        T extends 'fit' ? typeof FitAddon :
          T extends 'image' ? typeof ImageAddon :
            T extends 'ligatures' ? typeof LigaturesAddon :
              T extends 'progress' ? typeof ProgressAddon :
                T extends 'search' ? typeof SearchAddon :
                  T extends 'serialize' ? typeof SerializeAddon :
                    T extends 'webLinks' ? typeof WebLinksAddon :
                      T extends 'unicode11' ? typeof Unicode11Addon :
                        T extends 'unicodeGraphemes' ? typeof UnicodeGraphemesAddon :
                          T extends 'webgl' ? typeof WebglAddon :
                            never
  );
  instance?: (
    T extends 'attach' ? AttachAddon :
      T extends 'clipboard' ? ClipboardAddon :
        T extends 'fit' ? FitAddon :
          T extends 'image' ? ImageAddon :
            T extends 'ligatures' ? LigaturesAddon :
              T extends 'progress' ? ProgressAddon :
                T extends 'search' ? SearchAddon :
                  T extends 'serialize' ? SerializeAddon :
                    T extends 'webLinks' ? WebLinksAddon :
                      T extends 'unicode11' ? Unicode11Addon :
                        T extends 'unicodeGraphemes' ? UnicodeGraphemesAddon :
                          T extends 'webgl' ? WebglAddon :
                            never
  );
}

export type AddonCollection = { [T in AddonType]: IDemoAddon<T> };
