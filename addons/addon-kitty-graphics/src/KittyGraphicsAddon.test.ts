/**
 * Copyright (c) 2025 The xterm.js authors. All rights reserved.
 * @license MIT
 */
import { assert } from 'chai';
import { Terminal } from 'browser/public/Terminal';
import { KittyGraphicsAddon } from './KittyGraphicsAddon';
import { parseKittyCommand } from './KittyApcHandler';

/**
 * Write data to terminal and wait for completion.
 */
function writeP(terminal: Terminal, data: string | Uint8Array): Promise<void> {
  return new Promise(r => terminal.write(data, r));
}

// Test image: 1x1 black PNG (captured from `send-png fixture/black-1x1.png`)
// Get the below base64-encoded PNG file by: `python3 send-png addons/addon-kitty-graphics/fixture/black-1x1.png`
const BLACK_1X1_BASE64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAMAAAAoyzS7AAAAA1BMVEUAAACnej3aAAAACklEQVR4nGNgAAAAAgABSK+kcQAAAAt0RVh0Q29tbWVudAAA1LTqjgAAAApJREFUeJxjYAAAAGQA2AAAAAt0RVh0Q29tbWVudAAA1LTqjg5JREFUAAAAASUVORK5CYII=';

// Test image: 3x1 RGB PNG (red, green, blue pixels)
const RGB_3X1_BASE64 = 'iVBORw0KGgoAAAANSUhEUgAAAAMAAAABCAMAAAAsPuSGAAAACVBMVEX/AAAA/wAAAP8tSs2KAAAADElEQVR4nGNgYGQCAAAIAAQ24LCmAAAAHXRFWHRTb2Z0d2FyZQBAbHVuYXBhaW50L3BuZy1jb2RlY/VDGR4AAAAASUVORK5CYII=';

