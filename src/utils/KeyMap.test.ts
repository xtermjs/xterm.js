/**
 * Copyright (c) 2017 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import { assert } from 'chai';
import { C0 } from '../EscapeSequences';
import { KeyMap, IKeyMap, IKeyMapEnv, IKeyHandlerResult, IKeyboardEvent, MODIFIERS } from './KeyMap';

const keyMapEnv: IKeyMapEnv = {
  browser: {
    isNode: true,
    userAgent: 'curl',
    platform: 'Linux',
    isFirefox: false,
    isMSIE: false,
    isMac: false,
    isIpad: false,
    isIphone: false,
    isMSWindows: false
  },
  applicationCursor: false,
  rows: 24,
  cols: 80
};

describe('KeyMap', () => {
  describe('no options passed, key name/code resolution', () => {
    it('try to resolve some keys by name', () => {
      const keyMap = new KeyMap({});
      assert.equal(keyMap.getKeyCodeByName('Enter'), 13);
      assert.equal(keyMap.getKeyCodeByName('KP1'),   97);
      assert.equal(keyMap.getKeyCodeByName('F4'),   115);
    });
    it('try to resolve some keys by code', () => {
      const keyMap = new KeyMap({});
      assert.deepEqual(keyMap.getKeyNamesByCode(13).sort(), ['Enter', 'Return'].sort());
      assert.deepEqual(keyMap.getKeyNamesByCode(99).sort(), ['KP3', 'KP_3'].sort());
    });
  });
  describe('check mapping', () => {
    it('plain mapping w/o modifiers', () => {
      const keyMap = new KeyMap({ 'F1' : 'functionKey1' });
      const result: IKeyHandlerResult = keyMap.mapFromKeyCombinationName('F1', keyMapEnv);
      assert.equal(result.key, 'functionKey1');
    });
    it('plain mapping from KeyboardEvent', () => {
      const keyMap: IKeyMap = new KeyMap({ 'F1' : 'functionKey1' });
      const ev: IKeyboardEvent = {
        keyCode   : 112,
        shiftKey  : false,
        altKey    : false,
        ctrlKey   : false,
        metaKey   : false
      };
      const result: IKeyHandlerResult = keyMap.mapFromKeyboardEvent(ev, keyMapEnv);
      assert.equal(result.key, 'functionKey1');
    });
    it('advanced object mapping w/o modifiers', () => {
      const keyMap = new KeyMap({ 'F1' : { key: 'functionKey1', cancel: true } });
      const result: IKeyHandlerResult = keyMap.mapFromKeyCombinationName('F1', keyMapEnv);
      assert.equal(result.key, 'functionKey1');
      assert.equal(result.cancel, true);
      assert.equal(result.scrollLines, undefined);
    });
    it('Control-F5 retrieved as Control-F5', () => {
      const keyMap = new KeyMap({ 'Control-F5' : 'functionKey5WithControl' });
      const result: IKeyHandlerResult = keyMap.mapFromKeyCombinationName('Control-F5', keyMapEnv);
      assert.equal(result.key, 'functionKey5WithControl');
    });
    it('Control-F5 retrieved as Control+F5', () => {
      const keyMap = new KeyMap({ 'Control-F5' : 'functionKey5WithControl' });
      const result: IKeyHandlerResult = keyMap.mapFromKeyCombinationName('Control+F5', keyMapEnv);
      assert.equal(result.key, 'functionKey5WithControl');
    });
    it('Control-F5 retrieved as C-F5', () => {
      const keyMap = new KeyMap({ 'Control-F5' : 'functionKey5WithControl' });
      const result: IKeyHandlerResult = keyMap.mapFromKeyCombinationName('C-F5', keyMapEnv);
      assert.equal(result.key, 'functionKey5WithControl');
    });
    it('Home retrieved as HOME', () => {
      const keyMap = new KeyMap({ 'Home' : 'HOME_KEY_BINDING' });
      const result: IKeyHandlerResult = keyMap.mapFromKeyCombinationName('HOME', keyMapEnv);
      assert.equal(result.key, 'HOME_KEY_BINDING');
    });
    it('DELETE retrieved as Del', () => {
      const keyMap = new KeyMap({ 'Home' : 'HOME_KEY_BINDING' });
      const result: IKeyHandlerResult = keyMap.mapFromKeyCombinationName('HOME', keyMapEnv);
      assert.equal(result.key, 'HOME_KEY_BINDING');
    });
    it('multiple mappings, last wins', () => {
      const keyMap = new KeyMap({
        'M-A-C-S-F1' : 'MACSF1',
        'M-A-C-F1'   : 'MACF1',
        'M-A-F1'     : 'MAF1',
        'M-F1'       : 'MF1',
        // The same mappings redefined -- last entry wins !
        'F1-S-C-A-M' : 'F1SCAM',
        'F1-C-A-M'   : 'F1CAM',
        'F1-A-M'     : 'F1AM',
        'F1-M'       : 'F1M'
      });
      assert.equal(keyMap.mapFromKeyCombinationName('Meta-Alt-Control-Shift-F1', keyMapEnv).key, 'F1SCAM');
      assert.equal(keyMap.mapFromKeyCombinationName('Meta-Alt-Control-F1', keyMapEnv).key, 'F1CAM');
      assert.equal(keyMap.mapFromKeyCombinationName('M+ALT+F1', keyMapEnv).key, 'F1AM');
      assert.equal(keyMap.mapFromKeyCombinationName('META-F1', keyMapEnv).key, 'F1M');
    });
    it('verify default mapping for F5', () => {
      const keyMap = new KeyMap({});
      const F5 = keyMap.mapFromKeyCombinationName('F5', keyMapEnv).key.replace(C0.ESC, '^');
      const F5seq = '^[15~';
      assert.equal(F5, F5seq);
    });
    it('verify default mapping for C-F5', () => {
      const keyMap = new KeyMap({});
      const ctrlF5 = keyMap.mapFromKeyCombinationName('C-F5', keyMapEnv).key.replace(C0.ESC, '^');
      const ctrlF5seq = '^[15;5~';
      assert.equal(ctrlF5, ctrlF5seq);
    });
    it('C-F5 override even if F5 main handler is set', () => {
      const keyMap = new KeyMap({ 'Control+F5': 'overrideF5' });
      const ctrlF5 = keyMap.mapFromKeyCombinationName('C-F5', keyMapEnv).key.replace(C0.ESC, '^');
      assert.equal(ctrlF5, 'overrideF5');
    });
    it('multiple non-modifier keys invariant', () => {
      const keyMap = new KeyMap({});
      assert.throws(() => {
        keyMap.mapFromKeyCombinationName('F1+F2+F3', keyMapEnv);
      }, /Invariant: more than one non-modifier keys are not allowed/);
    });
    it('unsupported keys invariant', () => {
      const keyMap = new KeyMap({});
      assert.throws(() => {
        keyMap.mapFromKeyCombinationName('Compose+PF1', keyMapEnv);
      }, /Invariant: unsupported key name/);
    });
    it('invalid mapping invariant for invalid binding value (number)', () => {
      // neither string nor object!
      assert.throws(() => {
        new KeyMap({ 'F1': 1234 });
      }, /Invariant: KeyMap entry must map key combinations to IKeyHandlerResult/);
    });
    it('invalid mapping invariant for callback with modifiers', () => {
      // function can be passed only to F1, not to Control+F1!
      assert.throws(() => {
        new KeyMap({ 'Control+F1': () => ({ key: 'myF1Mapping' }) });
      }, /Invariant: generic key handler function can be defined only for a fallback key without modifiers/);
    });
  });
  describe('check default mapping', () => {
    const keyMap = new KeyMap({});
    for (let i = 0; i < 256; i++) {
      let names = keyMap.getKeyNamesByCode(i);
      if (!names) continue; // undefined key
      for (let mods = 0; mods < 16; mods++) {
        let ev: IKeyboardEvent = {
          keyCode   : i,
          shiftKey  : !!(mods & MODIFIERS.SHIFT),
          altKey    : !!(mods & MODIFIERS.ALT),
          ctrlKey   : !!(mods & MODIFIERS.CONTROL),
          metaKey   : !!(mods & MODIFIERS.META)
        };
        let strMods = [
          ev.shiftKey ? '+Shift' : '',
          ev.altKey   ? '+Alt'   : '',
          ev.ctrlKey  ? '+Ctrl'  : '',
          ev.metaKey  ? '+Meta'  : ''
        ].join('');
        for (let k = 0; k < 4; k++) {
          let myEnv = {
            ...keyMapEnv,
            applicationCursor: !(k & 1),
            browser: { ...keyMapEnv.browser, isMac: !(k & 2) }
          };
          let checkName = 'check ' + names.join('/') + ' [' + i + '] ' + strMods +
            ' appCursor=' + (myEnv.applicationCursor ? 'on' : 'off') +
            ' isMac=' + (myEnv.browser.isMac ? 'on' : 'off');
          it(checkName, () => {
            const result: IKeyHandlerResult = keyMap.mapFromKeyboardEvent(ev, myEnv);
            const defaultResult: IKeyHandlerResult = getDefaultMapping (keyMap, ev, myEnv);
            assert.equal(result ? result.key : undefined, defaultResult ? defaultResult.key : undefined);
          });
        }
      }
    }
  });
});

const getDefaultMapping = (keyMap: IKeyMap, ev: IKeyboardEvent, env: IKeyMapEnv) => {
  const result: IKeyHandlerResult = {
    // Whether to cancel event propogation (NOTE: this may not be needed since the event is
    // canceled at the end of keyDown
    cancel: false,
    // The new key even to emit
    key: undefined,
    // The number of characters to scroll, if this is defined it will cancel the event
    scrollLines: undefined
  };
  const modifiers = keyMap.modifiersFromKeyboardEvent(ev);
  switch (ev.keyCode) {
      case 8:
        // backspace
        if (ev.shiftKey) {
          result.key = C0.BS; // ^H
          break;
        }
        result.key = C0.DEL; // ^?
        break;
      case 9:
        // tab
        if (ev.shiftKey) {
          result.key = C0.ESC + '[Z';
          break;
        }
        result.key = C0.HT;
        result.cancel = true;
        break;
      case 13:  // main enter/return
      case 176: // keypad enter
        // return/enter
        result.key = C0.CR;
        result.cancel = true;
        break;
      case 27:
        // escape
        result.key = C0.ESC;
        result.cancel = true;
        break;
      case 37:
        // left-arrow
        if (modifiers) {
          result.key = C0.ESC + '[1;' + (modifiers + 1) + 'D';
          // HACK: Make Alt + left-arrow behave like Ctrl + left-arrow: move one word backwards
          // http://unix.stackexchange.com/a/108106
          // macOS uses different escape sequences than linux
          if (result.key === C0.ESC + '[1;3D') {
            result.key = (env.browser.isMac) ? C0.ESC + 'b' : C0.ESC + '[1;5D';
          }
        } else if (env.applicationCursor) {
          result.key = C0.ESC + 'OD';
        } else {
          result.key = C0.ESC + '[D';
        }
        break;
      case 39:
        // right-arrow
        if (modifiers) {
          result.key = C0.ESC + '[1;' + (modifiers + 1) + 'C';
          // HACK: Make Alt + right-arrow behave like Ctrl + right-arrow: move one word forward
          // http://unix.stackexchange.com/a/108106
          // macOS uses different escape sequences than linux
          if (result.key === C0.ESC + '[1;3C') {
            result.key = (env.browser.isMac) ? C0.ESC + 'f' : C0.ESC + '[1;5C';
          }
        } else if (env.applicationCursor) {
          result.key = C0.ESC + 'OC';
        } else {
          result.key = C0.ESC + '[C';
        }
        break;
      case 38:
        // up-arrow
        if (modifiers) {
          result.key = C0.ESC + '[1;' + (modifiers + 1) + 'A';
          // HACK: Make Alt + up-arrow behave like Ctrl + up-arrow
          // http://unix.stackexchange.com/a/108106
          if (result.key === C0.ESC + '[1;3A') {
            result.key = C0.ESC + '[1;5A';
          }
        } else if (env.applicationCursor) {
          result.key = C0.ESC + 'OA';
        } else {
          result.key = C0.ESC + '[A';
        }
        break;
      case 40:
        // down-arrow
        if (modifiers) {
          result.key = C0.ESC + '[1;' + (modifiers + 1) + 'B';
          // HACK: Make Alt + down-arrow behave like Ctrl + down-arrow
          // http://unix.stackexchange.com/a/108106
          if (result.key === C0.ESC + '[1;3B') {
            result.key = C0.ESC + '[1;5B';
          }
        } else if (env.applicationCursor) {
          result.key = C0.ESC + 'OB';
        } else {
          result.key = C0.ESC + '[B';
        }
        break;
      case 45:
        // insert
        if (!ev.shiftKey && !ev.ctrlKey) {
          // <Ctrl> or <Shift> + <Insert> are used to
          // copy-paste on some systems.
          result.key = C0.ESC + '[2~';
        }
        break;
      case 46:
        // delete
        if (modifiers) {
          result.key = C0.ESC + '[3;' + (modifiers + 1) + '~';
        } else {
          result.key = C0.ESC + '[3~';
        }
        break;
      case 36:
        // home
        if (modifiers)
          result.key = C0.ESC + '[1;' + (modifiers + 1) + 'H';
        else if (env.applicationCursor)
          result.key = C0.ESC + 'OH';
        else
          result.key = C0.ESC + '[H';
        break;
      case 35:
        // end
        if (modifiers)
          result.key = C0.ESC + '[1;' + (modifiers + 1) + 'F';
        else if (env.applicationCursor)
          result.key = C0.ESC + 'OF';
        else
          result.key = C0.ESC + '[F';
        break;
      case 33:
        // page up
        if (ev.shiftKey) {
          result.scrollLines = -(env.rows - 1);
        } else {
          result.key = C0.ESC + '[5~';
        }
        break;
      case 34:
        // page down
        if (ev.shiftKey) {
          result.scrollLines = env.rows - 1;
        } else {
          result.key = C0.ESC + '[6~';
        }
        break;
      case 96:
        // KP_0
        result.key = '0';
        break;
      case 97:
        // KP_1
        result.key = '1';
        break;
      case 98:
        // KP_2
        result.key = '2';
        break;
      case 99:
        // KP_3
        result.key = '3';
        break;
      case 100:
        // KP_4
        result.key = '4';
        break;
      case 101:
        // KP_5
        result.key = '5';
        break;
      case 102:
        // KP_6
        result.key = '6';
        break;
      case 103:
        // KP_7
        result.key = '7';
        break;
      case 104:
        // KP_8
        result.key = '8';
        break;
      case 105:
        // KP_9
        result.key = '9';
        break;
      case 106:
        // KP_Multiply
        result.key = '*';
        break;
      case 107:
        // KP_Add
        result.key = '+';
        break;
      case 109:
        // KP_Subtract
        result.key = '-';
        break;
      case 110:
        // KP_Decimal
        result.key = '.';
        break;
      case 111:
        // KP_Divide
        result.key = '/';
        break;
      case 112:
        // F1-F12
        if (modifiers) {
          result.key = C0.ESC + '[1;' + (modifiers + 1) + 'P';
        } else {
          result.key = C0.ESC + 'OP';
        }
        break;
      case 113:
        if (modifiers) {
          result.key = C0.ESC + '[1;' + (modifiers + 1) + 'Q';
        } else {
          result.key = C0.ESC + 'OQ';
        }
        break;
      case 114:
        if (modifiers) {
          result.key = C0.ESC + '[1;' + (modifiers + 1) + 'R';
        } else {
          result.key = C0.ESC + 'OR';
        }
        break;
      case 115:
        if (modifiers) {
          result.key = C0.ESC + '[1;' + (modifiers + 1) + 'S';
        } else {
          result.key = C0.ESC + 'OS';
        }
        break;
      case 116:
        if (modifiers) {
          result.key = C0.ESC + '[15;' + (modifiers + 1) + '~';
        } else {
          result.key = C0.ESC + '[15~';
        }
        break;
      case 117:
        if (modifiers) {
          result.key = C0.ESC + '[17;' + (modifiers + 1) + '~';
        } else {
          result.key = C0.ESC + '[17~';
        }
        break;
      case 118:
        if (modifiers) {
          result.key = C0.ESC + '[18;' + (modifiers + 1) + '~';
        } else {
          result.key = C0.ESC + '[18~';
        }
        break;
      case 119:
        if (modifiers) {
          result.key = C0.ESC + '[19;' + (modifiers + 1) + '~';
        } else {
          result.key = C0.ESC + '[19~';
        }
        break;
      case 120:
        if (modifiers) {
          result.key = C0.ESC + '[20;' + (modifiers + 1) + '~';
        } else {
          result.key = C0.ESC + '[20~';
        }
        break;
      case 121:
        if (modifiers) {
          result.key = C0.ESC + '[21;' + (modifiers + 1) + '~';
        } else {
          result.key = C0.ESC + '[21~';
        }
        break;
      case 122:
        if (modifiers) {
          result.key = C0.ESC + '[23;' + (modifiers + 1) + '~';
        } else {
          result.key = C0.ESC + '[23~';
        }
        break;
      case 123:
        if (modifiers) {
          result.key = C0.ESC + '[24;' + (modifiers + 1) + '~';
        } else {
          result.key = C0.ESC + '[24~';
        }
        break;
      case 144: // numlock
        break;
      case 93: // select
        break;
  }
  return result;
};
