/**
 * Copyright (c) 2017 The xterm.js authors. All rights reserved.
 * @license MIT
 */


import { Terminal, IDisposable, ILinkMatcherOptions } from 'xterm';

declare module 'xterm-addon-web-links' {
  // TODO: This is temporary, link to xterm when the new version is published
  export interface ITerminalAddon extends IDisposable {
    activate(terminal: Terminal): void;
  }

  /**
   * An xterm.js addon that enables web links.
   */
  export class WebLinksAddon implements ITerminalAddon {
    /**
     * Creates a new web links addon.
     * @param handler The callback when the link is called.
     * @param options Options for the link matcher.
     */
    constructor(handler?: (event: MouseEvent, uri: string) => void, options?: ILinkMatcherOptions);

    /**
     * Activates the addon
     * @param terminal The terminal the addon is being loaded in.
     */
    public activate(terminal: Terminal): void;

    /**
     * Disposes the addon.
     */
    public dispose(): void;
  }
}
