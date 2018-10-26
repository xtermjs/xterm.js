/**
 * Copyright (c) 2018 The xterm.js authors. All rights reserved.
 * @license MIT
 */
import { assert } from 'chai';
import { UnicodeProvider } from './UnicodeProvider';
import { IUnicodeImplementation } from './Types';

const VERSION_DUMMY1: IUnicodeImplementation = {
  version: 15,
  wcwidth: (n: number) => n
};
const VERSION_DUMMY2: IUnicodeImplementation = {
  version: 17,
  wcwidth: (n: number) => n
};

describe('UnicodeProvider', function(): void {
  describe('static part', function(): void {

    it('provided default versions', function(): void {
      assert.deepEqual(UnicodeProvider.getRegisteredVersions(), [6, 11]);
    });

    it('add version', function(): void {
      UnicodeProvider.registerVersion(VERSION_DUMMY1);
      assert.deepEqual(UnicodeProvider.getRegisteredVersions(), [6, 11, 15]);
      delete UnicodeProvider.versions[15];
    });

    it('register callback', function(): void {
      UnicodeProvider.addRegisterListener((version) => {
        assert.equal(version, 15);
      });
      UnicodeProvider.registerVersion(VERSION_DUMMY1);
      delete UnicodeProvider.versions[15];
      UnicodeProvider.removeAllRegisterListener();
    });

    it('remove callback', function(): void {
      let gotCalled = false;
      const listener = (version: number) => {
        assert.equal(version, 15);
        gotCalled = true;
      };
      UnicodeProvider.addRegisterListener(listener);
      UnicodeProvider.registerVersion(VERSION_DUMMY1);
      assert.equal(gotCalled, true);
      gotCalled = false;
      UnicodeProvider.removeRegisterListener(listener);
      UnicodeProvider.registerVersion(VERSION_DUMMY2);
      assert.equal(gotCalled, false);
      delete UnicodeProvider.versions[15];
      delete UnicodeProvider.versions[17];
      UnicodeProvider.removeAllRegisterListener();
    });
  });
  describe('instance', function(): void {
    let provider: UnicodeProvider;

    beforeEach(function(): void {
      provider = new UnicodeProvider();
    });

    it('highest version activated by default', function(): void {
      assert.equal(provider.getActiveVersion(), 11);
    });

    it('activate nearest version', function(): void {
      provider.setActiveVersion(0);
      assert.equal(provider.getActiveVersion(), 6);
      provider.setActiveVersion(5);
      assert.equal(provider.getActiveVersion(), 6);
      provider.setActiveVersion(7);
      assert.equal(provider.getActiveVersion(), 6);
      provider.setActiveVersion(8);
      assert.equal(provider.getActiveVersion(), 6);
      provider.setActiveVersion(10);
      assert.equal(provider.getActiveVersion(), 11);
      provider.setActiveVersion(13);
      assert.equal(provider.getActiveVersion(), 11);
    });

    it('activate next lower', function(): void {
      provider.setActiveVersion(15, 'previous');
      assert.equal(provider.getActiveVersion(), 11);
      provider.setActiveVersion(11, 'previous');
      assert.equal(provider.getActiveVersion(), 11);
      provider.setActiveVersion(10.5, 'previous');
      assert.equal(provider.getActiveVersion(), 6);
      provider.setActiveVersion(5, 'previous');
      assert.equal(provider.getActiveVersion(), 6);
    });

    it('activate next higher', function(): void {
      provider.setActiveVersion(5, 'next');
      assert.equal(provider.getActiveVersion(), 6);
      provider.setActiveVersion(6, 'next');
      assert.equal(provider.getActiveVersion(), 6);
      provider.setActiveVersion(10.5, 'next');
      assert.equal(provider.getActiveVersion(), 11);
      provider.setActiveVersion(15, 'next');
      assert.equal(provider.getActiveVersion(), 11);
    });

    it('activate exact', function(): void {
      assert.throws(() => provider.setActiveVersion(5, 'exact'));
      assert.throws(() => provider.setActiveVersion(7, 'exact'));
      assert.throws(() => provider.setActiveVersion(10, 'exact'));
      assert.throws(() => provider.setActiveVersion(12, 'exact'));
      assert.throws(() => provider.setActiveVersion(200, 'exact'));
      assert.doesNotThrow(() => provider.setActiveVersion(6, 'exact'));
      assert.doesNotThrow(() => provider.setActiveVersion(11, 'exact'));
    });

    it('register/remove callback', function(): void {
      let gotCalled = false;
      const listener = (version: number, prov: UnicodeProvider) => {
        assert.equal(version, 15);
        assert.equal(prov, provider);
        gotCalled = true;
      };
      provider.addRegisterListener(listener);
      UnicodeProvider.registerVersion(VERSION_DUMMY1);
      assert.equal(gotCalled, true);
      gotCalled = false;
      provider.removeRegisterListener(listener);
      UnicodeProvider.registerVersion(VERSION_DUMMY2);
      assert.equal(gotCalled, false);
      delete UnicodeProvider.versions[15];
      delete UnicodeProvider.versions[17];
      UnicodeProvider.removeAllRegisterListener();
      provider.dispose();
    });

    it('unicode test', function(): void {
      const data = '🔷🔷🔷🔷🔷';
      provider.setActiveVersion(6);
      assert.equal(provider.getStringCellWidth(data), 5);
      provider.setActiveVersion(11);
      assert.equal(provider.getStringCellWidth(data), 10);
    });
  });
});
