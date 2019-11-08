/**
 * Copyright (c) 2019 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import { Terminal, ILinkMatcherOptions, ITerminalAddon, ILinkProvider, IDisposable } from 'xterm';
import { WebLinkProvider } from './WebLinkProvider';

const protocolClause = '(https?:\\/\\/)';
const domainCharacterSet = '[\\da-z\\.-]+';
const negatedDomainCharacterSet = '[^\\da-z\\.-]+';
const domainBodyClause = '(' + domainCharacterSet + ')';
const tldClause = '([a-z\\.]{2,6})';
const ipClause = '((\\d{1,3}\\.){3}\\d{1,3})';
const localHostClause = '(localhost)';
const portClause = '(:\\d{1,5})';
const hostClause = '((' + domainBodyClause + '\\.' + tldClause + ')|' + ipClause + '|' + localHostClause + ')' + portClause + '?';
const pathCharacterSet = '(\\/[\\/\\w\\.\\-%~:+]*)*([^:"\'\\s])';
const pathClause = '(' + pathCharacterSet + ')?';
const queryStringHashFragmentCharacterSet = '[0-9\\w\\[\\]\\(\\)\\/\\?\\!#@$%&\'*+,:;~\\=\\.\\-]*';
const queryStringClause = '(\\?' + queryStringHashFragmentCharacterSet + ')?';
const hashFragmentClause = '(#' + queryStringHashFragmentCharacterSet + ')?';
const negatedPathCharacterSet = '[^\\/\\w\\.\\-%]+';
const bodyClause = hostClause + pathClause + queryStringClause + hashFragmentClause;
const start = '(?:^|' + negatedDomainCharacterSet + ')(';
const end = ')($|' + negatedPathCharacterSet + ')';
const strictUrlRegex = new RegExp(start + protocolClause + bodyClause + end);

function handleLink(event: MouseEvent, uri: string): void {
  window.open(uri, '_blank');
}

export class WebLinksAddon implements ITerminalAddon {
  private _linkMatcherId: number | undefined;
  private _terminal: Terminal | undefined;
  private _linkProvider: IDisposable | undefined;

  constructor(
    private _handler: (event: MouseEvent, uri: string) => void = handleLink,
    private _options: ILinkMatcherOptions = {}
  ) {
    this._options.matchIndex = 1;
  }

  public activate(terminal: Terminal): void {
    this._terminal = terminal;

    if ('registerLinkProvider' in this._terminal) {
      this._linkProvider = this._terminal.registerLinkProvider(new WebLinkProvider(this._terminal, strictUrlRegex, this._handler));
    } else {
      // HACK: This is an older version of xterm.js, use registerLinkMatcher
      this._linkMatcherId = (<Terminal>this._terminal).registerLinkMatcher(strictUrlRegex, this._handler, this._options);
    }
  }

  public dispose(): void {
    if (this._linkMatcherId !== undefined && this._terminal !== undefined) {
      this._terminal.deregisterLinkMatcher(this._linkMatcherId);
    }

    this._linkProvider?.dispose();
  }
}
