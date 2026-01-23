/**
 * Copyright (c) 2025 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import type { Terminal } from '@xterm/xterm';

/**
 * Core service interface for triggering data events.
 * This is used to send responses back to the terminal client.
 */
export interface ICoreService {
  triggerDataEvent(data: string, wasUserInput?: boolean): void;
}

/**
 * Core terminal interface exposing internal services.
 */
export interface ICoreTerminal {
  coreService: ICoreService;
}

/**
 * Extended terminal interface that exposes the internal _core property.
 * This is needed to send responses back to the client.
 */
export interface ITerminalExt extends Terminal {
  _core: ICoreTerminal;
}
