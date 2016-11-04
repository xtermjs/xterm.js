/**
 * xterm.js: xterm, in the browser
 * Copyright (c) 2016, SourceLair Private Company <www.sourcelair.com> (MIT License)
 */

/**
 * Browser utilities module. This module contains attributes and methods to help with
 * identifying the current browser and platform.
 * @module xterm/utils/Browser
 */


let userAgent = navigator.userAgent;
let platform = navigator.platform;

export let isFirefox = !!~userAgent.indexOf('Firefox');
export let isMSIE = !!~userAgent.indexOf('MSIE');
