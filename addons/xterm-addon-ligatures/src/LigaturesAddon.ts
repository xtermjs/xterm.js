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

export class LigaturesAddon implements ITerminalAddon {
  constructor() {}

  public activate(terminal: Terminal): void {
    enableLigatures(terminal);
  }

  public dispose(): void {}
}

