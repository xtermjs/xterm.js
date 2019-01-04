/**
 * Copyright (c) 2019 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import { ITerminalAddon, ITerminalAddonConstructor, IDisposable, Terminal } from 'xterm';

export interface ILoadedAddon {
  ctor: ITerminalAddonConstructor<ITerminalAddon>;
  instance: ITerminalAddon;
  dispose: () => void;
}

export class AddonManager implements IDisposable {
  protected _addons: ILoadedAddon[] = [];

  constructor() {
  }

  public dispose(): void {
    for (let i = this._addons.length - 1; i >= 0; i--) {
      this._addons[i].instance.dispose();
    }
  }

  public loadAddon<T extends ITerminalAddon>(terminal: Terminal, addonConstructor: ITerminalAddonConstructor<T>): T {
    const instance = new addonConstructor(terminal);
    const loadedAddon: ILoadedAddon = {
      ctor: addonConstructor,
      instance,
      dispose: instance.dispose
    };
    this._addons.push(loadedAddon);
    instance.dispose = () => this._wrappedAddonDispose(loadedAddon);
    return instance;
  }

  public disposeAddon<T extends ITerminalAddon>(addonConstructor: ITerminalAddonConstructor<T>): void {
    const match = this._addons.find(value => value.ctor === addonConstructor);
    if (!match) {
      throw new Error('Could not dispose an addon that has not been loaded');
    }
    match.instance.dispose();
  }

  public getAddon<T extends ITerminalAddon>(addonConstructor: ITerminalAddonConstructor<T>): T {
    const match = this._addons.find(value => value.ctor === addonConstructor);
    if (!match) {
      return undefined;
    }
    return match.instance as T;
  }

  private _wrappedAddonDispose(loadedAddon: ILoadedAddon): void {
    let index = -1;
    for (let i = 0; i < this._addons.length; i++) {
      if (this._addons[i].ctor === loadedAddon.ctor) {
        index = i;
        break;
      }
    }
    if (index === -1) {
      throw new Error('Could not dispose an addon that has not been loaded');
    }
    loadedAddon.dispose();
    this._addons.splice(index, 1);
  }
}
