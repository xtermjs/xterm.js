
import { assert } from 'chai';
import { evaluateKeyboardEvent } from 'common/input/Keyboard';
import { IKeyboardResult, IKeyboardEvent } from 'common/Types';

/**
 * A helper function for testing which allows passing in a partial event and defaults will be filled
 * in on it.
 */
function testEvaluateKeyboardEvent(partialEvent: {
  altKey?: boolean;
  ctrlKey?: boolean;
  shiftKey?: boolean;
  metaKey?: boolean;
  keyCode?: number;
  code?: string;
  key?: string;
  type?: string;
}, partialOptions: {
  applicationCursorMode?: boolean;
  isMac?: boolean;
  macOptionIsMeta?: boolean;
} = {}): IKeyboardResult {
  const event: IKeyboardEvent = {
    altKey: partialEvent.altKey || false,
    ctrlKey: partialEvent.ctrlKey || false,
    shiftKey: partialEvent.shiftKey || false,
    metaKey: partialEvent.metaKey || false,
    keyCode: partialEvent.keyCode !== undefined ? partialEvent.keyCode : 0,
    code: partialEvent.code || '',
    key: partialEvent.key || '',
    type: partialEvent.type || ''
  };
  const options = {
    applicationCursorMode: partialOptions.applicationCursorMode || false,
    isMac: partialOptions.isMac || false,
    macOptionIsMeta: partialOptions.macOptionIsMeta || false
  };
  return evaluateKeyboardEvent(event, options.applicationCursorMode, options.isMac, options.macOptionIsMeta);
}

