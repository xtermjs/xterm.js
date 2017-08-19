/// <reference path="../../typings/xterm.d.ts" />

import { Terminal } from 'xterm';

namespace constructor_tests {
  {
    new Terminal();
    new Terminal({});
    new Terminal({
      cols: 1,
      rows: 1
    });
    new Terminal({
      'cols': 1,
      'cursorBlink': true,
      'cursorStyle': 'block',
      'disableStdin': false,
      'rows': 1,
      'scrollback': 10,
      'tabStopWidth': 2,
    });
  }
}
