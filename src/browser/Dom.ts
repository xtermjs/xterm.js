/**
 * Copyright (c) 2020 The xterm.js authors. All rights reserved.
 * @license MIT
 */

export function removeElementFromParent(...elements: (HTMLElement | undefined)[]): void {
  for (const e of elements) {
    e?.parentElement?.removeChild(e);
  }
}