describe('Keyboard', () => {
  describe('evaluateKeyEscapeSequence', () => {
    it('should return the correct escape sequence for unmodified keys', () => {
      // Backspace
      assert.equal(testEvaluateKeyboardEvent({ keyCode: 8 }).key, '\x7f'); // ^?
      // Tab
      assert.equal(testEvaluateKeyboardEvent({ keyCode: 9 }).key, '\t');
      // Return/enter
      assert.equal(testEvaluateKeyboardEvent({ keyCode: 13 }).key, '\r'); // CR
      // Escape
      assert.equal(testEvaluateKeyboardEvent({ keyCode: 27 }).key, '\x1b');
      // Page up, page down
      assert.equal(testEvaluateKeyboardEvent({ keyCode: 33 }).key, '\x1b[5~'); // CSI 5 ~
      assert.equal(testEvaluateKeyboardEvent({ keyCode: 34 }).key, '\x1b[6~'); // CSI 6 ~
      // End, Home
      assert.equal(testEvaluateKeyboardEvent({ keyCode: 35 }).key, '\x1b[F'); // SS3 F
      assert.equal(testEvaluateKeyboardEvent({ keyCode: 36 }).key, '\x1b[H'); // SS3 H
      // Left, up, right, down arrows
      assert.equal(testEvaluateKeyboardEvent({ keyCode: 37 }).key, '\x1b[D'); // CSI D
      assert.equal(testEvaluateKeyboardEvent({ keyCode: 38 }).key, '\x1b[A'); // CSI A
      assert.equal(testEvaluateKeyboardEvent({ keyCode: 39 }).key, '\x1b[C'); // CSI C
      assert.equal(testEvaluateKeyboardEvent({ keyCode: 40 }).key, '\x1b[B'); // CSI B
      // Insert
      assert.equal(testEvaluateKeyboardEvent({ keyCode: 45 }).key, '\x1b[2~'); // CSI 2 ~
      // Delete
      assert.equal(testEvaluateKeyboardEvent({ keyCode: 46 }).key, '\x1b[3~'); // CSI 3 ~
      // F1-F12
      assert.equal(testEvaluateKeyboardEvent({ keyCode: 112 }).key, '\x1bOP'); // SS3 P
      assert.equal(testEvaluateKeyboardEvent({ keyCode: 113 }).key, '\x1bOQ'); // SS3 Q
      assert.equal(testEvaluateKeyboardEvent({ keyCode: 114 }).key, '\x1bOR'); // SS3 R
      assert.equal(testEvaluateKeyboardEvent({ keyCode: 115 }).key, '\x1bOS'); // SS3 S
      assert.equal(testEvaluateKeyboardEvent({ keyCode: 116 }).key, '\x1b[15~'); // CSI 1 5 ~
      assert.equal(testEvaluateKeyboardEvent({ keyCode: 117 }).key, '\x1b[17~'); // CSI 1 7 ~
      assert.equal(testEvaluateKeyboardEvent({ keyCode: 118 }).key, '\x1b[18~'); // CSI 1 8 ~
      assert.equal(testEvaluateKeyboardEvent({ keyCode: 119 }).key, '\x1b[19~'); // CSI 1 9 ~
      assert.equal(testEvaluateKeyboardEvent({ keyCode: 120 }).key, '\x1b[20~'); // CSI 2 0 ~
      assert.equal(testEvaluateKeyboardEvent({ keyCode: 121 }).key, '\x1b[21~'); // CSI 2 1 ~
      assert.equal(testEvaluateKeyboardEvent({ keyCode: 122 }).key, '\x1b[23~'); // CSI 2 3 ~
      assert.equal(testEvaluateKeyboardEvent({ keyCode: 123 }).key, '\x1b[24~'); // CSI 2 4 ~
    });
    it('should return \\x1b[3;5~ for ctrl+delete', () => {
      assert.equal(testEvaluateKeyboardEvent({ ctrlKey: true, keyCode: 46 }).key, '\x1b[3;5~');
    });
    it('should return \\x1b[3;2~ for shift+delete', () => {
      assert.equal(testEvaluateKeyboardEvent({ shiftKey: true, keyCode: 46 }).key, '\x1b[3;2~');
    });
    it('should return \\x1b[3;3~ for alt+delete', () => {
      assert.equal(testEvaluateKeyboardEvent({ altKey: true, keyCode: 46 }).key, '\x1b[3;3~');
    });
    it('should return \\x1b\\r for alt+enter', () => {
      assert.equal(testEvaluateKeyboardEvent({ altKey: true, keyCode: 13 }).key, '\x1b\r');
    });
    it('should return \\x1b\\x1b for alt+esc', () => {
      assert.equal(testEvaluateKeyboardEvent({ altKey: true, keyCode: 27 }).key, '\x1b\x1b');
    });
    it('should return \\x1b[5D for ctrl+left', () => {
      assert.equal(testEvaluateKeyboardEvent({ ctrlKey: true, keyCode: 37 }).key, '\x1b[1;5D'); // CSI 5 D
    });
    it('should return \\x1b[5C for ctrl+right', () => {
      assert.equal(testEvaluateKeyboardEvent({ ctrlKey: true, keyCode: 39 }).key, '\x1b[1;5C'); // CSI 5 C
    });
    it('should return \\x1b[5A for ctrl+up', () => {
      assert.equal(testEvaluateKeyboardEvent({ ctrlKey: true, keyCode: 38 }).key, '\x1b[1;5A'); // CSI 5 A
    });
    it('should return \\x1b[5B for ctrl+down', () => {
      assert.equal(testEvaluateKeyboardEvent({ ctrlKey: true, keyCode: 40 }).key, '\x1b[1;5B'); // CSI 5 B
    });
    it('should return \\x08 for ctrl+backspace', () => {
      assert.equal(testEvaluateKeyboardEvent({ ctrlKey: true, keyCode: 8 }).key, '\x08');
    });
    it('should return \\x1b\\x7f for alt+backspace', () => {
      assert.equal(testEvaluateKeyboardEvent({ altKey: true, keyCode: 8 }).key, '\x1b\x7f');
    });
    it('should return \\x1b\\x08 for ctrl+alt+backspace', () => {
      assert.equal(testEvaluateKeyboardEvent({ ctrlKey: true, altKey: true, keyCode: 8 }).key, '\x1b\x08');
    });
    it('should return \\x1b[3;2~ for shift+delete', () => {
      assert.equal(testEvaluateKeyboardEvent({ shiftKey: true, keyCode: 46 }).key, '\x1b[3;2~');
    });
    it('should return \\x1b[3;3~ for alt+delete', () => {
      assert.equal(testEvaluateKeyboardEvent({ altKey: true, keyCode: 46 }).key, '\x1b[3;3~');
    });

    describe('On non-macOS platforms', () => {
      // Evalueate alt + arrow key movement, which is a feature of terminal emulators but not VT100
      // http://unix.stackexchange.com/a/108106
      it('should return \\x1b[5D for alt+left', () => {
        assert.equal(testEvaluateKeyboardEvent({ altKey: true, keyCode: 37 }, { isMac: false }).key, '\x1b[1;5D'); // CSI 5 D
      });
      it('should return \\x1b[5C for alt+right', () => {
        assert.equal(testEvaluateKeyboardEvent({ altKey: true, keyCode: 39 }, { isMac: false }).key, '\x1b[1;5C'); // CSI 5 C
      });
      it('should return \\x1b[5D for alt+up', () => {
        assert.equal(testEvaluateKeyboardEvent({ altKey: true, keyCode: 38 }, { isMac: false }).key, '\x1b[1;5A'); // CSI 5 D
      });
      it('should return \\x1b[5C for alt+down', () => {
        assert.equal(testEvaluateKeyboardEvent({ altKey: true, keyCode: 40 }, { isMac: false }).key, '\x1b[1;5B'); // CSI 5 C
      });
      it('should return \\x1ba for alt+a', () => {
        assert.equal(testEvaluateKeyboardEvent({ altKey: true, keyCode: 65 }, { isMac: false }).key, '\x1ba');
      });
      it('should return \\x1b\\x20 for alt+space', () => {
        assert.equal(testEvaluateKeyboardEvent({ altKey: true, keyCode: 32 }, { isMac: false }).key, '\x1b\x20');
      });
      it('should return \\x1b\\x00 for ctrl+alt+space', () => {
        assert.equal(testEvaluateKeyboardEvent({ altKey: true, ctrlKey: true, keyCode: 32 }, { isMac: false }).key, '\x1b\x00');
      });
    });

    describe('On macOS platforms', () => {
      it('should return \\x1bb for alt+left', () => {
        assert.equal(testEvaluateKeyboardEvent({ altKey: true, keyCode: 37 }, { isMac: true }).key, '\x1bb'); // CSI 5 D
      });
      it('should return \\x1bf for alt+right', () => {
        assert.equal(testEvaluateKeyboardEvent({ altKey: true, keyCode: 39 }, { isMac: true }).key, '\x1bf'); // CSI 5 C
      });
      it('should return \\x1bb for alt+up', () => {
        assert.equal(testEvaluateKeyboardEvent({ altKey: true, keyCode: 38 }, { isMac: true }).key, '\x1b[1;3A'); // CSI 5 D
      });
      it('should return \\x1bf for alt+down', () => {
        assert.equal(testEvaluateKeyboardEvent({ altKey: true, keyCode: 40 }, { isMac: true }).key, '\x1b[1;3B'); // CSI 5 C
      });
      it('should return undefined for alt+a', () => {
        assert.strictEqual(testEvaluateKeyboardEvent({ altKey: true, keyCode: 65 }, { isMac: true }).key, undefined);
      });
    });

    describe('with macOptionIsMeta', () => {
      it('should return \\x1ba for alt+a', () => {
        assert.equal(testEvaluateKeyboardEvent({ altKey: true, keyCode: 65 }, { isMac: true, macOptionIsMeta: true }).key, '\x1ba');
      });

      it('should return \\x1b\\x1b for alt+enter', () => {
        assert.equal(testEvaluateKeyboardEvent({ altKey: true, keyCode: 13 }, { isMac: true, macOptionIsMeta: true }).key, '\x1b\r');
      });
    });

    it('should return \\x1b[5A for alt+up', () => {
      assert.equal(testEvaluateKeyboardEvent({ altKey: true, keyCode: 38 }).key, '\x1b[1;5A'); // CSI 5 A
    });
    it('should return \\x1b[5B for alt+down', () => {
      assert.equal(testEvaluateKeyboardEvent({ altKey: true, keyCode: 40 }).key, '\x1b[1;5B'); // CSI 5 B
    });
    it('should return the correct escape sequence for modified F1-F12 keys', () => {
      assert.equal(testEvaluateKeyboardEvent({ shiftKey: true, keyCode: 112 }).key, '\x1b[1;2P');
      assert.equal(testEvaluateKeyboardEvent({ shiftKey: true, keyCode: 113 }).key, '\x1b[1;2Q');
      assert.equal(testEvaluateKeyboardEvent({ shiftKey: true, keyCode: 114 }).key, '\x1b[1;2R');
      assert.equal(testEvaluateKeyboardEvent({ shiftKey: true, keyCode: 115 }).key, '\x1b[1;2S');
      assert.equal(testEvaluateKeyboardEvent({ shiftKey: true, keyCode: 116 }).key, '\x1b[15;2~');
      assert.equal(testEvaluateKeyboardEvent({ shiftKey: true, keyCode: 117 }).key, '\x1b[17;2~');
      assert.equal(testEvaluateKeyboardEvent({ shiftKey: true, keyCode: 118 }).key, '\x1b[18;2~');
      assert.equal(testEvaluateKeyboardEvent({ shiftKey: true, keyCode: 119 }).key, '\x1b[19;2~');
      assert.equal(testEvaluateKeyboardEvent({ shiftKey: true, keyCode: 120 }).key, '\x1b[20;2~');
      assert.equal(testEvaluateKeyboardEvent({ shiftKey: true, keyCode: 121 }).key, '\x1b[21;2~');
      assert.equal(testEvaluateKeyboardEvent({ shiftKey: true, keyCode: 122 }).key, '\x1b[23;2~');
      assert.equal(testEvaluateKeyboardEvent({ shiftKey: true, keyCode: 123 }).key, '\x1b[24;2~');
      assert.equal(testEvaluateKeyboardEvent({ altKey: true, keyCode: 112 }).key, '\x1b[1;3P');
      assert.equal(testEvaluateKeyboardEvent({ altKey: true, keyCode: 113 }).key, '\x1b[1;3Q');
      assert.equal(testEvaluateKeyboardEvent({ altKey: true, keyCode: 114 }).key, '\x1b[1;3R');
      assert.equal(testEvaluateKeyboardEvent({ altKey: true, keyCode: 115 }).key, '\x1b[1;3S');
      assert.equal(testEvaluateKeyboardEvent({ altKey: true, keyCode: 116 }).key, '\x1b[15;3~');
      assert.equal(testEvaluateKeyboardEvent({ altKey: true, keyCode: 117 }).key, '\x1b[17;3~');
      assert.equal(testEvaluateKeyboardEvent({ altKey: true, keyCode: 118 }).key, '\x1b[18;3~');
      assert.equal(testEvaluateKeyboardEvent({ altKey: true, keyCode: 119 }).key, '\x1b[19;3~');
      assert.equal(testEvaluateKeyboardEvent({ altKey: true, keyCode: 120 }).key, '\x1b[20;3~');
      assert.equal(testEvaluateKeyboardEvent({ altKey: true, keyCode: 121 }).key, '\x1b[21;3~');
      assert.equal(testEvaluateKeyboardEvent({ altKey: true, keyCode: 122 }).key, '\x1b[23;3~');
      assert.equal(testEvaluateKeyboardEvent({ altKey: true, keyCode: 123 }).key, '\x1b[24;3~');

      assert.equal(testEvaluateKeyboardEvent({ ctrlKey: true, keyCode: 112 }).key, '\x1b[1;5P');
      assert.equal(testEvaluateKeyboardEvent({ ctrlKey: true, keyCode: 113 }).key, '\x1b[1;5Q');
      assert.equal(testEvaluateKeyboardEvent({ ctrlKey: true, keyCode: 114 }).key, '\x1b[1;5R');
      assert.equal(testEvaluateKeyboardEvent({ ctrlKey: true, keyCode: 115 }).key, '\x1b[1;5S');
      assert.equal(testEvaluateKeyboardEvent({ ctrlKey: true, keyCode: 116 }).key, '\x1b[15;5~');
      assert.equal(testEvaluateKeyboardEvent({ ctrlKey: true, keyCode: 117 }).key, '\x1b[17;5~');
      assert.equal(testEvaluateKeyboardEvent({ ctrlKey: true, keyCode: 118 }).key, '\x1b[18;5~');
      assert.equal(testEvaluateKeyboardEvent({ ctrlKey: true, keyCode: 119 }).key, '\x1b[19;5~');
      assert.equal(testEvaluateKeyboardEvent({ ctrlKey: true, keyCode: 120 }).key, '\x1b[20;5~');
      assert.equal(testEvaluateKeyboardEvent({ ctrlKey: true, keyCode: 121 }).key, '\x1b[21;5~');
      assert.equal(testEvaluateKeyboardEvent({ ctrlKey: true, keyCode: 122 }).key, '\x1b[23;5~');
      assert.equal(testEvaluateKeyboardEvent({ ctrlKey: true, keyCode: 123 }).key, '\x1b[24;5~');
    });

    // Characters using ctrl+alt sequences
    it('should return proper sequence for ctrl+alt+a', () => {
      assert.equal(testEvaluateKeyboardEvent({ altKey: true, ctrlKey: true, keyCode: 65 }).key, '\x1b\x01');
    });

    // Characters using alt sequences (numbers)
    it('should return proper sequences for alt+0', () => {
      assert.equal(testEvaluateKeyboardEvent({ altKey: true, shiftKey: false, keyCode: 48 }).key, '\x1b0');
      assert.equal(testEvaluateKeyboardEvent({ altKey: true, shiftKey: true,  keyCode: 48 }).key, '\x1b)');
    });
    it('should return proper sequences for alt+1', () => {
      assert.equal(testEvaluateKeyboardEvent({ altKey: true, shiftKey: false, keyCode: 49 }).key, '\x1b1');
      assert.equal(testEvaluateKeyboardEvent({ altKey: true, shiftKey: true,  keyCode: 49 }).key, '\x1b!');
    });
    it('should return proper sequences for alt+2', () => {
      assert.equal(testEvaluateKeyboardEvent({ altKey: true, shiftKey: false, keyCode: 50 }).key, '\x1b2');
      assert.equal(testEvaluateKeyboardEvent({ altKey: true, shiftKey: true,  keyCode: 50 }).key, '\x1b@');
    });
    it('should return proper sequences for alt+3', () => {
      assert.equal(testEvaluateKeyboardEvent({ altKey: true, shiftKey: false, keyCode: 51 }).key, '\x1b3');
      assert.equal(testEvaluateKeyboardEvent({ altKey: true, shiftKey: true,  keyCode: 51 }).key, '\x1b#');
    });
    it('should return proper sequences for alt+4', () => {
      assert.equal(testEvaluateKeyboardEvent({ altKey: true, shiftKey: false, keyCode: 52 }).key, '\x1b4');
      assert.equal(testEvaluateKeyboardEvent({ altKey: true, shiftKey: true,  keyCode: 52 }).key, '\x1b$');
    });
    it('should return proper sequences for alt+5', () => {
      assert.equal(testEvaluateKeyboardEvent({ altKey: true, shiftKey: false, keyCode: 53 }).key, '\x1b5');
      assert.equal(testEvaluateKeyboardEvent({ altKey: true, shiftKey: true,  keyCode: 53 }).key, '\x1b%');
    });
    it('should return proper sequences for alt+6', () => {
      assert.equal(testEvaluateKeyboardEvent({ altKey: true, shiftKey: false, keyCode: 54 }).key, '\x1b6');
      assert.equal(testEvaluateKeyboardEvent({ altKey: true, shiftKey: true,  keyCode: 54 }).key, '\x1b^');
    });
    it('should return proper sequences for alt+7', () => {
      assert.equal(testEvaluateKeyboardEvent({ altKey: true, shiftKey: false, keyCode: 55 }).key, '\x1b7');
      assert.equal(testEvaluateKeyboardEvent({ altKey: true, shiftKey: true,  keyCode: 55 }).key, '\x1b&');
    });
    it('should return proper sequences for alt+8', () => {
      assert.equal(testEvaluateKeyboardEvent({ altKey: true, shiftKey: false, keyCode: 56 }).key, '\x1b8');
      assert.equal(testEvaluateKeyboardEvent({ altKey: true, shiftKey: true,  keyCode: 56 }).key, '\x1b*');
    });
    it('should return proper sequences for alt+9', () => {
      assert.equal(testEvaluateKeyboardEvent({ altKey: true, shiftKey: false, keyCode: 57 }).key, '\x1b9');
      assert.equal(testEvaluateKeyboardEvent({ altKey: true, shiftKey: true,  keyCode: 57 }).key, '\x1b(');
    });

    // Characters using alt sequences (special chars)
    it('should return proper sequences for alt+;', () => {
      assert.equal(testEvaluateKeyboardEvent({ altKey: true, shiftKey: false, keyCode: 186 }).key, '\x1b;');
      assert.equal(testEvaluateKeyboardEvent({ altKey: true, shiftKey: true,  keyCode: 186 }).key, '\x1b:');
    });
    it('should return proper sequences for alt+=', () => {
      assert.equal(testEvaluateKeyboardEvent({ altKey: true, shiftKey: false, keyCode: 187 }).key, '\x1b=');
      assert.equal(testEvaluateKeyboardEvent({ altKey: true, shiftKey: true,  keyCode: 187 }).key, '\x1b+');
    });
    it('should return proper sequences for alt+,', () => {
      assert.equal(testEvaluateKeyboardEvent({ altKey: true, shiftKey: false, keyCode: 188 }).key, '\x1b,');
      assert.equal(testEvaluateKeyboardEvent({ altKey: true, shiftKey: true,  keyCode: 188 }).key, '\x1b<');
    });
    it('should return proper sequences for alt+-', () => {
      assert.equal(testEvaluateKeyboardEvent({ altKey: true, shiftKey: false, keyCode: 189 }).key, '\x1b-');
      assert.equal(testEvaluateKeyboardEvent({ altKey: true, shiftKey: true,  keyCode: 189 }).key, '\x1b_');
    });
    it('should return proper sequences for alt+.', () => {
      assert.equal(testEvaluateKeyboardEvent({ altKey: true, shiftKey: false, keyCode: 190 }).key, '\x1b.');
      assert.equal(testEvaluateKeyboardEvent({ altKey: true, shiftKey: true,  keyCode: 190 }).key, '\x1b>');
    });
    it('should return proper sequences for alt+/', () => {
      assert.equal(testEvaluateKeyboardEvent({ altKey: true, shiftKey: false, keyCode: 191 }).key, '\x1b/');
      assert.equal(testEvaluateKeyboardEvent({ altKey: true, shiftKey: true, keyCode: 191 }).key, '\x1b?');
    });
    it('should return proper sequences for alt+~', () => {
      assert.equal(testEvaluateKeyboardEvent({ altKey: true, shiftKey: false, keyCode: 192 }).key, '\x1b`');
      assert.equal(testEvaluateKeyboardEvent({ altKey: true, shiftKey: true, keyCode: 192 }).key, '\x1b~');
    });
    it('should return proper sequences for alt+[', () => {
      assert.equal(testEvaluateKeyboardEvent({ altKey: true, shiftKey: false, keyCode: 219 }).key, '\x1b[');
      assert.equal(testEvaluateKeyboardEvent({ altKey: true, shiftKey: true,  keyCode: 219 }).key, '\x1b{');
    });
    it('should return proper sequences for alt+\\', () => {
      assert.equal(testEvaluateKeyboardEvent({ altKey: true, shiftKey: false, keyCode: 220 }).key, '\x1b\\');
      assert.equal(testEvaluateKeyboardEvent({ altKey: true, shiftKey: true,  keyCode: 220 }).key, '\x1b|');
    });
    it('should return proper sequences for alt+]', () => {
      assert.equal(testEvaluateKeyboardEvent({ altKey: true, shiftKey: false, keyCode: 221 }).key, '\x1b]');
      assert.equal(testEvaluateKeyboardEvent({ altKey: true, shiftKey: true,  keyCode: 221 }).key, '\x1b}');
    });
    it('should return proper sequences for alt+\'', () => {
      assert.equal(testEvaluateKeyboardEvent({ altKey: true, shiftKey: false, keyCode: 222 }).key, '\x1b\'');
      assert.equal(testEvaluateKeyboardEvent({ altKey: true, shiftKey: true,  keyCode: 222 }).key, '\x1b"');
    });

    it('should handle mobile arrow events', () => {
      assert.equal(testEvaluateKeyboardEvent({ keyCode: 0, key: 'UIKeyInputUpArrow' }).key, '\x1b[A');
      assert.equal(testEvaluateKeyboardEvent({ keyCode: 0, key: 'UIKeyInputUpArrow' }, { applicationCursorMode: true }).key, '\x1bOA');
      assert.equal(testEvaluateKeyboardEvent({ keyCode: 0, key: 'UIKeyInputLeftArrow' }).key, '\x1b[D');
      assert.equal(testEvaluateKeyboardEvent({ keyCode: 0, key: 'UIKeyInputLeftArrow' }, { applicationCursorMode: true }).key, '\x1bOD');
      assert.equal(testEvaluateKeyboardEvent({ keyCode: 0, key: 'UIKeyInputRightArrow' }).key, '\x1b[C');
      assert.equal(testEvaluateKeyboardEvent({ keyCode: 0, key: 'UIKeyInputRightArrow' }, { applicationCursorMode: true }).key, '\x1bOC');
      assert.equal(testEvaluateKeyboardEvent({ keyCode: 0, key: 'UIKeyInputDownArrow' }).key, '\x1b[B');
      assert.equal(testEvaluateKeyboardEvent({ keyCode: 0, key: 'UIKeyInputDownArrow' }, { applicationCursorMode: true }).key, '\x1bOB');
    });

    it('should handle lowercase letters', () => {
      assert.equal(testEvaluateKeyboardEvent({ keyCode: 65, key: 'a' }).key, 'a');
      assert.equal(testEvaluateKeyboardEvent({ keyCode: 189, key: '-' }).key, '-');
    });

    it('should handle uppercase letters', () => {
      assert.equal(testEvaluateKeyboardEvent({ shiftKey: true, keyCode: 65, key: 'A' }).key, 'A');
      assert.equal(testEvaluateKeyboardEvent({ shiftKey: true, keyCode: 49, key: '!' }).key, '!');
    });

    it('should return proper sequence for ctrl+@', () => {
      assert.equal(testEvaluateKeyboardEvent({ ctrlKey: true, shiftKey: true, keyCode: 50, key: '@' }).key, '\x00');
    });

  });
});
