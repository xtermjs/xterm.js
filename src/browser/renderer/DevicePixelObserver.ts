/**
 * Copyright (c) 2022 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import { toDisposable } from 'common/Lifecycle';
import { IDisposable } from 'common/Types';

export function observeDevicePixelDimensions(element: HTMLElement, callback: (deviceWidth: number, deviceHeight: number) => void): IDisposable {
  // Observe any resizes to the element and extract the actual pixel size of the element if the
  // devicePixelContentBoxSize API is supported. This allows correcting rounding errors when
  // converting between CSS pixels and device pixels which causes blurry rendering when device
  // pixel ratio is not a round number.
  let observer: ResizeObserver | undefined = new ResizeObserver((entries) => {
    const entry = entries.find((entry) => entry.target === element);
    if (!entry) {
      return;
    }

    // Disconnect if devicePixelContentBoxSize isn't supported by the browser
    if (!('devicePixelContentBoxSize' in entry)) {
      observer?.disconnect();
      observer = undefined;
      return;
    }

    callback(
      entry.devicePixelContentBoxSize[0].inlineSize,
      entry.devicePixelContentBoxSize[0].blockSize
    );
  });
  observer.observe(element, { box: ['device-pixel-content-box'] } as any);
  return toDisposable(() => observer?.disconnect());
}
