/**
 * Copyright (c) 2026 The xterm.js authors. All rights reserved.
 * @license MIT
 */

const userAgent = typeof navigator === 'object' ? navigator.userAgent : '';
const platform = typeof navigator === 'object' ? navigator.platform : '';

export const isMacintosh = platform.indexOf('Mac') >= 0;
export const isWindows = platform.indexOf('Win') >= 0;
export const isLinux = platform.indexOf('Linux') >= 0;
export const isIOS = /iPad|iPhone|iPod/.test(userAgent);
