/**
 * Copyright (c) 2025 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import type { Terminal } from '@xterm/xterm';

/**
Question: Can I delete this since we switched from triggerDataEvent to this._terminal.input
 */
export interface ITerminalExt extends Terminal {}
