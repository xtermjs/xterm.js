/**
 * Copyright (c) 2018 The xterm.js authors. All rights reserved.
 * @license MIT
 */
import { IUnicodeImplementation, IUnicodeProvider } from './Types';
import { v6 } from './unicode/v6';
import { v11 } from './unicode/v11';

/**
 * Class to provide access to different unicode version implementations.
 *
 * The version related implementations are stored statically
 * to avoid recreating them for every single instance.
 *
 * An instance of this class is meant to serve unicode specific implementations
 * for a single terminal instance. This way multiple terminals can have
 * different unicode settings active while still referring to the
 * same underlying implementations.
 */
export class UnicodeProvider implements IUnicodeProvider {
  static versions: {[key: string]: IUnicodeImplementation} = {};
  private static _registerCallbacks: ((version: number) => void)[] = [];

  static onRegister(callback: (version: number) => void): void {
    UnicodeProvider._registerCallbacks.push(callback);
  }

  /**
   * Register an unicode implementation.
   * Possible entry point for unicode addons.
   * In conjuction with `onRegister` it can be used
   * to load implementations lazy.
   */
  static registerVersion(impl: IUnicodeImplementation): void {
    if (UnicodeProvider.versions[impl.version]) {
      throw new Error(`unicode version "${impl.version}" already registered`);
    }
    UnicodeProvider.versions[impl.version] = impl;
    UnicodeProvider._registerCallbacks.forEach(cb => cb(impl.version));
  }

  static registeredVersions(): number[] {
    return Object.getOwnPropertyNames(UnicodeProvider.versions).map(parseFloat).sort((a, b) => a - b);
  }

  private _version: number;
  public wcwidth: (ucs: number) => number;

  // defaults to the highest available version
  constructor(version: number = 20) {
    this.setActiveVersion(version);
  }

  /**
   * Callback to run when a version got registered.
   * Gets the newly registered version and
   * the `UnicodeProvider` instance as arguments.
   */
  public onRegister(callback: (version: number, provider: UnicodeProvider) => void): void {
    UnicodeProvider.onRegister((version) => callback(version, this));
  }

  /**
   * Get a list of currently registered unicode versions.
   */
  public registeredVersions(): number[] {
    return Object.getOwnPropertyNames(UnicodeProvider.versions).map(parseFloat).sort((a, b) => a - b);
  }

  /**
   * Get the currently active unicode version.
   */
  public getActiveVersion(): number {
    return this._version;
  }

  /**
   * Activate a registered unicode version. By default the closest version will be activated
   * (can be higher or lower). Setting `mode` to 'next' tries to get at least that version,
   * 'previous' tries to get the closest lower version.
   * Unless there is no version registered this method will always succeed.
   * Returns the activated version number.
   */
  public setActiveVersion(version: number, mode?: 'exact' | 'closest' | 'next' | 'previous'): number {
    if (!this.registeredVersions().length) {
      throw new Error('no unicode versions registered');
    }

    // find closest matching version
    // Although not quite correct for typical versioning schemes 5.9 is treated closer to 6.0 than to 5.7.
    // Typically we will not ship subversions so this approximation should be close enough.
    const versions = this.registeredVersions();
    const distances = versions.map(el => Math.abs(version - el));
    const closestIndex = distances.reduce((iMin, x, i, arr) => x < arr[iMin] ? i : iMin, 0);
    let newVersion = versions[closestIndex];

    if (mode === 'exact') {
      // exact version match requested
      if (version !== newVersion) {
        throw new Error(`unicode version "${version}" not registered`);
      }
    } else {
      // take the higher one if available
      if (mode === 'next') {
        if (newVersion < version && closestIndex < versions.length - 1) {
          newVersion = versions[closestIndex + 1];
        }
      // take the lower one if available
      } else if (mode === 'previous') {
        if (newVersion > version && closestIndex) {
          newVersion = versions[closestIndex - 1];
        }
      }
    }

    // swap wcwidth impl
    this.wcwidth = UnicodeProvider.versions[newVersion].wcwidth;
    this._version = newVersion;
    return this._version;
  }

  /**
   * Get the terminal cell width for a string.
   */
  public getStringCellWidth(s: string): number {
    let result = 0;
    for (let i = 0; i < s.length; ++i) {
      let code = s.charCodeAt(i);
      if (0xD800 <= code && code <= 0xDBFF) {
        const low = s.charCodeAt(i + 1);
        if (isNaN(low)) {
          return result;
        }
        code = ((code - 0xD800) * 0x400) + (low - 0xDC00) + 0x10000;
      }
      if (0xDC00 <= code && code <= 0xDFFF) {
        continue;
      }
      result += this.wcwidth(code);
    }
    return result;
  }
}

// register statically shipped versions
UnicodeProvider.registerVersion(v6);
UnicodeProvider.registerVersion(v11);
