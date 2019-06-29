/**
 * Copyright (c) 2017 The xterm.js authors. All rights reserved.
 * @license MIT
 */

export interface ISelectionRedrawRequestEvent {
  start: [number, number];
  end: [number, number];
  columnSelectMode: boolean;
}
