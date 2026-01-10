
import { assert } from 'chai';
import { evaluateKeyboardEventWin32, Win32ControlKeyState } from 'common/input/Win32InputMode';
import { IKeyboardEvent, KeyboardResultType } from 'common/Types';

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

function parseWin32Sequence(seq: string): { vk: number, sc: number, uc: number, kd: number, cs: number, rc: number } | null {
  const match = seq.match(/^\x1b\[(\d+);(\d+);(\d+);(\d+);(\d+);(\d+)_$/);
  if (!match) {
    return null;
  }
  return {
    vk: parseInt(match[1], 10),
    sc: parseInt(match[2], 10),
    uc: parseInt(match[3], 10),
    kd: parseInt(match[4], 10),
    cs: parseInt(match[5], 10),
    rc: parseInt(match[6], 10)
  };
}

describe('Win32InputMode', () => {
  describe('evaluateKeyboardEventWin32', () => {
    describe('basic key encoding', () => {
      it('should encode letter key press', () => {
        const result = evaluateKeyboardEventWin32(createEvent({ code: 'KeyA', key: 'a', keyCode: 65 }), true);
        assert.strictEqual(result.type, KeyboardResultType.SEND_KEY);
        assert.strictEqual(result.cancel, true);
        const parsed = parseWin32Sequence(result.key!);
        assert.ok(parsed);
        assert.strictEqual(parsed.vk, 0x41);
        assert.strictEqual(parsed.uc, 97);
        assert.strictEqual(parsed.kd, 1);
        assert.strictEqual(parsed.rc, 1);
      });

      it('should encode letter key release', () => {
        const result = evaluateKeyboardEventWin32(createEvent({ code: 'KeyA', key: 'a', keyCode: 65 }), false);
        const parsed = parseWin32Sequence(result.key!);
        assert.ok(parsed);
        assert.strictEqual(parsed.kd, 0);
      });

      it('should encode digit key', () => {
        const result = evaluateKeyboardEventWin32(createEvent({ code: 'Digit1', key: '1', keyCode: 49 }), true);
        const parsed = parseWin32Sequence(result.key!);
        assert.ok(parsed);
        assert.strictEqual(parsed.vk, 0x31);
        assert.strictEqual(parsed.uc, 49);
      });

      it('should encode Enter key', () => {
        const result = evaluateKeyboardEventWin32(createEvent({ code: 'Enter', key: 'Enter', keyCode: 13 }), true);
        const parsed = parseWin32Sequence(result.key!);
        assert.ok(parsed);
        assert.strictEqual(parsed.vk, 0x0D);
        assert.strictEqual(parsed.uc, 0);
      });

      it('should encode Escape key', () => {
        const result = evaluateKeyboardEventWin32(createEvent({ code: 'Escape', key: 'Escape', keyCode: 27 }), true);
        const parsed = parseWin32Sequence(result.key!);
        assert.ok(parsed);
        assert.strictEqual(parsed.vk, 0x1B);
      });

      it('should encode Space key', () => {
        const result = evaluateKeyboardEventWin32(createEvent({ code: 'Space', key: ' ', keyCode: 32 }), true);
        const parsed = parseWin32Sequence(result.key!);
        assert.ok(parsed);
        assert.strictEqual(parsed.vk, 0x20);
        assert.strictEqual(parsed.uc, 32);
      });
    });

    describe('modifier encoding', () => {
      it('should encode shift modifier', () => {
        const result = evaluateKeyboardEventWin32(createEvent({
          code: 'KeyA',
          key: 'A',
          keyCode: 65,
          shiftKey: true
        }), true);
        const parsed = parseWin32Sequence(result.key!);
        assert.ok(parsed);
        assert.ok(parsed.cs & Win32ControlKeyState.SHIFT_PRESSED);
      });

      it('should encode ctrl modifier (left)', () => {
        const result = evaluateKeyboardEventWin32(createEvent({
          code: 'KeyA',
          key: 'a',
          keyCode: 65,
          ctrlKey: true
        }), true);
        const parsed = parseWin32Sequence(result.key!);
        assert.ok(parsed);
        assert.ok(parsed.cs & Win32ControlKeyState.LEFT_CTRL_PRESSED);
      });

      it('should encode ctrl modifier (right)', () => {
        const result = evaluateKeyboardEventWin32(createEvent({
          code: 'ControlRight',
          key: 'Control',
          keyCode: 17,
          ctrlKey: true
        }), true);
        const parsed = parseWin32Sequence(result.key!);
        assert.ok(parsed);
        assert.ok(parsed.cs & Win32ControlKeyState.RIGHT_CTRL_PRESSED);
        assert.ok(parsed.cs & Win32ControlKeyState.ENHANCED_KEY);
      });

      it('should encode alt modifier (left)', () => {
        const result = evaluateKeyboardEventWin32(createEvent({
          code: 'KeyA',
          key: 'a',
          keyCode: 65,
          altKey: true
        }), true);
        const parsed = parseWin32Sequence(result.key!);
        assert.ok(parsed);
        assert.ok(parsed.cs & Win32ControlKeyState.LEFT_ALT_PRESSED);
      });

      it('should encode alt modifier (right)', () => {
        const result = evaluateKeyboardEventWin32(createEvent({
          code: 'AltRight',
          key: 'Alt',
          keyCode: 18,
          altKey: true
        }), true);
        const parsed = parseWin32Sequence(result.key!);
        assert.ok(parsed);
        assert.ok(parsed.cs & Win32ControlKeyState.RIGHT_ALT_PRESSED);
        assert.ok(parsed.cs & Win32ControlKeyState.ENHANCED_KEY);
      });

      it('should encode multiple modifiers', () => {
        const result = evaluateKeyboardEventWin32(createEvent({
          code: 'KeyA',
          key: 'A',
          keyCode: 65,
          shiftKey: true,
          ctrlKey: true,
          altKey: true
        }), true);
        const parsed = parseWin32Sequence(result.key!);
        assert.ok(parsed);
        assert.ok(parsed.cs & Win32ControlKeyState.SHIFT_PRESSED);
        assert.ok(parsed.cs & Win32ControlKeyState.LEFT_CTRL_PRESSED);
        assert.ok(parsed.cs & Win32ControlKeyState.LEFT_ALT_PRESSED);
      });
    });

    describe('function keys', () => {
      it('should encode F1', () => {
        const result = evaluateKeyboardEventWin32(createEvent({ code: 'F1', key: 'F1', keyCode: 112 }), true);
        const parsed = parseWin32Sequence(result.key!);
        assert.ok(parsed);
        assert.strictEqual(parsed.vk, 0x70);
      });

      it('should encode F12', () => {
        const result = evaluateKeyboardEventWin32(createEvent({ code: 'F12', key: 'F12', keyCode: 123 }), true);
        const parsed = parseWin32Sequence(result.key!);
        assert.ok(parsed);
        assert.strictEqual(parsed.vk, 0x7B);
      });
    });

    describe('navigation keys', () => {
      it('should encode arrow up with ENHANCED_KEY flag', () => {
        const result = evaluateKeyboardEventWin32(createEvent({ code: 'ArrowUp', key: 'ArrowUp', keyCode: 38 }), true);
        const parsed = parseWin32Sequence(result.key!);
        assert.ok(parsed);
        assert.strictEqual(parsed.vk, 0x26);
        assert.ok(parsed.cs & Win32ControlKeyState.ENHANCED_KEY);
      });

      it('should encode Home with ENHANCED_KEY flag', () => {
        const result = evaluateKeyboardEventWin32(createEvent({ code: 'Home', key: 'Home', keyCode: 36 }), true);
        const parsed = parseWin32Sequence(result.key!);
        assert.ok(parsed);
        assert.strictEqual(parsed.vk, 0x24);
        assert.ok(parsed.cs & Win32ControlKeyState.ENHANCED_KEY);
      });

      it('should encode Insert with ENHANCED_KEY flag', () => {
        const result = evaluateKeyboardEventWin32(createEvent({ code: 'Insert', key: 'Insert', keyCode: 45 }), true);
        const parsed = parseWin32Sequence(result.key!);
        assert.ok(parsed);
        assert.strictEqual(parsed.vk, 0x2D);
        assert.ok(parsed.cs & Win32ControlKeyState.ENHANCED_KEY);
      });

      it('should encode Delete with ENHANCED_KEY flag', () => {
        const result = evaluateKeyboardEventWin32(createEvent({ code: 'Delete', key: 'Delete', keyCode: 46 }), true);
        const parsed = parseWin32Sequence(result.key!);
        assert.ok(parsed);
        assert.strictEqual(parsed.vk, 0x2E);
        assert.ok(parsed.cs & Win32ControlKeyState.ENHANCED_KEY);
      });
    });

    describe('numpad keys', () => {
      it('should encode Numpad0', () => {
        const result = evaluateKeyboardEventWin32(createEvent({ code: 'Numpad0', key: '0', keyCode: 96 }), true);
        const parsed = parseWin32Sequence(result.key!);
        assert.ok(parsed);
        assert.strictEqual(parsed.vk, 0x60);
      });

      it('should encode NumpadEnter with ENHANCED_KEY', () => {
        const result = evaluateKeyboardEventWin32(createEvent({ code: 'NumpadEnter', key: 'Enter', keyCode: 13 }), true);
        const parsed = parseWin32Sequence(result.key!);
        assert.ok(parsed);
        assert.strictEqual(parsed.vk, 0x0D);
        assert.ok(parsed.cs & Win32ControlKeyState.ENHANCED_KEY);
      });
    });

    describe('unicode character', () => {
      it('should include unicode codepoint for printable characters', () => {
        const result = evaluateKeyboardEventWin32(createEvent({ code: 'KeyA', key: 'a', keyCode: 65 }), true);
        const parsed = parseWin32Sequence(result.key!);
        assert.ok(parsed);
        assert.strictEqual(parsed.uc, 97);
      });

      it('should include unicode codepoint for shifted characters', () => {
        const result = evaluateKeyboardEventWin32(createEvent({
          code: 'KeyA',
          key: 'A',
          keyCode: 65,
          shiftKey: true
        }), true);
        const parsed = parseWin32Sequence(result.key!);
        assert.ok(parsed);
        assert.strictEqual(parsed.uc, 65);
      });

      it('should set unicode to 0 for non-printable keys', () => {
        const result = evaluateKeyboardEventWin32(createEvent({ code: 'ArrowUp', key: 'ArrowUp', keyCode: 38 }), true);
        const parsed = parseWin32Sequence(result.key!);
        assert.ok(parsed);
        assert.strictEqual(parsed.uc, 0);
      });
    });

    describe('scan codes', () => {
      it('should include approximate scan code for letter', () => {
        const result = evaluateKeyboardEventWin32(createEvent({ code: 'KeyA', key: 'a', keyCode: 65 }), true);
        const parsed = parseWin32Sequence(result.key!);
        assert.ok(parsed);
        assert.strictEqual(parsed.sc, 0x1E);
      });

      it('should include approximate scan code for Escape', () => {
        const result = evaluateKeyboardEventWin32(createEvent({ code: 'Escape', key: 'Escape', keyCode: 27 }), true);
        const parsed = parseWin32Sequence(result.key!);
        assert.ok(parsed);
        assert.strictEqual(parsed.sc, 0x01);
      });
    });

    describe('sequence format', () => {
      it('should produce valid CSI sequence format', () => {
        const result = evaluateKeyboardEventWin32(createEvent({ code: 'KeyA', key: 'a', keyCode: 65 }), true);
        assert.ok(result.key);
        assert.ok(result.key.startsWith('\x1b['));
        assert.ok(result.key.endsWith('_'));
        const parts = result.key.slice(2, -1).split(';');
        assert.strictEqual(parts.length, 6);
      });
    });
  });
});
