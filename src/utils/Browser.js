/**
 * Attributes and methods to help with identifying the current browser and platform.
 * @module xterm/utils/Browser
 * @license MIT
 */

import { contains } from './Generic.js';

let isNode = (typeof navigator == 'undefined') ? true : false;
let userAgent = (isNode) ? 'node' : navigator.userAgent;
let platform = (isNode) ? 'node' : navigator.platform;

export let isFirefox = !!~userAgent.indexOf('Firefox');
export let isMSIE = !!~userAgent.indexOf('MSIE') || !!~userAgent.indexOf('Trident');

// Find the users platform. We use this to interpret the meta key
// and ISO third level shifts.
// http://stackoverflow.com/q/19877924/577598
export let isMac = contains(['Macintosh', 'MacIntel', 'MacPPC', 'Mac68K'], platform);
export let isIpad = platform === 'iPad';
export let isIphone = platform === 'iPhone';
export let isMSWindows = contains(['Windows', 'Win16', 'Win32', 'WinCE'], platform);
