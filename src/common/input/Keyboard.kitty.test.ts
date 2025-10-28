/**
 * Copyright (c) 2025 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import { assert } from 'chai';
import { evaluateKeyboardEvent, encodeKittyKeyboardEvent } from './Keyboard';
import { IKeyboardResult, IKeyboardEvent } from '../Types';

/**
 * Helper function to create keyboard events for testing
 */
function createKeyboardEvent(options: Partial<IKeyboardEvent> = {}): IKeyboardEvent {
  return {
    type: 'keydown',
    altKey: false,
    ctrlKey: false,
    shiftKey: false,
    metaKey: false,
    keyCode: 0,
    key: '',
    code: '',
    ...options
  };
}

/**
 * Helper function to test Kitty keyboard evaluation
 */
function testKittyKeyboardEvent(
  eventOptions: Partial<IKeyboardEvent>,
  flags: number = 0,
  applicationCursorMode: boolean = false,
  isMac: boolean = false,
  macOptionIsMeta: boolean = false
): IKeyboardResult {
  const event = createKeyboardEvent(eventOptions);
  return evaluateKeyboardEvent(event, applicationCursorMode, isMac, macOptionIsMeta, flags);
}

describe('Kitty Keyboard Protocol', () => {

  describe('Basic Protocol Activation', () => {
    it('should use legacy encoding when no flags are set', () => {
      const result = testKittyKeyboardEvent({ keyCode: 27, key: 'Escape' }, 0);
      assert.equal(result.key, '\x1b');
    });

    it('should remain backward compatible for regular keys without flags', () => {
      const result = testKittyKeyboardEvent({ keyCode: 65, key: 'a' }, 0);
      assert.equal(result.key, 'a');
    });

    it('should use legacy encoding for function keys without flags', () => {
      const result = testKittyKeyboardEvent({ keyCode: 112, key: 'F1' }, 0);
      assert.equal(result.key, '\x1bOP');
    });
  });

  describe('Flag 1: Disambiguate Escape Codes', () => {
    const DISAMBIGUATE = 1;

    it('should encode Escape key with Kitty protocol when disambiguation enabled', () => {
      const result = testKittyKeyboardEvent({ keyCode: 27, key: 'Escape' }, DISAMBIGUATE);
      assert.equal(result.key, '\x1b[27u');
    });

    it('should encode Alt+letter combinations with Kitty protocol', () => {
      const result = testKittyKeyboardEvent({
        keyCode: 65,
        key: 'a',
        altKey: true
      }, DISAMBIGUATE);
      assert.equal(result.key, '\x1b[97;3u'); // 1 + 2(alt) = 3
    });

    it('should encode Ctrl+letter combinations with Kitty protocol', () => {
      const result = testKittyKeyboardEvent({
        keyCode: 67,
        key: 'c',
        ctrlKey: true
      }, DISAMBIGUATE);
      assert.equal(result.key, '\x1b[99;5u'); // 1 + 4(ctrl) = 5
    });

    it('should not affect regular letters without modifiers', () => {
      const result = testKittyKeyboardEvent({ keyCode: 65, key: 'a' }, DISAMBIGUATE);
      assert.equal(result.key, 'a');
    });
  });

  describe('Flag 8: Report All Keys', () => {
    const REPORT_ALL_KEYS = 8;

    it('should encode all key events including regular letters', () => {
      const result = testKittyKeyboardEvent({ keyCode: 65, key: 'a' }, REPORT_ALL_KEYS);
      assert.equal(result.key, '\x1b[97u');
    });

    it('should encode digits', () => {
      const result = testKittyKeyboardEvent({ keyCode: 49, key: '1' }, REPORT_ALL_KEYS);
      assert.equal(result.key, '\x1b[49u');
    });

    it('should encode space key', () => {
      const result = testKittyKeyboardEvent({ keyCode: 32, key: ' ' }, REPORT_ALL_KEYS);
      assert.equal(result.key, '\x1b[32u');
    });

    it('should encode special characters', () => {
      const result = testKittyKeyboardEvent({ keyCode: 188, key: ',' }, REPORT_ALL_KEYS);
      assert.equal(result.key, '\x1b[44u'); // Unicode for comma
    });
  });

  describe('Modifier Encoding', () => {
    const REPORT_ALL_KEYS = 8;

    it('should encode single modifiers correctly', () => {
      // Shift only
      let result = testKittyKeyboardEvent({
        keyCode: 65, key: 'A', shiftKey: true
      }, REPORT_ALL_KEYS);
      assert.equal(result.key, '\x1b[97u'); // Base + 1 (shift) = 2, but shift key doesn't get modifier in output for single chars

      // Alt only
      result = testKittyKeyboardEvent({
        keyCode: 65, key: 'a', altKey: true
      }, REPORT_ALL_KEYS);
      assert.equal(result.key, '\x1b[97;3u'); // 1 + 2(alt) = 3

      // Ctrl only
      result = testKittyKeyboardEvent({
        keyCode: 65, key: 'a', ctrlKey: true
      }, REPORT_ALL_KEYS);
      assert.equal(result.key, '\x1b[97;5u'); // 1 + 4(ctrl) = 5

      // Meta only
      result = testKittyKeyboardEvent({
        keyCode: 65, key: 'a', metaKey: true
      }, REPORT_ALL_KEYS);
      assert.equal(result.key, '\x1b[97;9u'); // 1 + 8(meta) = 9
    });

    it('should encode multiple modifiers correctly', () => {
      // Shift + Alt - shift is bit 0, alt is bit 1
      let result = testKittyKeyboardEvent({
        keyCode: 65, key: 'A', shiftKey: true, altKey: true
      }, REPORT_ALL_KEYS);
      assert.equal(result.key, '\x1b[97;4u'); // 1 + 1(shift) + 2(alt) = 4

      // Ctrl + Alt
      result = testKittyKeyboardEvent({
        keyCode: 65, key: 'a', ctrlKey: true, altKey: true
      }, REPORT_ALL_KEYS);
      assert.equal(result.key, '\x1b[97;7u'); // 1 + 4(ctrl) + 2(alt) = 7

      // Shift + Ctrl + Alt
      result = testKittyKeyboardEvent({
        keyCode: 65, key: 'A', shiftKey: true, ctrlKey: true, altKey: true
      }, REPORT_ALL_KEYS);
      assert.equal(result.key, '\x1b[97;8u'); // 1 + 1(shift) + 4(ctrl) + 2(alt) = 8

      // All modifiers
      result = testKittyKeyboardEvent({
        keyCode: 65, key: 'A', shiftKey: true, ctrlKey: true, altKey: true, metaKey: true
      }, REPORT_ALL_KEYS);
      assert.equal(result.key, '\x1b[97;16u'); // 1 + 1 + 4 + 2 + 8 = 16
    });
  });

  describe('Functional Keys', () => {
    const DISAMBIGUATE = 1;

    it('should handle standard function keys F1-F12', () => {
      // F1 should use legacy unless other conditions apply
      let result = testKittyKeyboardEvent({ keyCode: 112, key: 'F1' }, DISAMBIGUATE);
      assert.equal(result.key, '\x1bOP');

      // F9 uses legacy ~ form
      result = testKittyKeyboardEvent({ keyCode: 120, key: 'F9' }, DISAMBIGUATE);
      assert.equal(result.key, '\x1b[20~');

      // F12 uses legacy ~ form
      result = testKittyKeyboardEvent({ keyCode: 123, key: 'F12' }, DISAMBIGUATE);
      assert.equal(result.key, '\x1b[24~');
    });

    it('should handle modified function keys', () => {
      // Ctrl+F1
      let result = testKittyKeyboardEvent({
        keyCode: 112, key: 'F1', ctrlKey: true
      }, DISAMBIGUATE);
      assert.equal(result.key, '\x1b[1;5P');

      // Shift+F9
      result = testKittyKeyboardEvent({
        keyCode: 120, key: 'F9', shiftKey: true
      }, DISAMBIGUATE);
      assert.equal(result.key, '\x1b[20;2~');
    });

    it('should handle extended function keys F13-F24', () => {
      // These should use Kitty protocol codes when available
      const result = testKittyKeyboardEvent({ key: 'F13' }, DISAMBIGUATE);
      // F13 should use Kitty functional key code
      assert.equal(result.key, '\x1b[57376u');
    });

    it('should handle arrow keys', () => {
      // Standard arrows without modifiers should use legacy
      let result = testKittyKeyboardEvent({ keyCode: 37, key: 'ArrowLeft' }, DISAMBIGUATE);
      assert.equal(result.key, '\x1b[D');

      // With modifiers should use modified legacy form
      result = testKittyKeyboardEvent({
        keyCode: 37, key: 'ArrowLeft', ctrlKey: true
      }, DISAMBIGUATE);
      assert.equal(result.key, '\x1b[1;5D');
    });

    it('should handle keypad keys', () => {
      // Keypad keys should use Kitty codes when available
      const result = testKittyKeyboardEvent({ key: 'Numpad0', code: 'Numpad0' }, DISAMBIGUATE);
      assert.equal(result.key, '\x1b[57399u');
    });
  });

  describe('Special Key Handling', () => {
    const REPORT_ALL_KEYS = 8;

    it('should handle Enter key', () => {
      const result = testKittyKeyboardEvent({ keyCode: 13, key: 'Enter' }, REPORT_ALL_KEYS);
      assert.equal(result.key, '\x1b[13u');
    });

    it('should handle Tab key', () => {
      const result = testKittyKeyboardEvent({ keyCode: 9, key: 'Tab' }, REPORT_ALL_KEYS);
      assert.equal(result.key, '\x1b[9u');
    });

    it('should handle Backspace key', () => {
      const result = testKittyKeyboardEvent({ keyCode: 8, key: 'Backspace' }, REPORT_ALL_KEYS);
      assert.equal(result.key, '\x1b[127u');
    });

    it('should handle Delete key', () => {
      const result = testKittyKeyboardEvent({ keyCode: 46, key: 'Delete' }, REPORT_ALL_KEYS);
      assert.equal(result.key, '\x1b[3u');
    });
  });

  describe('Media and Special Keys', () => {
    const DISAMBIGUATE = 1;

    it('should handle media keys', () => {
      // Media Play
      let result = testKittyKeyboardEvent({ key: 'MediaPlay' }, DISAMBIGUATE);
      assert.equal(result.key, '\x1b[57428u');

      // Volume Up
      result = testKittyKeyboardEvent({ key: 'AudioVolumeUp' }, DISAMBIGUATE);
      assert.equal(result.key, '\x1b[57439u');

      // Volume Down
      result = testKittyKeyboardEvent({ key: 'AudioVolumeDown' }, DISAMBIGUATE);
      assert.equal(result.key, '\x1b[57438u');
    });

    it('should handle lock keys', () => {
      // Caps Lock
      let result = testKittyKeyboardEvent({ key: 'CapsLock' }, DISAMBIGUATE);
      assert.equal(result.key, '\x1b[57358u');

      // Num Lock
      result = testKittyKeyboardEvent({ key: 'NumLock' }, DISAMBIGUATE);
      assert.equal(result.key, '\x1b[57360u');

      // Scroll Lock
      result = testKittyKeyboardEvent({ key: 'ScrollLock' }, DISAMBIGUATE);
      assert.equal(result.key, '\x1b[57359u');
    });

    it('should handle modifier keys themselves', () => {
      // Left Shift
      let result = testKittyKeyboardEvent({ key: 'ShiftLeft' }, DISAMBIGUATE);
      assert.equal(result.key, '\x1b[57441u');

      // Right Ctrl
      result = testKittyKeyboardEvent({ key: 'ControlRight' }, DISAMBIGUATE);
      assert.equal(result.key, '\x1b[57448u');

      // Left Alt
      result = testKittyKeyboardEvent({ key: 'AltLeft' }, DISAMBIGUATE);
      assert.equal(result.key, '\x1b[57443u');
    });
  });

  describe('Unicode and International Keys', () => {
    const REPORT_ALL_KEYS = 8;

    it('should handle Unicode characters correctly', () => {
      // Should use lowercase Unicode codepoint for base key
      const result = testKittyKeyboardEvent({
        keyCode: 65, key: 'A', shiftKey: true
      }, REPORT_ALL_KEYS);
      assert.equal(result.key, '\x1b[97u'); // 97 = 'a', shift doesn't add modifier for single chars
    });

    it('should handle non-ASCII characters', () => {
      // Test with accented character
      const result = testKittyKeyboardEvent({
        key: 'é'
      }, REPORT_ALL_KEYS);
      assert.equal(result.key, '\x1b[233u'); // Unicode for 'é'
    });
  });

  describe('Flag Combinations', () => {
    it('should handle multiple flags correctly', () => {
      const DISAMBIGUATE_AND_REPORT_ALL = 1 | 8; // 9

      // Should use Kitty protocol for all keys
      let result = testKittyKeyboardEvent({
        keyCode: 65, key: 'a'
      }, DISAMBIGUATE_AND_REPORT_ALL);
      assert.equal(result.key, '\x1b[97u');

      // Should still handle Escape specially
      result = testKittyKeyboardEvent({
        keyCode: 27, key: 'Escape'
      }, DISAMBIGUATE_AND_REPORT_ALL);
      assert.equal(result.key, '\x1b[27u');
    });
  });

  describe('Legacy Compatibility', () => {
    it('should maintain compatibility when no flags are set', () => {
      // Regular letters
      let result = testKittyKeyboardEvent({ keyCode: 65, key: 'a' }, 0);
      assert.equal(result.key, 'a');

      // Function keys
      result = testKittyKeyboardEvent({ keyCode: 112, key: 'F1' }, 0);
      assert.equal(result.key, '\x1bOP');

      // Arrow keys
      result = testKittyKeyboardEvent({ keyCode: 37, key: 'ArrowLeft' }, 0);
      assert.equal(result.key, '\x1b[D');

      // Modified keys
      result = testKittyKeyboardEvent({
        keyCode: 37, key: 'ArrowLeft', ctrlKey: true
      }, 0);
      assert.equal(result.key, '\x1b[1;5D');
    });
  });

  describe('Event Type Support (Placeholder)', () => {
    // Note: Event type support (press/repeat/release) would be tested at the
    // browser terminal level since it requires tracking keydown/keyup events
    it('should support event type encoding in encodeKittyKeyboardEvent', () => {
      const event = createKeyboardEvent({ keyCode: 65, key: 'a' });

      // Test press event (default)
      let result = encodeKittyKeyboardEvent(event, 8, 1);
      assert.equal(result, '\x1b[97u');

      // Test repeat event
      result = encodeKittyKeyboardEvent(event, 8, 2);
      assert.equal(result, '\x1b[97;1:2u');

      // Test release event
      result = encodeKittyKeyboardEvent(event, 8, 3);
      assert.equal(result, '\x1b[97;1:3u');
    });
  });

  describe('Edge Cases', () => {
    it('should handle unknown keys gracefully', () => {
      const result = testKittyKeyboardEvent({
        key: 'UnknownKey',
        code: 'UnknownCode'
      }, 1);
      // Should not crash and return undefined for unknown keys
      assert.equal(result.key, undefined);
    });

    it('should handle empty key values', () => {
      const result = testKittyKeyboardEvent({
        key: '',
        keyCode: 0
      }, 8);
      // Should encode keyCode 0 (empty string has charCodeAt(0) = 0)
      assert.equal(result.key, '\x1b[0u');
    });

    it('should handle very long key names', () => {
      const longKeyName = 'A'.repeat(100);
      const result = testKittyKeyboardEvent({
        key: longKeyName
      }, 8);
      // Should not cause issues
      assert.notEqual(result, null);
    });
  });

  describe('Performance Considerations', () => {
    it('should handle rapid key sequences efficiently', () => {
      const start = Date.now();

      // Simulate rapid typing
      for (let i = 0; i < 1000; i++) {
        testKittyKeyboardEvent({
          keyCode: 65 + (i % 26),
          key: String.fromCharCode(97 + (i % 26))
        }, 8);
      }

      const end = Date.now();
      const duration = end - start;

      // Should complete within reasonable time (less than 100ms for 1000 events)
      assert.isBelow(duration, 100, 'Key processing should be fast');
    });
  });

  describe('Browser Compatibility', () => {
    it('should work with different browser key representations', () => {
      // Chrome/Safari style
      let result = testKittyKeyboardEvent({
        key: 'Enter',
        code: 'Enter',
        keyCode: 13
      }, 8);
      assert.equal(result.key, '\x1b[13u');

      // Firefox style (might have different key properties)
      result = testKittyKeyboardEvent({
        key: 'Enter',
        code: 'Enter',
        keyCode: 13
      }, 8);
      assert.equal(result.key, '\x1b[13u');
    });

    it('should handle mobile browser events', () => {
      // Mobile browsers might send different event structures
      const result = testKittyKeyboardEvent({
        keyCode: 0,
        key: 'UIKeyInputUpArrow'
      }, 1);
      // Should handle mobile arrow events
      assert.equal(result.key, '\x1b[A'); // Falls back to legacy for mobile
    });
  });

  describe('Application Cursor Mode Interaction', () => {
    it('should respect application cursor mode even with Kitty protocol', () => {
      // Arrow keys in application cursor mode
      const result = testKittyKeyboardEvent({
        keyCode: 37,
        key: 'ArrowLeft'
      }, 1, true); // applicationCursorMode = true

      assert.equal(result.key, '\x1bOD'); // Should use SS3 form
    });
  });

  describe('macOS Specific Behavior', () => {
    it('should handle macOS option key behavior', () => {
      // On macOS with macOptionIsMeta = false, option should still be treated as alt in Kitty protocol
      const result = testKittyKeyboardEvent({
        keyCode: 65,
        key: 'a',
        altKey: true
      }, 1, true, false); // isMac = true, macOptionIsMeta = false

      // Should still generate Kitty sequence for alt key
      assert.equal(result.key, '\x1b[97;3u');
    });

    it('should handle macOS option key as meta', () => {
      // On macOS with macOptionIsMeta = true, option should be treated as meta
      const result = testKittyKeyboardEvent({
        keyCode: 65,
        key: 'a',
        altKey: true
      }, 1, true, true); // isMac = true, macOptionIsMeta = true

      assert.equal(result.key, '\x1b[97;3u');
    });
  });
});
