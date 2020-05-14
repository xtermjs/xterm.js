/**
 * Copyright (c) 2018 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import { IDisposable } from 'common/Types';

/**
 * Adds a disposable listener to a node in the DOM, returning the disposable.
 * @param type The event type.
 * @param handler The handler for the listener.
 */
export function addDisposableDomListener(
  node: Element | Window | Document,
  type: string,
  handler: (e: any) => void,
  options?: boolean | AddEventListenerOptions
): IDisposable {
  node.addEventListener(type, handler, options);
  let disposed = false;
  return {
    dispose: () => {
      if (disposed) {
        return;
      }
      disposed = true;
      node.removeEventListener(type, handler, options);
    }
  };
}
