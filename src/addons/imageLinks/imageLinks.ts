/**
 * Copyright (c) 2017 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import { Terminal, ILinkMatcherOptions } from 'xterm';

function handleLink(event: MouseEvent, uri: string): void {
  const userAgent = navigator.userAgent.toLowerCase();
  if (userAgent.indexOf(' electron/') > -1) {
    window.open(uri, '_blank');
  } else {
    const win = window.open();
    win.document.body.innerHTML = '<img src=\'' + uri + '\'>';
  }
}

/**
 * Initialize the image links addon, registering the link matcher.
 * @param term The terminal to use image links within.
 * @param handler A custom handler to use.
 * @param options Custom options to use, matchIndex will always be ignored.
 */
export function imageLinksInit(term: Terminal, handler: (event: MouseEvent, uri: string) => void = handleLink, options: ILinkMatcherOptions = {}): void {
  options.matchIndex = 1;
  options.matchDataUrls = true;
  term.registerLinkMatcher(new RegExp('^data:image\\/(png|jpeg);'), handler, options);
}

export function apply(terminalConstructor: typeof Terminal): void {
  (<any>terminalConstructor.prototype).imageLinksInit = function (handler?: (event: MouseEvent, uri: string) => void, options?: ILinkMatcherOptions): void {
    imageLinksInit(this, handler, options);
  };
}
