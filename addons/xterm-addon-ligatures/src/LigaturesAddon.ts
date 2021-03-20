/**
 * Copyright (c) 2018 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import { Terminal } from 'xterm';
import { enableLigatures } from '.';

export interface ITerminalAddon {
  activate(terminal: Terminal): void;
  dispose(): void;
}

export interface ILigaturesOptions {
  protocol?: string;
}

export class LigaturesAddon implements ITerminalAddon {
  constructor() {}

  public activate(terminal: Terminal, options?: ILigaturesOptions): void {
    enableLigatures(terminal, options);
  }

  public dispose(): void {}
}

