/**
 * Copyright (c) 2018 The xterm.js authors. All rights reserved.
 * @license MIT
 */
import { IUnicodeVersionProvider, IUnicodeVersionManager } from './Types';
import { v6 } from './unicode/v6';
import { v11 } from './unicode/v11';
import { Disposable } from './common/Lifecycle';

type RegisterCallback = [(version: number, provider: UnicodeVersionManager) => void, (version: number) => void];

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
export class UnicodeVersionManager extends Disposable implements IUnicodeVersionManager {
  public static versions: {[version: number]: IUnicodeVersionProvider} = {};
  private static _registerCallbacks: ((version: number) => void)[] = [];

  public static addRegisterListener(callback: (version: number) => void): void {
    UnicodeVersionManager._registerCallbacks.push(callback);
  }

  public static removeRegisterListener(callback: (version: number) => void): void {
    const pos = UnicodeVersionManager._registerCallbacks.indexOf(callback);
    if (pos !== -1) {
      UnicodeVersionManager._registerCallbacks.splice(pos, 1);
    }
  }

  public static removeAllRegisterListener(): void {
    UnicodeVersionManager._registerCallbacks = [];
  }

  /**
   * Register an unicode version.
   * Possible entry point for unicode addons.
   * In conjuction with `addRegisterListener` it can be used
   * to load and use versions lazy.
   */
  public static registerVersion(impl: IUnicodeVersionProvider): void {
    if (UnicodeVersionManager.versions[impl.version]) {
      throw new Error(`unicode version "${impl.version}" already registered`);
    }
    UnicodeVersionManager.versions[impl.version] = impl;
    UnicodeVersionManager._registerCallbacks.forEach(cb => cb(impl.version));
  }

  public static get registeredVersions(): number[] {
    return Object.getOwnPropertyNames(UnicodeVersionManager.versions).map(parseFloat).sort((a, b) => a - b);
  }

  private _version: number;
  private _registerCallbacks: RegisterCallback[] = [];
  public wcwidth: (ucs: number) => number;

  // defaults to the highest available version
  constructor(version?: number) {
    super();
    const versions = this.registeredVersions;
    this.activeVersion = versions[version || versions.length - 1];
  }

  public dispose(): void {
    this._registerCallbacks.forEach(el => UnicodeVersionManager.removeRegisterListener(el[1]));
    this._registerCallbacks = null;
    this.wcwidth = null;
  }

  /**
   * Callback to run when a version got registered.
   * Gets the newly registered version and
   * the `UnicodeProvider` instance as arguments.
   */
  public addRegisterListener(callback: (version: number, manager: IUnicodeVersionManager) => void): void {
    const func: (version: number) => void = (version) => callback(version, this);
    this._registerCallbacks.push([callback, func]);
    UnicodeVersionManager.addRegisterListener(func);
  }

  /**
   * Remove register listener.
   */
  public removeRegisterListener(callback: (version: number, manager: IUnicodeVersionManager) => void): void {
    let pos = -1;
    for (let i = 0; i < this._registerCallbacks.length; ++i) {
      if (this._registerCallbacks[i][0] === callback) {
        pos = i;
        break;
      }
    }
    if (pos !== -1) {
      UnicodeVersionManager.removeRegisterListener(this._registerCallbacks[pos][1]);
      this._registerCallbacks.splice(pos, 1);
    }
  }

  /**
   * Get a list of currently registered unicode versions.
   */
  public get registeredVersions(): number[] {
    return Object.getOwnPropertyNames(UnicodeVersionManager.versions).map(parseFloat).sort((a, b) => a - b);
  }

  /**
   * Get active unicode version.
   */
  public get activeVersion(): number {
    return this._version;
  }

  /**
   * Set active unicode version.
   */
  public set activeVersion(version: number) {
    if (!this.registeredVersions.length || !UnicodeVersionManager.versions[version]) {
      throw new Error(`unicode version "${version}" not registered`);
    }
    // init lookup table and swap wcwidth impl
    UnicodeVersionManager.versions[version].init();
    this.wcwidth = UnicodeVersionManager.versions[version].wcwidth;
    this._version = version;
  }

  /**
   * Get the terminal cell width for a given string.
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
UnicodeVersionManager.registerVersion(v6);
UnicodeVersionManager.registerVersion(v11);
