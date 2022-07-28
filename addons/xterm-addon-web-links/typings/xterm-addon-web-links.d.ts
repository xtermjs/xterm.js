/**
 * Copyright (c) 2017 The xterm.js authors. All rights reserved.
 * @license MIT
 */


import { Terminal, ITerminalAddon, IViewportRange } from 'xterm';

declare module 'xterm-addon-web-links' {
  /**
   * An xterm.js addon that enables web links.
   */
  export class WebLinksAddon implements ITerminalAddon {
    /**
     * Creates a new web links addon.
     * @param handler The callback when the link is called.
     * @param options Options for the link provider.
     */
    constructor(handler?: (event: MouseEvent, uri: string) => void, options?: ILinkProviderOptions);

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

  /**
   * An object containing options for a link provider.
   */
  export interface ILinkProviderOptions {
    /**
     * A callback that fires when the mouse hovers over a link.
     */
    hover?(event: MouseEvent, text: string, location: IViewportRange): void;

    /**
     * A callback that fires when the mouse leaves a link. Note that this can
     * happen even when tooltipCallback hasn't fired for the link yet.
     */
    leave?(event: MouseEvent, text: string): void;

    /**
     * A callback to use instead of the default one.
    */
    urlRegex?: RegExp;
  }
}
