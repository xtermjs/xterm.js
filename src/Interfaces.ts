/**
 * xterm.js: xterm, in the browser
 * Copyright (c) 2014-2016, SourceLair Private Company (www.sourcelair.com (MIT License)
 */

export interface ITerminal {
  rowContainer: HTMLElement;
  ydisp: number;
  lines: string[];
  rows: number;

  on(event: string, callback: () => void);
  scrollDisp(disp: number, suppressScrollEvent: boolean);
}
