/**
 * Copyright (c) 2019 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import { Terminal, ITerminalAddon, IDisposable } from 'xterm';
import { ILinkProviderOptions, WebLinkProvider } from './WebLinkProvider';

// consider everthing starting with http:// or https://
// up to first whitespace as url
// gets further narrowed down with URL later on
const strictUrlRegex = /https?:[/]{2}\S*/;

function handleLink(event: MouseEvent, uri: string): void {
  const newWindow = window.open();
  if (newWindow) {
    try {
      newWindow.opener = null;
    } catch {
      // no-op, Electron can throw
    }
    newWindow.location.href = uri;
  } else {
    console.warn('Opening link blocked as opener could not be cleared');
  }
}

export class WebLinksAddon implements ITerminalAddon {
  private _terminal: Terminal | undefined;
  private _linkProvider: IDisposable | undefined;

  constructor(
    private _handler: (event: MouseEvent, uri: string) => void = handleLink,
    private _options: ILinkProviderOptions = {}
  ) {
  }

  public activate(terminal: Terminal): void {
    this._terminal = terminal;
    const options = this._options as ILinkProviderOptions;
    const regex = options.urlRegex || strictUrlRegex;
    this._linkProvider = this._terminal.registerLinkProvider(new WebLinkProvider(this._terminal, regex, this._handler, options));
  }

  public dispose(): void {
    this._linkProvider?.dispose();
  }
}
