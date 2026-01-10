/**
 * Copyright (c) 2026 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import { assert } from 'chai';
import { evaluateKeyboardEventWin32, Win32ControlKeyState } from 'common/input/Win32InputMode';
import { IKeyboardEvent, KeyboardResultType } from 'common/Types';

type EventOpts = Partial<IKeyboardEvent>;
const ev = (opts: EventOpts): IKeyboardEvent => ({
  altKey: false, ctrlKey: false, shiftKey: false, metaKey: false,
  keyCode: 0, code: '', key: '', type: 'keydown', ...opts
});

const parse = (seq: string) => {
  const m = seq.match(/^\x1b\[(\d+);(\d+);(\d+);(\d+);(\d+);(\d+)_$/);
  return m ? { vk: +m[1], sc: +m[2], uc: +m[3], kd: +m[4], cs: +m[5], rc: +m[6] } : null;
};

const test = (opts: EventOpts, isDown: boolean, check: (p: ReturnType<typeof parse>) => void) => {
  const result = evaluateKeyboardEventWin32(ev(opts), isDown);
  const parsed = parse(result.key!);
  assert.ok(parsed);
  check(parsed);
};

describe('Win32InputMode', () => {
  describe('evaluateKeyboardEventWin32', () => {
    describe('basic key encoding', () => {
      it('letter key press', () => {
        const result = evaluateKeyboardEventWin32(ev({ code: 'KeyA', key: 'a', keyCode: 65 }), true);
        assert.strictEqual(result.type, KeyboardResultType.SEND_KEY);
        assert.strictEqual(result.cancel, true);
        const p = parse(result.key!);
        assert.ok(p);
        assert.deepStrictEqual([p.vk, p.uc, p.kd, p.rc], [0x41, 97, 1, 1]);
      });
      it('letter key release', () => test({ code: 'KeyA', key: 'a', keyCode: 65 }, false, p => assert.strictEqual(p!.kd, 0)));
      it('digit key', () => test({ code: 'Digit1', key: '1', keyCode: 49 }, true, p => assert.deepStrictEqual([p!.vk, p!.uc], [0x31, 49])));
      it('Enter key', () => test({ code: 'Enter', key: 'Enter', keyCode: 13 }, true, p => assert.deepStrictEqual([p!.vk, p!.uc], [0x0D, 0])));
      it('Escape key', () => test({ code: 'Escape', key: 'Escape', keyCode: 27 }, true, p => assert.strictEqual(p!.vk, 0x1B)));
      it('Space key', () => test({ code: 'Space', key: ' ', keyCode: 32 }, true, p => assert.deepStrictEqual([p!.vk, p!.uc], [0x20, 32])));
    });

    describe('modifier encoding', () => {
      it('shift', () => test({ code: 'KeyA', key: 'A', keyCode: 65, shiftKey: true }, true, p => assert.ok(p!.cs & Win32ControlKeyState.SHIFT_PRESSED)));
      it('ctrl left', () => test({ code: 'KeyA', key: 'a', keyCode: 65, ctrlKey: true }, true, p => assert.ok(p!.cs & Win32ControlKeyState.LEFT_CTRL_PRESSED)));
      it('ctrl right', () => test({ code: 'ControlRight', key: 'Control', keyCode: 17, ctrlKey: true }, true, p => {
        assert.ok(p!.cs & Win32ControlKeyState.RIGHT_CTRL_PRESSED);
        assert.ok(p!.cs & Win32ControlKeyState.ENHANCED_KEY);
      }));
      it('alt left', () => test({ code: 'KeyA', key: 'a', keyCode: 65, altKey: true }, true, p => assert.ok(p!.cs & Win32ControlKeyState.LEFT_ALT_PRESSED)));
      it('alt right', () => test({ code: 'AltRight', key: 'Alt', keyCode: 18, altKey: true }, true, p => {
        assert.ok(p!.cs & Win32ControlKeyState.RIGHT_ALT_PRESSED);
        assert.ok(p!.cs & Win32ControlKeyState.ENHANCED_KEY);
      }));
      it('multiple modifiers', () => test({ code: 'KeyA', key: 'A', keyCode: 65, shiftKey: true, ctrlKey: true, altKey: true }, true, p => {
        assert.ok(p!.cs & Win32ControlKeyState.SHIFT_PRESSED);
        assert.ok(p!.cs & Win32ControlKeyState.LEFT_CTRL_PRESSED);
        assert.ok(p!.cs & Win32ControlKeyState.LEFT_ALT_PRESSED);
      }));
    });

    describe('function keys', () => {
      it('F1', () => test({ code: 'F1', key: 'F1', keyCode: 112 }, true, p => assert.strictEqual(p!.vk, 0x70)));
      it('F5', () => test({ code: 'F5', key: 'F5', keyCode: 116 }, true, p => assert.strictEqual(p!.vk, 0x74)));
      it('F12', () => test({ code: 'F12', key: 'F12', keyCode: 123 }, true, p => assert.strictEqual(p!.vk, 0x7B)));
      it('Ctrl+F1', () => test({ code: 'F1', key: 'F1', keyCode: 112, ctrlKey: true }, true, p => {
        assert.strictEqual(p!.vk, 0x70);
        assert.ok(p!.cs & Win32ControlKeyState.LEFT_CTRL_PRESSED);
      }));
    });

    describe('navigation keys (ENHANCED_KEY)', () => {
      const navKeys: [string, string, number, number][] = [
        ['ArrowUp', 'ArrowUp', 38, 0x26],
        ['ArrowDown', 'ArrowDown', 40, 0x28],
        ['ArrowLeft', 'ArrowLeft', 37, 0x25],
        ['ArrowRight', 'ArrowRight', 39, 0x27],
        ['Home', 'Home', 36, 0x24],
        ['End', 'End', 35, 0x23],
        ['PageUp', 'PageUp', 33, 0x21],
        ['PageDown', 'PageDown', 34, 0x22],
        ['Insert', 'Insert', 45, 0x2D],
        ['Delete', 'Delete', 46, 0x2E],
      ];
      navKeys.forEach(([code, key, keyCode, vk]) => {
        it(code, () => test({ code, key, keyCode }, true, p => {
          assert.strictEqual(p!.vk, vk);
          assert.ok(p!.cs & Win32ControlKeyState.ENHANCED_KEY);
        }));
      });
      it('Tab', () => test({ code: 'Tab', key: 'Tab', keyCode: 9 }, true, p => assert.strictEqual(p!.vk, 0x09)));
      it('Backspace', () => test({ code: 'Backspace', key: 'Backspace', keyCode: 8 }, true, p => assert.strictEqual(p!.vk, 0x08)));
    });

    describe('numpad keys', () => {
      it('Numpad0', () => test({ code: 'Numpad0', key: '0', keyCode: 96 }, true, p => assert.strictEqual(p!.vk, 0x60)));
      it('NumpadEnter (ENHANCED)', () => test({ code: 'NumpadEnter', key: 'Enter', keyCode: 13 }, true, p => {
        assert.strictEqual(p!.vk, 0x0D);
        assert.ok(p!.cs & Win32ControlKeyState.ENHANCED_KEY);
      }));
      it('NumpadAdd', () => test({ code: 'NumpadAdd', key: '+', keyCode: 107 }, true, p => assert.strictEqual(p!.vk, 0x6B)));
      it('NumpadSubtract', () => test({ code: 'NumpadSubtract', key: '-', keyCode: 109 }, true, p => assert.strictEqual(p!.vk, 0x6D)));
      it('NumpadMultiply', () => test({ code: 'NumpadMultiply', key: '*', keyCode: 106 }, true, p => assert.strictEqual(p!.vk, 0x6A)));
      it('NumpadDivide (ENHANCED)', () => test({ code: 'NumpadDivide', key: '/', keyCode: 111 }, true, p => {
        assert.strictEqual(p!.vk, 0x6F);
        assert.ok(p!.cs & Win32ControlKeyState.ENHANCED_KEY);
      }));
      it('NumpadDecimal', () => test({ code: 'NumpadDecimal', key: '.', keyCode: 110 }, true, p => assert.strictEqual(p!.vk, 0x6E)));
    });

    describe('unicode character', () => {
      it('printable', () => test({ code: 'KeyA', key: 'a', keyCode: 65 }, true, p => assert.strictEqual(p!.uc, 97)));
      it('shifted', () => test({ code: 'KeyA', key: 'A', keyCode: 65, shiftKey: true }, true, p => assert.strictEqual(p!.uc, 65)));
      it('non-printable is 0', () => test({ code: 'ArrowUp', key: 'ArrowUp', keyCode: 38 }, true, p => assert.strictEqual(p!.uc, 0)));
      it('extended ASCII', () => test({ code: 'KeyE', key: 'é', keyCode: 69 }, true, p => assert.strictEqual(p!.uc, 233)));
      it('symbol', () => test({ code: 'Digit4', key: '$', keyCode: 52, shiftKey: true }, true, p => assert.strictEqual(p!.uc, 36)));
    });

    describe('scan codes', () => {
      it('letter A', () => test({ code: 'KeyA', key: 'a', keyCode: 65 }, true, p => assert.strictEqual(p!.sc, 0x1E)));
      it('Escape', () => test({ code: 'Escape', key: 'Escape', keyCode: 27 }, true, p => assert.strictEqual(p!.sc, 0x01)));
    });

    describe('sequence format', () => {
      it('valid CSI format', () => {
        const result = evaluateKeyboardEventWin32(ev({ code: 'KeyA', key: 'a', keyCode: 65 }), true);
        assert.ok(result.key?.startsWith('\x1b[') && result.key.endsWith('_'));
        assert.strictEqual(result.key?.slice(2, -1).split(';').length, 6);
      });
    });

    describe('standalone modifier keys', () => {
      it('ShiftLeft', () => test({ code: 'ShiftLeft', key: 'Shift', keyCode: 16, shiftKey: true }, true, p => {
        assert.strictEqual(p!.vk, 0x10);
        assert.ok(p!.cs & Win32ControlKeyState.SHIFT_PRESSED);
      }));
      it('ShiftRight', () => test({ code: 'ShiftRight', key: 'Shift', keyCode: 16, shiftKey: true }, true, p => {
        assert.strictEqual(p!.vk, 0x10);
        assert.ok(p!.cs & Win32ControlKeyState.SHIFT_PRESSED);
      }));
      it('ControlLeft', () => test({ code: 'ControlLeft', key: 'Control', keyCode: 17, ctrlKey: true }, true, p => {
        assert.strictEqual(p!.vk, 0x11);
        assert.ok(p!.cs & Win32ControlKeyState.LEFT_CTRL_PRESSED);
      }));
      it('ControlRight', () => test({ code: 'ControlRight', key: 'Control', keyCode: 17, ctrlKey: true }, true, p => {
        assert.strictEqual(p!.vk, 0x11);
        assert.ok(p!.cs & Win32ControlKeyState.RIGHT_CTRL_PRESSED);
        assert.ok(p!.cs & Win32ControlKeyState.ENHANCED_KEY);
      }));
      it('AltLeft', () => test({ code: 'AltLeft', key: 'Alt', keyCode: 18, altKey: true }, true, p => {
        assert.strictEqual(p!.vk, 0x12);
        assert.ok(p!.cs & Win32ControlKeyState.LEFT_ALT_PRESSED);
      }));
      it('AltRight', () => test({ code: 'AltRight', key: 'Alt', keyCode: 18, altKey: true }, true, p => {
        assert.strictEqual(p!.vk, 0x12);
        assert.ok(p!.cs & Win32ControlKeyState.RIGHT_ALT_PRESSED);
        assert.ok(p!.cs & Win32ControlKeyState.ENHANCED_KEY);
      }));
      it('modifier release', () => test({ code: 'ShiftLeft', key: 'Shift', keyCode: 16 }, false, p => assert.strictEqual(p!.kd, 0)));
    });

    describe('problem keys from spec', () => {
      it('Ctrl+Space', () => test({ code: 'Space', key: ' ', keyCode: 32, ctrlKey: true }, true, p => {
        assert.strictEqual(p!.vk, 0x20);
        assert.ok(p!.cs & Win32ControlKeyState.LEFT_CTRL_PRESSED);
      }));
      it('Shift+Enter', () => test({ code: 'Enter', key: 'Enter', keyCode: 13, shiftKey: true }, true, p => {
        assert.strictEqual(p!.vk, 0x0D);
        assert.ok(p!.cs & Win32ControlKeyState.SHIFT_PRESSED);
      }));
      it('Ctrl+Break', () => test({ code: 'Pause', key: 'Pause', keyCode: 19, ctrlKey: true }, true, p => {
        assert.strictEqual(p!.vk, 0x13);
        assert.ok(p!.cs & Win32ControlKeyState.LEFT_CTRL_PRESSED);
      }));
      it('Ctrl+Alt+/', () => test({ code: 'Slash', key: '/', keyCode: 191, ctrlKey: true, altKey: true }, true, p => {
        assert.ok(p!.cs & Win32ControlKeyState.LEFT_CTRL_PRESSED);
        assert.ok(p!.cs & Win32ControlKeyState.LEFT_ALT_PRESSED);
      }));
    });

    describe('meta key', () => {
      it('MetaLeft', () => test({ code: 'MetaLeft', key: 'Meta', keyCode: 91, metaKey: true }, true, p => {
        assert.strictEqual(p!.vk, 0x5B);
        assert.ok(p!.cs & Win32ControlKeyState.ENHANCED_KEY);
      }));
      it('MetaRight', () => test({ code: 'MetaRight', key: 'Meta', keyCode: 92, metaKey: true }, true, p => {
        assert.strictEqual(p!.vk, 0x5C);
        assert.ok(p!.cs & Win32ControlKeyState.ENHANCED_KEY);
      }));
    });
  });
});
