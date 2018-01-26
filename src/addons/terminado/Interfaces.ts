/**
 * Copyright (c) 2018 The xterm.js authors. All rights reserved.
 * @license MIT
 *
 * Implements the attach method, that attaches the terminal to a WebSocket stream.
 */

import { Terminal } from 'xterm';

export interface ITerminadoAddonTerminal extends Terminal {
  __socket?: WebSocket;
  __attachSocketBuffer?: string;

  __getMessage?(ev: MessageEvent): void;
  __flushBuffer?(): void;
  __pushToBuffer?(data: string): void;
  __sendData?(data: string): void;
  __setSize?(size: {rows: number, cols: number}): void;
}
