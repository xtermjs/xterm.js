/**
 * Copyright (c) 2019 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import { assert } from 'chai';
import { AddonManager, ILoadedAddon } from './AddonManager';
import { ITerminalAddon } from 'xterm';

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
        constructor(terminal: any) {
          assert.equal(terminal, 'foo', 'The first constructor arg should be Terminal');
          called = true;
        }
        dispose(): void { }
      }
      manager.loadAddon('foo' as any, Addon);
      assert.equal(called, true);
    });
  });

  describe('getAddon', () => {
    it('should fetch registered addons', () => {
      class BaseAddon implements ITerminalAddon {
        constructor() { }
        dispose(): void { }
      }
      class Addon1 extends BaseAddon { }
      class Addon2 extends BaseAddon { }
      class Addon3 extends BaseAddon { }
      const addon1 = manager.loadAddon(null, Addon1);
      assert.equal(manager.getAddon(Addon1), addon1);
      assert.equal(manager.addons.length, 1);
      const addon2 = manager.loadAddon(null, Addon2);
      assert.equal(manager.getAddon(Addon1), addon1);
      assert.equal(manager.getAddon(Addon2), addon2);
      assert.equal(manager.addons.length, 2);
      const addon3 = manager.loadAddon(null, Addon3);
      assert.equal(manager.getAddon(Addon1), addon1);
      assert.equal(manager.getAddon(Addon2), addon2);
      assert.equal(manager.getAddon(Addon3), addon3);
      assert.equal(manager.addons.length, 3);
    });
  });

  describe('disposeAddon', () => {
    it('should dispose the loaded addon and remove it from the loaded list', () => {
      let called = 0;
      class BaseAddon implements ITerminalAddon {
        constructor() { }
        dispose(): void {
          called++;
        }
      }
      class Addon1 extends BaseAddon { }
      class Addon2 extends BaseAddon { }
      class Addon3 extends BaseAddon { }
      manager.loadAddon(null, Addon1);
      manager.loadAddon(null, Addon2);
      manager.loadAddon(null, Addon3);
      assert.equal(manager.addons.length, 3);
      manager.disposeAddon(Addon1);
      assert.equal(called, 1);
      assert.equal(manager.addons.length, 2);
      manager.disposeAddon(Addon2);
      assert.equal(called, 2);
      assert.equal(manager.addons.length, 1);
      manager.disposeAddon(Addon3);
      assert.equal(called, 3);
      assert.equal(manager.addons.length, 0);
    });
  });

  describe('dispose', () => {
    it('should dispose all loaded addons', () => {
      let called = 0;
      class BaseAddon implements ITerminalAddon {
        constructor() { }
        dispose(): void {
          called++;
        }
      }
      class Addon1 extends BaseAddon { }
      class Addon2 extends BaseAddon { }
      class Addon3 extends BaseAddon { }
      manager.loadAddon(null, Addon1);
      manager.loadAddon(null, Addon2);
      manager.loadAddon(null, Addon3);
      assert.equal(manager.addons.length, 3);
      manager.dispose();
      assert.equal(called, 3);
      assert.equal(manager.addons.length, 0);
    });
  });
});
