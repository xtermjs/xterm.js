
import { assert } from 'chai';
import { evaluateKeyboardEventKitty, KittyKeyboardEventType, KittyKeyboardFlags, shouldUseKittyProtocol } from 'common/input/KittyKeyboard';
import { IKeyboardResult, IKeyboardEvent } from 'common/Types';

function createEvent(partialEvent: Partial<IKeyboardEvent> = {}): IKeyboardEvent {
  return {
    altKey: partialEvent.altKey || false,
    ctrlKey: partialEvent.ctrlKey || false,
    shiftKey: partialEvent.shiftKey || false,
    metaKey: partialEvent.metaKey || false,
    keyCode: partialEvent.keyCode !== undefined ? partialEvent.keyCode : 0,
    code: partialEvent.code || '',
    key: partialEvent.key || '',
    type: partialEvent.type || 'keydown'
  };
}

describe('KittyKeyboard', () => {
  describe('shouldUseKittyProtocol', () => {
    it('should return false when flags are 0', () => {
      assert.strictEqual(shouldUseKittyProtocol(0), false);
    });

    it('should return true when any flag is set', () => {
      assert.strictEqual(shouldUseKittyProtocol(KittyKeyboardFlags.DISAMBIGUATE_ESCAPE_CODES), true);
      assert.strictEqual(shouldUseKittyProtocol(KittyKeyboardFlags.REPORT_EVENT_TYPES), true);
      assert.strictEqual(shouldUseKittyProtocol(0b11111), true);
    });
  });

  describe('evaluateKeyboardEventKitty', () => {
    describe('with DISAMBIGUATE_ESCAPE_CODES flag', () => {
      const flags = KittyKeyboardFlags.DISAMBIGUATE_ESCAPE_CODES;

      it('should encode Escape as CSI 27 u', () => {
        const result = evaluateKeyboardEventKitty(createEvent({ key: 'Escape' }), flags);
        assert.strictEqual(result.key, '\x1b[27u');
      });

      it('should encode Enter as CSI 13 u', () => {
        const result = evaluateKeyboardEventKitty(createEvent({ key: 'Enter' }), flags);
        assert.strictEqual(result.key, '\x1b[13u');
      });

      it('should encode Backspace as CSI 127 u', () => {
        const result = evaluateKeyboardEventKitty(createEvent({ key: 'Backspace' }), flags);
        assert.strictEqual(result.key, '\x1b[127u');
      });

      it('should encode Tab as CSI 9 u', () => {
        const result = evaluateKeyboardEventKitty(createEvent({ key: 'Tab' }), flags);
        assert.strictEqual(result.key, '\x1b[9u');
      });

      it('should encode Shift+Tab with modifiers', () => {
        const result = evaluateKeyboardEventKitty(createEvent({ key: 'Tab', shiftKey: true }), flags);
        assert.strictEqual(result.key, '\x1b[9;2u');
      });

      it('should encode arrow keys using Kitty codepoints', () => {
        assert.strictEqual(evaluateKeyboardEventKitty(createEvent({ key: 'ArrowUp' }), flags).key, '\x1b[57417u');
        assert.strictEqual(evaluateKeyboardEventKitty(createEvent({ key: 'ArrowDown' }), flags).key, '\x1b[57420u');
        assert.strictEqual(evaluateKeyboardEventKitty(createEvent({ key: 'ArrowLeft' }), flags).key, '\x1b[57419u');
        assert.strictEqual(evaluateKeyboardEventKitty(createEvent({ key: 'ArrowRight' }), flags).key, '\x1b[57421u');
      });

      it('should encode F1-F4 using Kitty codepoints', () => {
        assert.strictEqual(evaluateKeyboardEventKitty(createEvent({ key: 'F1' }), flags).key, '\x1b[57364u');
        assert.strictEqual(evaluateKeyboardEventKitty(createEvent({ key: 'F2' }), flags).key, '\x1b[57365u');
        assert.strictEqual(evaluateKeyboardEventKitty(createEvent({ key: 'F3' }), flags).key, '\x1b[57366u');
        assert.strictEqual(evaluateKeyboardEventKitty(createEvent({ key: 'F4' }), flags).key, '\x1b[57367u');
      });

      it('should encode Ctrl+A with modifiers', () => {
        const result = evaluateKeyboardEventKitty(createEvent({ key: 'a', ctrlKey: true }), flags);
        assert.strictEqual(result.key, '\x1b[97;5u');
      });

      it('should encode Alt+X with modifiers', () => {
        const result = evaluateKeyboardEventKitty(createEvent({ key: 'x', altKey: true }), flags);
        assert.strictEqual(result.key, '\x1b[120;3u');
      });

      it('should encode Ctrl+Shift+A with combined modifiers', () => {
        const result = evaluateKeyboardEventKitty(createEvent({ key: 'A', ctrlKey: true, shiftKey: true }), flags);
        assert.strictEqual(result.key, '\x1b[65;6u');
      });
    });

    describe('with REPORT_EVENT_TYPES flag', () => {
      const flags = KittyKeyboardFlags.DISAMBIGUATE_ESCAPE_CODES | KittyKeyboardFlags.REPORT_EVENT_TYPES;

      it('should not include event type for press events', () => {
        const result = evaluateKeyboardEventKitty(createEvent({ key: 'a' }), flags, KittyKeyboardEventType.PRESS);
        assert.strictEqual(result.key, '\x1b[97u');
      });

      it('should include event type for repeat events', () => {
        const result = evaluateKeyboardEventKitty(createEvent({ key: 'a' }), flags, KittyKeyboardEventType.REPEAT);
        assert.strictEqual(result.key, '\x1b[97;:2u');
      });

      it('should include event type for release events', () => {
        const result = evaluateKeyboardEventKitty(createEvent({ key: 'a' }), flags, KittyKeyboardEventType.RELEASE);
        assert.strictEqual(result.key, '\x1b[97;:3u');
      });

      it('should include modifiers and event type', () => {
        const result = evaluateKeyboardEventKitty(createEvent({ key: 'a', ctrlKey: true }), flags, KittyKeyboardEventType.RELEASE);
        assert.strictEqual(result.key, '\x1b[97;5:3u');
      });
    });

    describe('with REPORT_ALL_KEYS_AS_ESCAPE_CODES flag', () => {
      const flags = KittyKeyboardFlags.REPORT_ALL_KEYS_AS_ESCAPE_CODES;

      it('should encode regular letters as CSI u', () => {
        const result = evaluateKeyboardEventKitty(createEvent({ key: 'a' }), flags);
        assert.strictEqual(result.key, '\x1b[97u');
      });

      it('should encode numbers as CSI u', () => {
        const result = evaluateKeyboardEventKitty(createEvent({ key: '1' }), flags);
        assert.strictEqual(result.key, '\x1b[49u');
      });

      it('should encode space as CSI 32 u', () => {
        const result = evaluateKeyboardEventKitty(createEvent({ key: ' ' }), flags);
        assert.strictEqual(result.key, '\x1b[32u');
      });
    });

    describe('numpad keys', () => {
      const flags = KittyKeyboardFlags.DISAMBIGUATE_ESCAPE_CODES;

      it('should encode numpad digits with Kitty codepoints', () => {
        const result = evaluateKeyboardEventKitty(createEvent({ key: '0', code: 'Numpad0' }), flags);
        assert.strictEqual(result.key, '\x1b[57399u');
      });

      it('should encode numpad enter', () => {
        const result = evaluateKeyboardEventKitty(createEvent({ key: 'Enter', code: 'NumpadEnter' }), flags);
        assert.strictEqual(result.key, '\x1b[57414u');
      });
    });

    describe('modifier keys', () => {
      const flags = KittyKeyboardFlags.DISAMBIGUATE_ESCAPE_CODES | KittyKeyboardFlags.REPORT_EVENT_TYPES;

      it('should encode left shift with correct codepoint', () => {
        const result = evaluateKeyboardEventKitty(createEvent({ key: 'Shift', code: 'ShiftLeft', shiftKey: true }), flags);
        assert.strictEqual(result.key, '\x1b[57441;2u');
      });

      it('should encode right control with correct codepoint', () => {
        const result = evaluateKeyboardEventKitty(createEvent({ key: 'Control', code: 'ControlRight', ctrlKey: true }), flags);
        assert.strictEqual(result.key, '\x1b[57448;5u');
      });
    });

    describe('release events without REPORT_EVENT_TYPES', () => {
      const flags = KittyKeyboardFlags.DISAMBIGUATE_ESCAPE_CODES;

      it('should not generate key sequence for release events', () => {
        const result = evaluateKeyboardEventKitty(createEvent({ key: 'a' }), flags, KittyKeyboardEventType.RELEASE);
        assert.strictEqual(result.key, undefined);
      });
    });
  });
});
