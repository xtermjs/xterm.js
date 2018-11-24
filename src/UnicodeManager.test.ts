/**
 * Copyright (c) 2018 The xterm.js authors. All rights reserved.
 * @license MIT
 */
import { assert } from 'chai';
import { UnicodeVersionManager } from './UnicodeManager';
import { IUnicodeVersionProvider } from './Types';

const VERSION_DUMMY1: IUnicodeVersionProvider = {
  version: 15,
  wcwidth: (n: number) => n,
  init: () => {}
};
const VERSION_DUMMY2: IUnicodeVersionProvider = {
  version: 17,
  wcwidth: (n: number) => n,
  init: () => {}
};

describe('UnicodeProvider', function(): void {
  describe('static part', function(): void {

    it('provided default versions', function(): void {
      assert.deepEqual(UnicodeVersionManager.registeredVersions, [6, 11]);
    });

    it('add version', function(): void {
      UnicodeVersionManager.registerVersion(VERSION_DUMMY1);
      assert.deepEqual(UnicodeVersionManager.registeredVersions, [6, 11, 15]);
      delete UnicodeVersionManager.versions[15];
    });

    it('register callback', function(): void {
      let gotCalled = false;
      UnicodeVersionManager.addRegisterListener((version) => {
        assert.equal(version, 15);
        gotCalled = true;
      });
      UnicodeVersionManager.registerVersion(VERSION_DUMMY1);
      assert.equal(gotCalled, true);
      delete UnicodeVersionManager.versions[15];
      UnicodeVersionManager.removeAllRegisterListener();
    });

    it('remove callback', function(): void {
      let gotCalled = false;
      const listener = (version: number) => {
        assert.equal(version, 15);
        gotCalled = true;
      };
      UnicodeVersionManager.addRegisterListener(listener);
      UnicodeVersionManager.registerVersion(VERSION_DUMMY1);
      assert.equal(gotCalled, true);
      gotCalled = false;
      UnicodeVersionManager.removeRegisterListener(listener);
      UnicodeVersionManager.registerVersion(VERSION_DUMMY2);
      assert.equal(gotCalled, false);
      delete UnicodeVersionManager.versions[15];
      delete UnicodeVersionManager.versions[17];
      UnicodeVersionManager.removeAllRegisterListener();
    });
  });
  describe('instance', function(): void {
    let provider: UnicodeVersionManager;

    beforeEach(function(): void {
      provider = new UnicodeVersionManager();
    });

    it('highest version activated by default', function(): void {
      assert.equal(provider.activeVersion, 11);
    });

    it('activate exact', function(): void {
      assert.throws(() => provider.activeVersion = 5);
      assert.throws(() => provider.activeVersion = 7);
      assert.throws(() => provider.activeVersion = 10);
      assert.throws(() => provider.activeVersion = 12);
      assert.throws(() => provider.activeVersion = 200);
      assert.doesNotThrow(() => provider.activeVersion = 6);
      assert.doesNotThrow(() => provider.activeVersion = 11);
    });

    it('register/remove callback', function(): void {
      let gotCalled = false;
      const listener = (version: number, prov: UnicodeVersionManager) => {
        assert.equal(version, 15);
        assert.equal(prov, provider);
        gotCalled = true;
      };
      provider.addRegisterListener(listener);
      UnicodeVersionManager.registerVersion(VERSION_DUMMY1);
      assert.equal(gotCalled, true);
      gotCalled = false;
      provider.removeRegisterListener(listener);
      UnicodeVersionManager.registerVersion(VERSION_DUMMY2);
      assert.equal(gotCalled, false);
      delete UnicodeVersionManager.versions[15];
      delete UnicodeVersionManager.versions[17];
      UnicodeVersionManager.removeAllRegisterListener();
      provider.dispose();
    });

    it('unicode test', function(): void {
      const data = '🔷🔷🔷🔷🔷';
      provider.activeVersion = 6;
      assert.equal(provider.getStringCellWidth(data), 5);
      provider.activeVersion = 11;
      assert.equal(provider.getStringCellWidth(data), 10);
    });
  });
});