// Currently tests the flow: write escape sequence -> addon stores image.
// Pixel-level verification of rendered images is done in Playwright tests.
describe('KittyGraphicsAddon', () => {
  let terminal: Terminal;
  let addon: KittyGraphicsAddon;

  beforeEach(() => {
    terminal = new Terminal({ cols: 80, rows: 24, allowProposedApi: true });
    addon = new KittyGraphicsAddon({ debug: false });
    terminal.loadAddon(addon);
  });

  describe('parseKittyCommand', () => {
    it('should parse control data with action and format', () => {
      const cmd = parseKittyCommand('a=T,f=100');
      assert.equal(cmd.action, 'T');
      assert.equal(cmd.format, 100);
    });

    it('should parse control data with all options', () => {
      const cmd = parseKittyCommand('a=t,f=32,i=5,s=10,v=20,c=3,r=2,m=1,q=2');
      assert.equal(cmd.action, 't');
      assert.equal(cmd.format, 32);
      assert.equal(cmd.id, 5);
      assert.equal(cmd.width, 10);
      assert.equal(cmd.height, 20);
      assert.equal(cmd.columns, 3);
      assert.equal(cmd.rows, 2);
      assert.equal(cmd.more, 1);
      assert.equal(cmd.quiet, 2);
    });

    it('should handle empty control data', () => {
      const cmd = parseKittyCommand('');
      assert.equal(cmd.action, undefined);
      assert.equal(cmd.format, undefined);
    });

    it('should parse transmit action', () => {
      const cmd = parseKittyCommand('a=t,f=100');
      assert.equal(cmd.action, 't');
      assert.equal(cmd.format, 100);
    });

    it('should parse delete action', () => {
      const cmd = parseKittyCommand('a=d,i=5');
      assert.equal(cmd.action, 'd');
      assert.equal(cmd.id, 5);
    });

    it('should parse empty action as empty string', () => {
      const cmd = parseKittyCommand('a=,f=100');
      assert.equal(cmd.action, '');
      assert.equal(cmd.format, 100);
    });

    it('should leave action undefined when key is not present (parser only)', () => {
      const cmd = parseKittyCommand('f=100,i=5');
      assert.equal(cmd.action, undefined);
      assert.equal(cmd.format, 100);
      assert.equal(cmd.id, 5);
    });
  });

  describe('APC handler', () => {
    it('should store image when transmit+display sequence is written', async () => {
      // Write Kitty graphics sequence: ESC _ G <control>;<payload> ESC \
      const sequence = `\x1b_Ga=T,f=100;${BLACK_1X1_BASE64}\x1b\\`;
      await writeP(terminal, sequence);

      // Addon should have stored the image
      assert.equal(addon.images.size, 1);

      const image = addon.images.get(1)!;
      assert.exists(image);
      assert.equal(image.format, 100); // PNG format
      assert.equal(image.data, BLACK_1X1_BASE64);
    });

    it('should store RGB image with correct payload', async () => {
      const sequence = `\x1b_Ga=T,f=100;${RGB_3X1_BASE64}\x1b\\`;
      await writeP(terminal, sequence);

      assert.equal(addon.images.size, 1);
      const image = addon.images.get(1)!;
      assert.equal(image.data, RGB_3X1_BASE64);
    });

    it('should use explicit image id when provided', async () => {
      const sequence = `\x1b_Ga=T,f=100,i=42;${BLACK_1X1_BASE64}\x1b\\`;
      await writeP(terminal, sequence);

      assert.equal(addon.images.size, 1);
      assert.isTrue(addon.images.has(42));
      assert.isFalse(addon.images.has(1));
    });

    it('should handle transmit-only (a=t) without display', async () => {
      const sequence = `\x1b_Ga=t,f=100;${BLACK_1X1_BASE64}\x1b\\`;
      await writeP(terminal, sequence);

      // Image should still be stored??
      assert.equal(addon.images.size, 1);
    });

    it('should default to transmit action when action is omitted', async () => {
      // No a= key - should default to 't' (transmit)
      const sequence = `\x1b_Gf=100;${BLACK_1X1_BASE64}\x1b\\`;
      await writeP(terminal, sequence);

      // Image should be stored (transmit action)
      assert.equal(addon.images.size, 1);
    });

    it('should ignore command when action is empty string', async () => {
      // a= with no value is invalid - should be ignored
      const sequence = `\x1b_Ga=,f=100;${BLACK_1X1_BASE64}\x1b\\`;
      await writeP(terminal, sequence);

      // Empty action is invalid, command should be ignored
      assert.equal(addon.images.size, 0);
    });

    it('should delete image by id', async () => {
      // First store an image with id=5
      await writeP(terminal, `\x1b_Ga=T,f=100,i=5;${BLACK_1X1_BASE64}\x1b\\`);
      assert.equal(addon.images.size, 1);

      // Delete it
      await writeP(terminal, `\x1b_Ga=d,i=5\x1b\\`);
      assert.equal(addon.images.size, 0);
    });

    it('should delete all images when no id specified', async () => {
      // Store multiple images
      await writeP(terminal, `\x1b_Ga=T,f=100,i=1;${BLACK_1X1_BASE64}\x1b\\`);
      await writeP(terminal, `\x1b_Ga=T,f=100,i=2;${RGB_3X1_BASE64}\x1b\\`);
      assert.equal(addon.images.size, 2);

      // Delete all
      await writeP(terminal, `\x1b_Ga=d\x1b\\`);
      assert.equal(addon.images.size, 0);
    });

    it('should handle chunked transmission (m=1 flag)', async () => {
      // Split payload into chunks using m=1 (more data coming)
      const half = Math.floor(BLACK_1X1_BASE64.length / 2);
      const chunk1 = BLACK_1X1_BASE64.substring(0, half);
      const chunk2 = BLACK_1X1_BASE64.substring(half);

      // First chunk with m=1
      await writeP(terminal, `\x1b_Ga=t,f=100,i=10,m=1;${chunk1}\x1b\\`);
      // Image not complete yet (pending)
      assert.equal(addon.images.size, 0);

      // Final chunk without m=1
      await writeP(terminal, `\x1b_Ga=t,f=100,i=10;${chunk2}\x1b\\`);
      // Now image should be stored
      assert.equal(addon.images.size, 1);

      const image = addon.images.get(10)!;
      assert.equal(image.data, BLACK_1X1_BASE64);
    });
  });
});
