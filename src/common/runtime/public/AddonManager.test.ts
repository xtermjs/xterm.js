/**
 * Copyright (c) 2019 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import { assert } from 'chai';
import { AddonManager, ILoadedAddon } from './AddonManager';
import { ITerminalAddon } from '@xterm/xterm';

class TestAddonManager extends AddonManager {
  public get addons(): ILoadedAddon[] {
    return this._addons;
  }
}

describe('AddonManager', () => {
  let manager: TestAddonManager;

  beforeEach(() => {
    manager = new TestAddonManager();
  });

  describe('loadAddon', () => {
    it('should call addon constructor', () => {
      let called = false;
      class Addon implements ITerminalAddon {
        public activate(terminal: any): void {
          assert.equal(terminal, 'foo', 'The first constructor arg should be Terminal');
          called = true;
        }
        public dispose(): void { }
      }
      manager.loadAddon('foo' as any, new Addon());
      assert.equal(called, true);
    });
  });

  describe('dispose', () => {
    it('should dispose all loaded addons', () => {
      let called = 0;
      class Addon implements ITerminalAddon {
        public activate(): void {}
        public dispose(): void { called++; }
      }
      manager.loadAddon(null!, new Addon());
      manager.loadAddon(null!, new Addon());
      manager.loadAddon(null!, new Addon());
      assert.equal(manager.addons.length, 3);
      manager.dispose();
      assert.equal(called, 3);
      assert.equal(manager.addons.length, 0);
    });
  });
});
