/**
 * xterm.js: xterm, in the browser
 * Copyright (c) 2016, SourceLair Private Company <www.sourcelair.com> (MIT License)
 */

/**
 * Browser utilities module. This module contains attributes and methods to help with
 * identifying the current browser and platform.
 * @module xterm/utils/Browser
 */

import { contains } from './Generic.js';

let userAgent = navigator.userAgent;
let platform = navigator.platform;

export let isFirefox = !!~userAgent.indexOf('Firefox');
export let isMSIE = !!~userAgent.indexOf('MSIE');

// Find the users platform. We use this to interpret the meta key
// and ISO third level shifts.
// http://stackoverflow.com/q/19877924/577598
export let isMac = contains(platform, ['Macintosh', 'MacIntel', 'MacPPC', 'Mac68K']);
export let isIpad = platform === 'iPad';
export let isIphone = platform === 'iPhone';
export let isMSWindows = contains(platform, ['Windows', 'Win16', 'Win32', 'WinCE']);
