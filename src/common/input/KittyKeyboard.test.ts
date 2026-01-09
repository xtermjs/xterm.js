
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
    describe('modifier encoding (value = 1 + modifiers)', () => {
      const flags = KittyKeyboardFlags.DISAMBIGUATE_ESCAPE_CODES;

      it('shift=2 (1+1)', () => {
        const result = evaluateKeyboardEventKitty(createEvent({ key: 'a', shiftKey: true }), flags);
        assert.strictEqual(result.key, '\x1b[97;2u');
      });

      it('alt=3 (1+2)', () => {
        const result = evaluateKeyboardEventKitty(createEvent({ key: 'a', altKey: true }), flags);
        assert.strictEqual(result.key, '\x1b[97;3u');
      });

      it('ctrl=5 (1+4)', () => {
        const result = evaluateKeyboardEventKitty(createEvent({ key: 'a', ctrlKey: true }), flags);
        assert.strictEqual(result.key, '\x1b[97;5u');
      });

      it('super/meta=9 (1+8)', () => {
        const result = evaluateKeyboardEventKitty(createEvent({ key: 'a', metaKey: true }), flags);
        assert.strictEqual(result.key, '\x1b[97;9u');
      });

      it('ctrl+shift=6 (1+4+1)', () => {
        const result = evaluateKeyboardEventKitty(createEvent({ key: 'a', ctrlKey: true, shiftKey: true }), flags);
        assert.strictEqual(result.key, '\x1b[97;6u');
      });

      it('ctrl+alt=7 (1+4+2)', () => {
        const result = evaluateKeyboardEventKitty(createEvent({ key: 'a', ctrlKey: true, altKey: true }), flags);
        assert.strictEqual(result.key, '\x1b[97;7u');
      });

      it('ctrl+alt+shift=8 (1+4+2+1)', () => {
        const result = evaluateKeyboardEventKitty(createEvent({ key: 'a', ctrlKey: true, altKey: true, shiftKey: true }), flags);
        assert.strictEqual(result.key, '\x1b[97;8u');
      });

      it('ctrl+super=13 (1+4+8)', () => {
        const result = evaluateKeyboardEventKitty(createEvent({ key: 'a', ctrlKey: true, metaKey: true }), flags);
        assert.strictEqual(result.key, '\x1b[97;13u');
      });

      it('all four modifiers=16 (1+1+2+4+8)', () => {
        const result = evaluateKeyboardEventKitty(createEvent({ key: 'a', shiftKey: true, altKey: true, ctrlKey: true, metaKey: true }), flags);
        assert.strictEqual(result.key, '\x1b[97;16u');
      });

      it('no modifiers omits modifier field', () => {
        const result = evaluateKeyboardEventKitty(createEvent({ key: 'Escape' }), flags);
        assert.strictEqual(result.key, '\x1b[27u');
      });
    });

    describe('C0 control keys with DISAMBIGUATE_ESCAPE_CODES', () => {
      const flags = KittyKeyboardFlags.DISAMBIGUATE_ESCAPE_CODES;

      it('Escape → CSI 27 u', () => {
        const result = evaluateKeyboardEventKitty(createEvent({ key: 'Escape' }), flags);
        assert.strictEqual(result.key, '\x1b[27u');
      });

      it('Enter → CSI 13 u', () => {
        const result = evaluateKeyboardEventKitty(createEvent({ key: 'Enter' }), flags);
        assert.strictEqual(result.key, '\x1b[13u');
      });

      it('Tab → CSI 9 u', () => {
        const result = evaluateKeyboardEventKitty(createEvent({ key: 'Tab' }), flags);
        assert.strictEqual(result.key, '\x1b[9u');
      });

      it('Backspace → CSI 127 u', () => {
        const result = evaluateKeyboardEventKitty(createEvent({ key: 'Backspace' }), flags);
        assert.strictEqual(result.key, '\x1b[127u');
      });

      it('Space → CSI 32 u', () => {
        const result = evaluateKeyboardEventKitty(createEvent({ key: ' ' }), flags);
        assert.strictEqual(result.key, '\x1b[32u');
      });

      it('Shift+Tab → CSI 9;2 u', () => {
        const result = evaluateKeyboardEventKitty(createEvent({ key: 'Tab', shiftKey: true }), flags);
        assert.strictEqual(result.key, '\x1b[9;2u');
      });

      it('Ctrl+Enter → CSI 13;5 u', () => {
        const result = evaluateKeyboardEventKitty(createEvent({ key: 'Enter', ctrlKey: true }), flags);
        assert.strictEqual(result.key, '\x1b[13;5u');
      });

      it('Alt+Escape → CSI 27;3 u', () => {
        const result = evaluateKeyboardEventKitty(createEvent({ key: 'Escape', altKey: true }), flags);
        assert.strictEqual(result.key, '\x1b[27;3u');
      });
    });

    describe('navigation keys', () => {
      const flags = KittyKeyboardFlags.DISAMBIGUATE_ESCAPE_CODES;

      it('Insert → CSI 2 ~', () => {
        const result = evaluateKeyboardEventKitty(createEvent({ key: 'Insert' }), flags);
        assert.strictEqual(result.key, '\x1b[2~');
      });

      it('Delete → CSI 3 ~', () => {
        const result = evaluateKeyboardEventKitty(createEvent({ key: 'Delete' }), flags);
        assert.strictEqual(result.key, '\x1b[3~');
      });

      it('PageUp → CSI 5 ~', () => {
        const result = evaluateKeyboardEventKitty(createEvent({ key: 'PageUp' }), flags);
        assert.strictEqual(result.key, '\x1b[5~');
      });

      it('PageDown → CSI 6 ~', () => {
        const result = evaluateKeyboardEventKitty(createEvent({ key: 'PageDown' }), flags);
        assert.strictEqual(result.key, '\x1b[6~');
      });

      it('Home → CSI H', () => {
        const result = evaluateKeyboardEventKitty(createEvent({ key: 'Home' }), flags);
        assert.strictEqual(result.key, '\x1b[H');
      });

      it('End → CSI F', () => {
        const result = evaluateKeyboardEventKitty(createEvent({ key: 'End' }), flags);
        assert.strictEqual(result.key, '\x1b[F');
      });

      it('Shift+PageUp → CSI 5;2 ~', () => {
        const result = evaluateKeyboardEventKitty(createEvent({ key: 'PageUp', shiftKey: true }), flags);
        assert.strictEqual(result.key, '\x1b[5;2~');
      });

      it('Ctrl+Home → CSI 1;5 H', () => {
        const result = evaluateKeyboardEventKitty(createEvent({ key: 'Home', ctrlKey: true }), flags);
        assert.strictEqual(result.key, '\x1b[1;5H');
      });
    });

    describe('arrow keys', () => {
      const flags = KittyKeyboardFlags.DISAMBIGUATE_ESCAPE_CODES;

      it('ArrowUp → CSI A', () => {
        const result = evaluateKeyboardEventKitty(createEvent({ key: 'ArrowUp' }), flags);
        assert.strictEqual(result.key, '\x1b[A');
      });

      it('ArrowDown → CSI B', () => {
        const result = evaluateKeyboardEventKitty(createEvent({ key: 'ArrowDown' }), flags);
        assert.strictEqual(result.key, '\x1b[B');
      });

      it('ArrowRight → CSI C', () => {
        const result = evaluateKeyboardEventKitty(createEvent({ key: 'ArrowRight' }), flags);
        assert.strictEqual(result.key, '\x1b[C');
      });

      it('ArrowLeft → CSI D', () => {
        const result = evaluateKeyboardEventKitty(createEvent({ key: 'ArrowLeft' }), flags);
        assert.strictEqual(result.key, '\x1b[D');
      });

      it('Shift+ArrowUp → CSI 1;2 A', () => {
        const result = evaluateKeyboardEventKitty(createEvent({ key: 'ArrowUp', shiftKey: true }), flags);
        assert.strictEqual(result.key, '\x1b[1;2A');
      });

      it('Ctrl+ArrowLeft → CSI 1;5 D', () => {
        const result = evaluateKeyboardEventKitty(createEvent({ key: 'ArrowLeft', ctrlKey: true }), flags);
        assert.strictEqual(result.key, '\x1b[1;5D');
      });

      it('Ctrl+Shift+ArrowRight → CSI 1;6 C', () => {
        const result = evaluateKeyboardEventKitty(createEvent({ key: 'ArrowRight', ctrlKey: true, shiftKey: true }), flags);
        assert.strictEqual(result.key, '\x1b[1;6C');
      });
    });

    describe('function keys F1-F12', () => {
      const flags = KittyKeyboardFlags.DISAMBIGUATE_ESCAPE_CODES;

      it('F1 → CSI P (SS3 form)', () => {
        const result = evaluateKeyboardEventKitty(createEvent({ key: 'F1' }), flags);
        assert.strictEqual(result.key, '\x1bOP');
      });

      it('F2 → CSI Q (SS3 form)', () => {
        const result = evaluateKeyboardEventKitty(createEvent({ key: 'F2' }), flags);
        assert.strictEqual(result.key, '\x1bOQ');
      });

      it('F3 → CSI R (SS3 form)', () => {
        const result = evaluateKeyboardEventKitty(createEvent({ key: 'F3' }), flags);
        assert.strictEqual(result.key, '\x1bOR');
      });

      it('F4 → CSI S (SS3 form)', () => {
        const result = evaluateKeyboardEventKitty(createEvent({ key: 'F4' }), flags);
        assert.strictEqual(result.key, '\x1bOS');
      });

      it('F5 → CSI 15 ~', () => {
        const result = evaluateKeyboardEventKitty(createEvent({ key: 'F5' }), flags);
        assert.strictEqual(result.key, '\x1b[15~');
      });

      it('F6 → CSI 17 ~', () => {
        const result = evaluateKeyboardEventKitty(createEvent({ key: 'F6' }), flags);
        assert.strictEqual(result.key, '\x1b[17~');
      });

      it('F7 → CSI 18 ~', () => {
        const result = evaluateKeyboardEventKitty(createEvent({ key: 'F7' }), flags);
        assert.strictEqual(result.key, '\x1b[18~');
      });

      it('F8 → CSI 19 ~', () => {
        const result = evaluateKeyboardEventKitty(createEvent({ key: 'F8' }), flags);
        assert.strictEqual(result.key, '\x1b[19~');
      });

      it('F9 → CSI 20 ~', () => {
        const result = evaluateKeyboardEventKitty(createEvent({ key: 'F9' }), flags);
        assert.strictEqual(result.key, '\x1b[20~');
      });

      it('F10 → CSI 21 ~', () => {
        const result = evaluateKeyboardEventKitty(createEvent({ key: 'F10' }), flags);
        assert.strictEqual(result.key, '\x1b[21~');
      });

      it('F11 → CSI 23 ~', () => {
        const result = evaluateKeyboardEventKitty(createEvent({ key: 'F11' }), flags);
        assert.strictEqual(result.key, '\x1b[23~');
      });

      it('F12 → CSI 24 ~', () => {
        const result = evaluateKeyboardEventKitty(createEvent({ key: 'F12' }), flags);
        assert.strictEqual(result.key, '\x1b[24~');
      });

      it('Shift+F1 → CSI 1;2 P', () => {
        const result = evaluateKeyboardEventKitty(createEvent({ key: 'F1', shiftKey: true }), flags);
        assert.strictEqual(result.key, '\x1b[1;2P');
      });

      it('Ctrl+F5 → CSI 15;5 ~', () => {
        const result = evaluateKeyboardEventKitty(createEvent({ key: 'F5', ctrlKey: true }), flags);
        assert.strictEqual(result.key, '\x1b[15;5~');
      });
    });

    describe('extended function keys F13-F35 (Private Use Area)', () => {
      const flags = KittyKeyboardFlags.DISAMBIGUATE_ESCAPE_CODES;

      it('F13 → CSI 57376 u', () => {
        const result = evaluateKeyboardEventKitty(createEvent({ key: 'F13' }), flags);
        assert.strictEqual(result.key, '\x1b[57376u');
      });

      it('F14 → CSI 57377 u', () => {
        const result = evaluateKeyboardEventKitty(createEvent({ key: 'F14' }), flags);
        assert.strictEqual(result.key, '\x1b[57377u');
      });

      it('F20 → CSI 57383 u', () => {
        const result = evaluateKeyboardEventKitty(createEvent({ key: 'F20' }), flags);
        assert.strictEqual(result.key, '\x1b[57383u');
      });

      it('F24 → CSI 57387 u', () => {
        const result = evaluateKeyboardEventKitty(createEvent({ key: 'F24' }), flags);
        assert.strictEqual(result.key, '\x1b[57387u');
      });
    });

    describe('numpad keys (Private Use Area)', () => {
      const flags = KittyKeyboardFlags.DISAMBIGUATE_ESCAPE_CODES;

      it('Numpad0 → CSI 57399 u', () => {
        const result = evaluateKeyboardEventKitty(createEvent({ key: '0', code: 'Numpad0' }), flags);
        assert.strictEqual(result.key, '\x1b[57399u');
      });

      it('Numpad1 → CSI 57400 u', () => {
        const result = evaluateKeyboardEventKitty(createEvent({ key: '1', code: 'Numpad1' }), flags);
        assert.strictEqual(result.key, '\x1b[57400u');
      });

      it('Numpad9 → CSI 57408 u', () => {
        const result = evaluateKeyboardEventKitty(createEvent({ key: '9', code: 'Numpad9' }), flags);
        assert.strictEqual(result.key, '\x1b[57408u');
      });

      it('NumpadDecimal → CSI 57409 u', () => {
        const result = evaluateKeyboardEventKitty(createEvent({ key: '.', code: 'NumpadDecimal' }), flags);
        assert.strictEqual(result.key, '\x1b[57409u');
      });

      it('NumpadDivide → CSI 57410 u', () => {
        const result = evaluateKeyboardEventKitty(createEvent({ key: '/', code: 'NumpadDivide' }), flags);
        assert.strictEqual(result.key, '\x1b[57410u');
      });

      it('NumpadMultiply → CSI 57411 u', () => {
        const result = evaluateKeyboardEventKitty(createEvent({ key: '*', code: 'NumpadMultiply' }), flags);
        assert.strictEqual(result.key, '\x1b[57411u');
      });

      it('NumpadSubtract → CSI 57412 u', () => {
        const result = evaluateKeyboardEventKitty(createEvent({ key: '-', code: 'NumpadSubtract' }), flags);
        assert.strictEqual(result.key, '\x1b[57412u');
      });

      it('NumpadAdd → CSI 57413 u', () => {
        const result = evaluateKeyboardEventKitty(createEvent({ key: '+', code: 'NumpadAdd' }), flags);
        assert.strictEqual(result.key, '\x1b[57413u');
      });

      it('NumpadEnter → CSI 57414 u', () => {
        const result = evaluateKeyboardEventKitty(createEvent({ key: 'Enter', code: 'NumpadEnter' }), flags);
        assert.strictEqual(result.key, '\x1b[57414u');
      });

      it('NumpadEqual → CSI 57415 u', () => {
        const result = evaluateKeyboardEventKitty(createEvent({ key: '=', code: 'NumpadEqual' }), flags);
        assert.strictEqual(result.key, '\x1b[57415u');
      });

      it('Ctrl+Numpad5 → CSI 57404;5 u', () => {
        const result = evaluateKeyboardEventKitty(createEvent({ key: '5', code: 'Numpad5', ctrlKey: true }), flags);
        assert.strictEqual(result.key, '\x1b[57404;5u');
      });
    });

    describe('modifier keys (Private Use Area)', () => {
      const flags = KittyKeyboardFlags.REPORT_ALL_KEYS_AS_ESCAPE_CODES;

      it('Left Shift → CSI 57441 u', () => {
        const result = evaluateKeyboardEventKitty(createEvent({ key: 'Shift', code: 'ShiftLeft', shiftKey: true }), flags);
        assert.strictEqual(result.key, '\x1b[57441;2u');
      });

      it('Right Shift → CSI 57447 u', () => {
        const result = evaluateKeyboardEventKitty(createEvent({ key: 'Shift', code: 'ShiftRight', shiftKey: true }), flags);
        assert.strictEqual(result.key, '\x1b[57447;2u');
      });

      it('Left Control → CSI 57442 u', () => {
        const result = evaluateKeyboardEventKitty(createEvent({ key: 'Control', code: 'ControlLeft', ctrlKey: true }), flags);
        assert.strictEqual(result.key, '\x1b[57442;5u');
      });

      it('Right Control → CSI 57448 u', () => {
        const result = evaluateKeyboardEventKitty(createEvent({ key: 'Control', code: 'ControlRight', ctrlKey: true }), flags);
        assert.strictEqual(result.key, '\x1b[57448;5u');
      });

      it('Left Alt → CSI 57443 u', () => {
        const result = evaluateKeyboardEventKitty(createEvent({ key: 'Alt', code: 'AltLeft', altKey: true }), flags);
        assert.strictEqual(result.key, '\x1b[57443;3u');
      });

      it('Right Alt → CSI 57449 u', () => {
        const result = evaluateKeyboardEventKitty(createEvent({ key: 'Alt', code: 'AltRight', altKey: true }), flags);
        assert.strictEqual(result.key, '\x1b[57449;3u');
      });

      it('Left Meta/Super → CSI 57444 u', () => {
        const result = evaluateKeyboardEventKitty(createEvent({ key: 'Meta', code: 'MetaLeft', metaKey: true }), flags);
        assert.strictEqual(result.key, '\x1b[57444;9u');
      });

      it('Right Meta/Super → CSI 57450 u', () => {
        const result = evaluateKeyboardEventKitty(createEvent({ key: 'Meta', code: 'MetaRight', metaKey: true }), flags);
        assert.strictEqual(result.key, '\x1b[57450;9u');
      });

      it('CapsLock → CSI 57358 u', () => {
        const result = evaluateKeyboardEventKitty(createEvent({ key: 'CapsLock', code: 'CapsLock' }), flags);
        assert.strictEqual(result.key, '\x1b[57358u');
      });

      it('NumLock → CSI 57360 u', () => {
        const result = evaluateKeyboardEventKitty(createEvent({ key: 'NumLock', code: 'NumLock' }), flags);
        assert.strictEqual(result.key, '\x1b[57360u');
      });

      it('ScrollLock → CSI 57359 u', () => {
        const result = evaluateKeyboardEventKitty(createEvent({ key: 'ScrollLock', code: 'ScrollLock' }), flags);
        assert.strictEqual(result.key, '\x1b[57359u');
      });
    });

    describe('event types (press/repeat/release)', () => {
      const flags = KittyKeyboardFlags.DISAMBIGUATE_ESCAPE_CODES | KittyKeyboardFlags.REPORT_EVENT_TYPES;

      it('press event (default, no suffix)', () => {
        const result = evaluateKeyboardEventKitty(createEvent({ key: 'a' }), flags, KittyKeyboardEventType.PRESS);
        assert.strictEqual(result.key, '\x1b[97u');
      });

      it('press event explicit :1 when modifiers present', () => {
        const result = evaluateKeyboardEventKitty(createEvent({ key: 'a', ctrlKey: true }), flags, KittyKeyboardEventType.PRESS);
        assert.strictEqual(result.key, '\x1b[97;5u');
      });

      it('repeat event → :2 suffix', () => {
        const result = evaluateKeyboardEventKitty(createEvent({ key: 'a' }), flags, KittyKeyboardEventType.REPEAT);
        assert.strictEqual(result.key, '\x1b[97;1:2u');
      });

      it('release event → :3 suffix', () => {
        const result = evaluateKeyboardEventKitty(createEvent({ key: 'a' }), flags, KittyKeyboardEventType.RELEASE);
        assert.strictEqual(result.key, '\x1b[97;1:3u');
      });

      it('release with modifier → mod:3', () => {
        const result = evaluateKeyboardEventKitty(createEvent({ key: 'a', ctrlKey: true }), flags, KittyKeyboardEventType.RELEASE);
        assert.strictEqual(result.key, '\x1b[97;5:3u');
      });

      it('repeat with modifier → mod:2', () => {
        const result = evaluateKeyboardEventKitty(createEvent({ key: 'a', shiftKey: true, altKey: true }), flags, KittyKeyboardEventType.REPEAT);
        assert.strictEqual(result.key, '\x1b[97;4:2u');
      });

      it('functional key release → CSI code;1:3 ~', () => {
        const result = evaluateKeyboardEventKitty(createEvent({ key: 'Delete' }), flags, KittyKeyboardEventType.RELEASE);
        assert.strictEqual(result.key, '\x1b[3;1:3~');
      });

      it('modifier key release includes its own bit cleared', () => {
        const result = evaluateKeyboardEventKitty(createEvent({ key: 'Shift', code: 'ShiftLeft', shiftKey: false }), flags, KittyKeyboardEventType.RELEASE);
        assert.strictEqual(result.key, '\x1b[57441;1:3u');
      });
    });

    describe('REPORT_ALL_KEYS_AS_ESCAPE_CODES flag', () => {
      const flags = KittyKeyboardFlags.REPORT_ALL_KEYS_AS_ESCAPE_CODES;

      it('lowercase letter → CSI codepoint u', () => {
        const result = evaluateKeyboardEventKitty(createEvent({ key: 'a' }), flags);
        assert.strictEqual(result.key, '\x1b[97u');
      });

      it('uppercase letter uses lowercase codepoint', () => {
        const result = evaluateKeyboardEventKitty(createEvent({ key: 'A', shiftKey: true }), flags);
        assert.strictEqual(result.key, '\x1b[97;2u');
      });

      it('digit → CSI codepoint u', () => {
        const result = evaluateKeyboardEventKitty(createEvent({ key: '5' }), flags);
        assert.strictEqual(result.key, '\x1b[53u');
      });

      it('punctuation → CSI codepoint u', () => {
        assert.strictEqual(evaluateKeyboardEventKitty(createEvent({ key: '.' }), flags).key, '\x1b[46u');
        assert.strictEqual(evaluateKeyboardEventKitty(createEvent({ key: ',' }), flags).key, '\x1b[44u');
        assert.strictEqual(evaluateKeyboardEventKitty(createEvent({ key: ';' }), flags).key, '\x1b[59u');
        assert.strictEqual(evaluateKeyboardEventKitty(createEvent({ key: '/' }), flags).key, '\x1b[47u');
      });

      it('brackets → CSI codepoint u', () => {
        assert.strictEqual(evaluateKeyboardEventKitty(createEvent({ key: '[' }), flags).key, '\x1b[91u');
        assert.strictEqual(evaluateKeyboardEventKitty(createEvent({ key: ']' }), flags).key, '\x1b[93u');
      });

      it('space → CSI 32 u', () => {
        const result = evaluateKeyboardEventKitty(createEvent({ key: ' ' }), flags);
        assert.strictEqual(result.key, '\x1b[32u');
      });
    });

    describe('REPORT_ASSOCIATED_TEXT flag', () => {
      const flags = KittyKeyboardFlags.REPORT_ALL_KEYS_AS_ESCAPE_CODES | KittyKeyboardFlags.REPORT_ASSOCIATED_TEXT;

      it('regular key includes text codepoint', () => {
        const result = evaluateKeyboardEventKitty(createEvent({ key: 'a' }), flags);
        assert.strictEqual(result.key, '\x1b[97;;97u');
      });

      it('shifted key includes shifted text', () => {
        const result = evaluateKeyboardEventKitty(createEvent({ key: 'A', shiftKey: true }), flags);
        assert.strictEqual(result.key, '\x1b[97;2;65u');
      });

      it('Ctrl+key omits text (control code)', () => {
        const result = evaluateKeyboardEventKitty(createEvent({ key: 'a', ctrlKey: true }), flags);
        assert.strictEqual(result.key, '\x1b[97;5u');
      });

      it('functional key has no text', () => {
        const result = evaluateKeyboardEventKitty(createEvent({ key: 'Escape' }), flags);
        assert.strictEqual(result.key, '\x1b[27u');
      });

      it('release event has no text', () => {
        const flagsWithEvents = flags | KittyKeyboardFlags.REPORT_EVENT_TYPES;
        const result = evaluateKeyboardEventKitty(createEvent({ key: 'a' }), flagsWithEvents, KittyKeyboardEventType.RELEASE);
        assert.strictEqual(result.key, '\x1b[97;1:3u');
      });

      it('digit with text', () => {
        const result = evaluateKeyboardEventKitty(createEvent({ key: '5' }), flags);
        assert.strictEqual(result.key, '\x1b[53;;53u');
      });

      it('Shift+digit shows shifted symbol', () => {
        const result = evaluateKeyboardEventKitty(createEvent({ key: '%', shiftKey: true, code: 'Digit5' }), flags);
        assert.strictEqual(result.key, '\x1b[53;2;37u');
      });
    });

    describe('legacy ctrl mapping', () => {
      it('ctrl+a → 0x01', () => {
        const result = evaluateKeyboardEventKitty(createEvent({ key: 'a', ctrlKey: true }), 0);
        assert.strictEqual(result.key, '\x01');
      });

      it('ctrl+b → 0x02', () => {
        const result = evaluateKeyboardEventKitty(createEvent({ key: 'b', ctrlKey: true }), 0);
        assert.strictEqual(result.key, '\x02');
      });

      it('ctrl+c → 0x03', () => {
        const result = evaluateKeyboardEventKitty(createEvent({ key: 'c', ctrlKey: true }), 0);
        assert.strictEqual(result.key, '\x03');
      });

      it('ctrl+z → 0x1A', () => {
        const result = evaluateKeyboardEventKitty(createEvent({ key: 'z', ctrlKey: true }), 0);
        assert.strictEqual(result.key, '\x1a');
      });

      it('ctrl+space → 0x00', () => {
        const result = evaluateKeyboardEventKitty(createEvent({ key: ' ', ctrlKey: true }), 0);
        assert.strictEqual(result.key, '\x00');
      });

      it('ctrl+[ → 0x1B (ESC)', () => {
        const result = evaluateKeyboardEventKitty(createEvent({ key: '[', ctrlKey: true }), 0);
        assert.strictEqual(result.key, '\x1b');
      });

      it('ctrl+\\ → 0x1C', () => {
        const result = evaluateKeyboardEventKitty(createEvent({ key: '\\', ctrlKey: true }), 0);
        assert.strictEqual(result.key, '\x1c');
      });

      it('ctrl+] → 0x1D', () => {
        const result = evaluateKeyboardEventKitty(createEvent({ key: ']', ctrlKey: true }), 0);
        assert.strictEqual(result.key, '\x1d');
      });

      it('ctrl+^ → 0x1E', () => {
        const result = evaluateKeyboardEventKitty(createEvent({ key: '^', ctrlKey: true }), 0);
        assert.strictEqual(result.key, '\x1e');
      });

      it('ctrl+_ → 0x1F', () => {
        const result = evaluateKeyboardEventKitty(createEvent({ key: '_', ctrlKey: true }), 0);
        assert.strictEqual(result.key, '\x1f');
      });

      it('ctrl+2 → 0x00', () => {
        const result = evaluateKeyboardEventKitty(createEvent({ key: '2', ctrlKey: true }), 0);
        assert.strictEqual(result.key, '\x00');
      });

      it('ctrl+3 → 0x1B', () => {
        const result = evaluateKeyboardEventKitty(createEvent({ key: '3', ctrlKey: true }), 0);
        assert.strictEqual(result.key, '\x1b');
      });

      it('ctrl+4 → 0x1C', () => {
        const result = evaluateKeyboardEventKitty(createEvent({ key: '4', ctrlKey: true }), 0);
        assert.strictEqual(result.key, '\x1c');
      });

      it('ctrl+5 → 0x1D', () => {
        const result = evaluateKeyboardEventKitty(createEvent({ key: '5', ctrlKey: true }), 0);
        assert.strictEqual(result.key, '\x1d');
      });

      it('ctrl+6 → 0x1E', () => {
        const result = evaluateKeyboardEventKitty(createEvent({ key: '6', ctrlKey: true }), 0);
        assert.strictEqual(result.key, '\x1e');
      });

      it('ctrl+7 → 0x1F', () => {
        const result = evaluateKeyboardEventKitty(createEvent({ key: '7', ctrlKey: true }), 0);
        assert.strictEqual(result.key, '\x1f');
      });

      it('ctrl+8 → 0x7F', () => {
        const result = evaluateKeyboardEventKitty(createEvent({ key: '8', ctrlKey: true }), 0);
        assert.strictEqual(result.key, '\x7f');
      });

      it('ctrl+/ → 0x1F', () => {
        const result = evaluateKeyboardEventKitty(createEvent({ key: '/', ctrlKey: true }), 0);
        assert.strictEqual(result.key, '\x1f');
      });

      it('ctrl+? → 0x7F', () => {
        const result = evaluateKeyboardEventKitty(createEvent({ key: '?', ctrlKey: true }), 0);
        assert.strictEqual(result.key, '\x7f');
      });

      it('alt+a → ESC a', () => {
        const result = evaluateKeyboardEventKitty(createEvent({ key: 'a', altKey: true }), 0);
        assert.strictEqual(result.key, '\x1ba');
      });

      it('alt+A → ESC A', () => {
        const result = evaluateKeyboardEventKitty(createEvent({ key: 'A', altKey: true, shiftKey: true }), 0);
        assert.strictEqual(result.key, '\x1bA');
      });

      it('ctrl+alt+a → ESC ctrl+a', () => {
        const result = evaluateKeyboardEventKitty(createEvent({ key: 'a', ctrlKey: true, altKey: true }), 0);
        assert.strictEqual(result.key, '\x1b\x01');
      });
    });

    describe('release events without REPORT_EVENT_TYPES', () => {
      const flags = KittyKeyboardFlags.DISAMBIGUATE_ESCAPE_CODES;

      it('should not generate key sequence for release events', () => {
        const result = evaluateKeyboardEventKitty(createEvent({ key: 'a' }), flags, KittyKeyboardEventType.RELEASE);
        assert.strictEqual(result.key, undefined);
      });
    });

    describe('edge cases', () => {
      const flags = KittyKeyboardFlags.DISAMBIGUATE_ESCAPE_CODES;

      it('always uses lowercase codepoint for letters', () => {
        const result = evaluateKeyboardEventKitty(createEvent({ key: 'A', shiftKey: true }), flags);
        assert.strictEqual(result.key, '\x1b[97;2u');
      });

      it('ctrl+shift+a sends lowercase codepoint 97', () => {
        const result = evaluateKeyboardEventKitty(createEvent({ key: 'A', ctrlKey: true, shiftKey: true }), flags);
        assert.strictEqual(result.key, '\x1b[97;6u');
      });

      it('Dead key produces no output', () => {
        const result = evaluateKeyboardEventKitty(createEvent({ key: 'Dead' }), flags);
        assert.strictEqual(result.key, undefined);
      });

      it('Unidentified key produces no output', () => {
        const result = evaluateKeyboardEventKitty(createEvent({ key: 'Unidentified' }), flags);
        assert.strictEqual(result.key, undefined);
      });

      it('PrintScreen → CSI 57361 u', () => {
        const result = evaluateKeyboardEventKitty(createEvent({ key: 'PrintScreen' }), flags);
        assert.strictEqual(result.key, '\x1b[57361u');
      });

      it('Pause → CSI 57362 u', () => {
        const result = evaluateKeyboardEventKitty(createEvent({ key: 'Pause' }), flags);
        assert.strictEqual(result.key, '\x1b[57362u');
      });

      it('ContextMenu → CSI 57363 u', () => {
        const result = evaluateKeyboardEventKitty(createEvent({ key: 'ContextMenu' }), flags);
        assert.strictEqual(result.key, '\x1b[57363u');
      });
    });

    describe('media keys (Private Use Area)', () => {
      const flags = KittyKeyboardFlags.DISAMBIGUATE_ESCAPE_CODES;

      it('MediaPlayPause → CSI 57430 u', () => {
        const result = evaluateKeyboardEventKitty(createEvent({ key: 'MediaPlayPause' }), flags);
        assert.strictEqual(result.key, '\x1b[57430u');
      });

      it('MediaStop → CSI 57432 u', () => {
        const result = evaluateKeyboardEventKitty(createEvent({ key: 'MediaStop' }), flags);
        assert.strictEqual(result.key, '\x1b[57432u');
      });

      it('MediaTrackNext → CSI 57435 u', () => {
        const result = evaluateKeyboardEventKitty(createEvent({ key: 'MediaTrackNext' }), flags);
        assert.strictEqual(result.key, '\x1b[57435u');
      });

      it('MediaTrackPrevious → CSI 57436 u', () => {
        const result = evaluateKeyboardEventKitty(createEvent({ key: 'MediaTrackPrevious' }), flags);
        assert.strictEqual(result.key, '\x1b[57436u');
      });

      it('AudioVolumeDown → CSI 57438 u', () => {
        const result = evaluateKeyboardEventKitty(createEvent({ key: 'AudioVolumeDown' }), flags);
        assert.strictEqual(result.key, '\x1b[57438u');
      });

      it('AudioVolumeUp → CSI 57439 u', () => {
        const result = evaluateKeyboardEventKitty(createEvent({ key: 'AudioVolumeUp' }), flags);
        assert.strictEqual(result.key, '\x1b[57439u');
      });

      it('AudioVolumeMute → CSI 57440 u', () => {
        const result = evaluateKeyboardEventKitty(createEvent({ key: 'AudioVolumeMute' }), flags);
        assert.strictEqual(result.key, '\x1b[57440u');
      });
    });
  });
});
