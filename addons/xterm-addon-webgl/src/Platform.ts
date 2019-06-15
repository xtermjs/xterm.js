/**
 * Copyright (c) 2016 The xterm.js authors. All rights reserved.
 * @license MIT
 */

const isNode = (typeof navigator === 'undefined') ? true : false;
const userAgent = (isNode) ? 'node' : navigator.userAgent;

export const isFirefox = !!~userAgent.indexOf('Firefox');
export const isSafari = /^((?!chrome|android).)*safari/i.test(userAgent);
