/**
 * Copyright (c) 2016 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import { contains } from './Generic';

const isNode = (typeof navigator === 'undefined') ? true : false;
const userAgent = (isNode) ? 'node' : navigator.userAgent;
const platform = (isNode) ? 'node' : navigator.platform;

export const isFirefox = !!~userAgent.indexOf('Firefox');
export const isMSIE = !!~userAgent.indexOf('MSIE') || !!~userAgent.indexOf('Trident');

// Find the users platform. We use this to interpret the meta key
// and ISO third level shifts.
// http://stackoverflow.com/q/19877924/577598
export const isMac = contains(['Macintosh', 'MacIntel', 'MacPPC', 'Mac68K'], platform);
export const isIpad = platform === 'iPad';
export const isIphone = platform === 'iPhone';
export const isMSWindows = contains(['Windows', 'Win16', 'Win32', 'WinCE'], platform);
export const isLinux = platform.indexOf('Linux') >= 0;
