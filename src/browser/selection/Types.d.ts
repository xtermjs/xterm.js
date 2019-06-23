/**
 * Copyright (c) 2017 The xterm.js authors. All rights reserved.
 * @license MIT
 */

export interface ISelectionManager {
  selectionText: string;
  selectionStart: [number, number];
  selectionEnd: [number, number];

  disable(): void;
  enable(): void;
  setSelection(row: number, col: number, length: number): void;
  isClickInSelection(event: MouseEvent): boolean;
  selectWordAtCursor(event: MouseEvent): void;
}

export interface ISelectionRedrawRequestEvent {
  start: [number, number];
  end: [number, number];
  columnSelectMode: boolean;
}
