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
declare const process: any;

export const isNode = (typeof navigator === 'undefined' && typeof process !== 'undefined') ? true : false;
const userAgent = (isNode) ? 'node' : navigator.userAgent;
const platform = (isNode) ? 'node' : navigator.platform;

export const isFirefox = !!~userAgent.indexOf('Firefox');
export const isSafari = /^((?!chrome|android).)*safari/i.test(userAgent);

// Find the users platform. We use this to interpret the meta key
// and ISO third level shifts.
// http://stackoverflow.com/q/19877924/577598
export const isMac = contains(['Macintosh', 'MacIntel', 'MacPPC', 'Mac68K'], platform);
export const isIpad = platform === 'iPad';
export const isIphone = platform === 'iPhone';
export const isWindows = contains(['Windows', 'Win16', 'Win32', 'WinCE'], platform);
export const isLinux = platform.indexOf('Linux') >= 0;

/**
 * Return if the given array contains the given element
 * @param arr The array to search for the given element.
 * @param el The element to look for into the array
 */
function contains(arr: any[], el: any): boolean {
  return arr.indexOf(el) >= 0;
}


/**
 * Define some global references to level out JS platform differences.
 *
 * Notes:
 *  - We deal here only with top level differences of nodejs vs. browsers,
 *    specific browser related differences are handled at implementation
 *    level (e.g. TypedArray patches for Safari).
 *  - setTimeout is needed by browser and common part, thus we set it hard
 *    from the global scope. This is intended tp throw if we run in a
 *    JS engine that does not provide standard access to the event loop.
 *  - console is typed as most basic with a log method since there are engines
 *    with limited support (some embedded JS engines) and falls back to a NOOP
 *    in case console is not accessible.
 */
interface IGlobals {
  /**
   * String to UTF-8 conversion.
   */
  readonly TextEncoder: { new(): { encode(input?: string): Uint8Array; }; };
  /**
   * setTimeout
   */
  readonly setTimeout: (handler: (...args: any[]) => void, timeout?: number) => number;

  /**
   * Decode base64 (string) to string.
   */
  readonly atob: (encodedString: string) => string;

  /**
   * Encode string to base64 (string).
   */
  readonly btoa: (rawString: string) => string;

  /**
   * Console.
   * Only defines a log method useful during development.
   */
  readonly console: { log(message?: any, ...optionalParams: any[]): void; };
}

// global object
const GLOBAL: any = Function('return this;')();

// alltime globals
declare const setTimeout: IGlobals['setTimeout'];
declare const console: IGlobals['console'];

// browser globals
declare const TextEncoder: IGlobals['TextEncoder'];
declare const atob: IGlobals['atob'];
declare const btoa: IGlobals['btoa'];

class GlobalsBrowser implements IGlobals {
  // tslint:disable-next-line
  public readonly TextEncoder = TextEncoder;
  public readonly setTimeout = setTimeout.bind(GLOBAL);
  public readonly atob = atob.bind(GLOBAL);
  public readonly btoa = btoa.bind(GLOBAL);
  public readonly console = (typeof console === 'undefined') ? {log: () => {}} : console;
}

// nodejs shims
interface INodeBuffer {
  toString(encoding?: string): string;
}
interface INodeBufferCtor {
  from(data: string | ArrayBufferLike, encoding?: string): INodeBuffer;
}
declare const Buffer: INodeBufferCtor;
declare const require: (id: string) => any;

class GlobalsNode implements IGlobals {
  // tslint:disable-next-line
  public readonly TextEncoder = require('util').TextEncoder;
  public readonly setTimeout = setTimeout.bind(GLOBAL);
  public readonly atob = (encodedString: string) => Buffer.from(encodedString, 'base64').toString('binary');
  public readonly btoa = (rawString: string) => Buffer.from(rawString, 'binary').toString('base64');
  public readonly console = (typeof console === 'undefined') ? {log: () => {}} : console;
}

export const GLOBALS: IGlobals = Object.freeze((isNode) ? new GlobalsNode() : new GlobalsBrowser());
