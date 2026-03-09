/**
 * Copyright (c) 2026 The xterm.js authors. All rights reserved.
 * @license MIT
 */
import { assert } from 'chai';
import { parseKittyCommand, KittyAction, KittyFormat } from './KittyGraphicsTypes';

describe('KittyGraphicsTypes', () => {
  describe('parseKittyCommand', () => {
    it('should parse control data with action and format', () => {
      const cmd = parseKittyCommand('a=T,f=100');
      assert.strictEqual(cmd.action, 'T');
      assert.strictEqual(cmd.format, 100);
    });

    it('should parse control data with all options', () => {
      const cmd = parseKittyCommand('a=t,f=32,i=5,s=10,v=20,c=3,r=2,m=1,q=2');
      assert.strictEqual(cmd.action, 't');
      assert.strictEqual(cmd.format, 32);
      assert.strictEqual(cmd.id, 5);
      assert.strictEqual(cmd.width, 10);
      assert.strictEqual(cmd.height, 20);
      assert.strictEqual(cmd.columns, 3);
      assert.strictEqual(cmd.rows, 2);
      assert.strictEqual(cmd.more, 1);
      assert.strictEqual(cmd.quiet, 2);
    });

    it('should handle empty control data', () => {
      const cmd = parseKittyCommand('');
      assert.strictEqual(cmd.action, undefined);
      assert.strictEqual(cmd.format, undefined);
    });

    it('should parse transmit action', () => {
      const cmd = parseKittyCommand('a=t,f=100');
      assert.strictEqual(cmd.action, KittyAction.TRANSMIT);
      assert.strictEqual(cmd.format, KittyFormat.PNG);
    });

    it('should parse delete action', () => {
      const cmd = parseKittyCommand('a=d,i=5');
      assert.strictEqual(cmd.action, KittyAction.DELETE);
      assert.strictEqual(cmd.id, 5);
    });

    it('should parse empty action as empty string', () => {
      const cmd = parseKittyCommand('a=,f=100');
      assert.strictEqual(cmd.action, '');
      assert.strictEqual(cmd.format, 100);
    });

    it('should leave action undefined when key is not present', () => {
      const cmd = parseKittyCommand('f=100,i=5');
      assert.strictEqual(cmd.action, undefined);
      assert.strictEqual(cmd.format, 100);
      assert.strictEqual(cmd.id, 5);
    });

    it('should parse compression key', () => {
      const cmd = parseKittyCommand('a=t,f=32,o=z');
      assert.strictEqual(cmd.action, 't');
      assert.strictEqual(cmd.format, 32);
      assert.strictEqual(cmd.compression, 'z');
    });

    it('should parse cursor movement key', () => {
      const cmd = parseKittyCommand('a=T,f=100,C=1');
      assert.strictEqual(cmd.cursorMovement, 1);
    });

    it('should parse cursor movement key C=0', () => {
      const cmd = parseKittyCommand('a=T,f=100,C=0');
      assert.strictEqual(cmd.cursorMovement, 0);
    });

    it('should parse x and y offset', () => {
      const cmd = parseKittyCommand('a=T,x=10,y=20');
      assert.strictEqual(cmd.x, 10);
      assert.strictEqual(cmd.y, 20);
    });

    it('should handle keys without values', () => {
      const cmd = parseKittyCommand('a=t,f=,i=5');
      assert.strictEqual(cmd.action, 't');
      assert.ok(isNaN(cmd.format!));
      assert.strictEqual(cmd.id, 5);
    });

    it('should parse z-index key with positive value', () => {
      const cmd = parseKittyCommand('a=T,f=100,z=10');
      assert.strictEqual(cmd.zIndex, 10);
    });

    it('should parse z-index key with zero', () => {
      const cmd = parseKittyCommand('a=T,f=100,z=0');
      assert.strictEqual(cmd.zIndex, 0);
    });

    it('should parse z-index key with negative value', () => {
      const cmd = parseKittyCommand('a=T,f=100,z=-1');
      assert.strictEqual(cmd.zIndex, -1);
    });

    it('should leave zIndex undefined when not specified', () => {
      const cmd = parseKittyCommand('a=T,f=100');
      assert.strictEqual(cmd.zIndex, undefined);
    });

    it('should parse delete selector key', () => {
      const cmd = parseKittyCommand('a=d,d=i,i=5');
      assert.strictEqual(cmd.action, 'd');
      assert.strictEqual(cmd.deleteSelector, 'i');
      assert.strictEqual(cmd.id, 5);
    });

    it('should parse uppercase delete selector', () => {
      const cmd = parseKittyCommand('a=d,d=A');
      assert.strictEqual(cmd.deleteSelector, 'A');
    });

    it('should parse delete selector d=a (all)', () => {
      const cmd = parseKittyCommand('a=d,d=a');
      assert.strictEqual(cmd.deleteSelector, 'a');
    });

    it('should leave deleteSelector undefined when not specified', () => {
      const cmd = parseKittyCommand('a=d,i=5');
      assert.strictEqual(cmd.deleteSelector, undefined);
    });

    it('should parse placement id key', () => {
      const cmd = parseKittyCommand('a=d,d=i,i=5,p=3');
      assert.strictEqual(cmd.placementId, 3);
      assert.strictEqual(cmd.deleteSelector, 'i');
      assert.strictEqual(cmd.id, 5);
    });

    it('should leave placementId undefined when not specified', () => {
      const cmd = parseKittyCommand('a=d,d=i,i=5');
      assert.strictEqual(cmd.placementId, undefined);
    });

    it('should parse image number key', () => {
      const cmd = parseKittyCommand('a=t,f=100,I=42');
      assert.strictEqual(cmd.imageNumber, 42);
    });
  });
});
