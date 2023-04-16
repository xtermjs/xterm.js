/**
 * Copyright (c) 2023 The xterm.js authors. All rights reserved.
 * @license MIT
 *
 * (EXPERIMENTAL) This Addon is still under development
 */

import { serialize } from './serializer.wasm';
import { Terminal, ITerminalAddon } from 'xterm';


interface ISerializeOptions {
  scrollback?: number;
  excludeModes?: boolean;
  excludeAltBuffer?: boolean;
}


export class Serialize2Addon implements ITerminalAddon {
  private _terminal: Terminal | undefined;

  constructor() { }

  public activate(terminal: Terminal): void {
    this._terminal = terminal;
  }

  public serialize(options?: ISerializeOptions): string {
    // TODO: Add combinedData support
    if (!this._terminal) {
      throw new Error('Cannot use addon until it has been loaded');
    }

    return serialize((this._terminal as any)._core);
  }

  public dispose(): void { }
}

