/**
 * Copyright (c) 2026 The xterm.js authors. All rights reserved.
 * @license MIT
 *
 * Minimal async helpers for xterm.js core.
 */

import { DisposableStore, IDisposable, toDisposable } from 'common/Lifecycle';

export function timeout(millis: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, millis));
}

/**
 * Creates a timeout that can be disposed using its returned value.
 * @param handler The timeout handler.
 * @param timeout An optional timeout in milliseconds.
 * @param store An optional {@link DisposableStore} that will have the timeout disposable managed
 * automatically.
 */
export function disposableTimeout(handler: () => void, timeout = 0, store?: DisposableStore): IDisposable {
  const timer = setTimeout(() => {
    handler();
    if (store) {
      disposable.dispose();
    }
  }, timeout);
  const disposable = toDisposable(() => {
    clearTimeout(timer);
  });
  store?.add(disposable);
  return disposable;
}
