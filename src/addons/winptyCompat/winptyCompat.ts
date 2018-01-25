/**
 * Copyright (c) 2017 The xterm.js authors. All rights reserved.
 * @license MIT
 */

/// <reference path="../../../typings/xterm.d.ts"/>

import { Terminal } from 'xterm';
import { IWinptyCompatAddonTerminal } from './Interfaces';

export function winptyCompatInit(terminal: Terminal): void {
  const addonTerminal = <IWinptyCompatAddonTerminal>terminal;

  // Don't do anything when the platform is not Windows
  const isWindows = ['Windows', 'Win16', 'Win32', 'WinCE'].indexOf(navigator.platform) >= 0;
  if (!isWindows) {
    return;
  }

  // Winpty does not support wraparound mode which means that lines will never
  // be marked as wrapped. This causes issues for things like copying a line
  // retaining the wrapped new line characters or if consumers are listening
  // in on the data stream.
  //
  // The workaround for this is to listen to every incoming line feed and mark
  // the line as wrapped if the last character in the previous line is not a
  // space. This is certainly not without its problems, but generally on
  // Windows when text reaches the end of the terminal it's likely going to be
  // wrapped.
  addonTerminal.on('linefeed', () => {
    const line = addonTerminal.buffer.lines.get(addonTerminal.buffer.ybase + addonTerminal.buffer.y - 1);
    const lastChar = line[addonTerminal.cols - 1];

    if (lastChar[3] !== 32 /* ' ' */) {
      const nextLine = addonTerminal.buffer.lines.get(addonTerminal.buffer.ybase + addonTerminal.buffer.y);
      (<any>nextLine).isWrapped = true;
    }
  });
}

export function apply(terminalConstructor: typeof Terminal): void {
  (<any>terminalConstructor.prototype).winptyCompatInit = function (): void {
    winptyCompatInit(this);
  };
}
