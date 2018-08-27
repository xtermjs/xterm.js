/**
 * Copyright (c) 2017 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import { Terminal } from 'xterm';
import { IWinptyCompatAddonTerminal } from './Interfaces';

const CHAR_DATA_CODE_INDEX = 3;
const NULL_CELL_CODE = 32;

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
    const line = addonTerminal._core.buffer.lines.get(addonTerminal._core.buffer.ybase + addonTerminal._core.buffer.y - 1);
    const lastChar = line.get(addonTerminal.cols - 1);

    if (lastChar[CHAR_DATA_CODE_INDEX] !== NULL_CELL_CODE) {
      const nextLine = addonTerminal._core.buffer.lines.get(addonTerminal._core.buffer.ybase + addonTerminal._core.buffer.y);
      nextLine.isWrapped = true;
    }
  });
}

export function apply(terminalConstructor: typeof Terminal): void {
  (<any>terminalConstructor.prototype).winptyCompatInit = function (): void {
    winptyCompatInit(this);
  };
}
