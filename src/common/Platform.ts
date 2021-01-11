/**
 * Copyright (c) 2016 The xterm.js authors. All rights reserved.
 * @license MIT
 */

interface INavigator {
  userAgent: string;
  language: string;
  platform: string;
}

// We're declaring a navigator global here as we expect it in all runtimes (node and browser), but
// we want this module to live in common.
declare const navigator: INavigator;

const isNode = (typeof navigator === 'undefined') ? true : false;
const userAgent = (isNode) ? 'node' : navigator.userAgent;
const platform = (isNode) ? 'node' : navigator.platform;

export const isFirefox = userAgent.includes('Firefox');
export const isSafari = /^((?!chrome|android).)*safari/i.test(userAgent);

// Find the users platform. We use this to interpret the meta key
// and ISO third level shifts.
// http://stackoverflow.com/q/19877924/577598
export const isMac = ['Macintosh', 'MacIntel', 'MacPPC', 'Mac68K'].includes(platform);
export const isIpad = platform === 'iPad';
export const isIphone = platform === 'iPhone';
export const isWindows = ['Windows', 'Win16', 'Win32', 'WinCE'].includes(platform);
export const isLinux = platform.indexOf('Linux') >= 0;
