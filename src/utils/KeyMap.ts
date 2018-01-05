
import { C0 } from '../EscapeSequences';
import { IBrowser } from '../Interfaces';

export interface IKeyHandlerResult {
  cancel: boolean;
  key: string;
  scrollLines: number;
}

export interface IKeyMap {
  getKeyCodeByName(keyName: string): number;
  getKeyNamesByCode(keyCode: number): string [];
  mapFromKeyCombinationName(keyCombName: string, env: IKeyMapEnv): IKeyHandlerResult | undefined;
  mapFromKeyboardEvent(ev: IKeyboardEvent, env: IKeyMapEnv): IKeyHandlerResult | undefined;
  modifiersFromKeyboardEvent(ev: IKeyboardEvent): number;
}

export interface IKeyboardEvent {
  keyCode: number;
  shiftKey: boolean;
  altKey: boolean;
  ctrlKey: boolean;
  metaKey: boolean;
}

export interface IKeyMapEnv {
  browser: IBrowser;
  applicationCursor: boolean;
  rows: number;
  cols: number;
}

export const MODIFIERS = {
  SHIFT   : 1,
  ALT     : 2,
  CONTROL : 4,
  META    : 8
};

const KEYCODES = {
  8   : 'Backspace',
  9   : 'Tab',
  13  : 'Enter|Return',
  27  : 'Esc|Escape',
  33  : 'PgUp|PageUp',
  34  : 'PgDown|PageDown',
  35  : 'End',
  36  : 'Home',
  37  : 'Left',
  38  : 'Up',
  39  : 'Right',
  40  : 'Down',
  45  : 'Insert',
  46  : 'Delete|Del',
  93  : 'Select',
  96  : 'KP_0|KP0',
  97  : 'KP_1|KP1',
  98  : 'KP_2|KP2',
  99  : 'KP_3|KP3',
  100 : 'KP_4|KP4',
  101 : 'KP_5|KP5',
  102 : 'KP_6|KP6',
  103 : 'KP_7|KP7',
  104 : 'KP_8|KP8',
  105 : 'KP_9|KP9',
  106 : 'KP_Multiply|Multiply',
  107 : 'KP_Add|Add',
  109 : 'KP_Subtract|Subtract',
  110 : 'KP_Decimal|Decimal',
  111 : 'KP_Divide|Divide',
  176 : 'KP_Enter|KP_Return',
  144 : 'NumLock|NumLk|Gold',
  112 : 'F1',
  113 : 'F2',
  114 : 'F3',
  115 : 'F4',
  116 : 'F5',
  117 : 'F6',
  118 : 'F7',
  119 : 'F8',
  120 : 'F9',
  121 : 'F10',
  122 : 'F11',
  123 : 'F12'
};

const arrowHelper = (stdSuffix, macSuffix, mods, env) => {
  let res = '';
  if (mods) {
    res = C0.ESC + '[1;' + (mods + 1) + stdSuffix;
    // HACK: Make Alt + <direction>-arrow behave like Ctrl + <direction>-arrow
    // http://unix.stackexchange.com/a/108106
    // macOS uses different escape sequences than linux
    if (res === C0.ESC + '[1;3' + stdSuffix) {
      res = (env.browser.isMac && macSuffix) ? C0.ESC + macSuffix : C0.ESC + '[1;5' + stdSuffix;
    }
  } else if (env.applicationCursor) {
    res = C0.ESC + 'O' + stdSuffix;
  } else {
    res = C0.ESC + '[' + stdSuffix;
  }
  return { key: res };
};

/* NOTE: defining Backspace=C0.DEL and Shift+Backspace=C0.BS is not enough
 * as for example for Control+Shift+Backspace, we fall back to Backspace,
 * not to Shift+Backspace
 * So Shift+Backspace would handle exactly Shift+Backspace and nothing else!
 */
const DEFAULT_DEFINITIONS = {
  'Backspace'           : (mods) => ({ key: !!(mods & MODIFIERS.SHIFT) ? C0.BS : C0.DEL }),
  'Tab'                 : (mods) => (!!(mods & MODIFIERS.SHIFT) ? { key: (C0.ESC + '[Z'), cancel: true } : { key: C0.HT }),
  'Enter'               : { key: C0.CR, cancel: true },
  'Escape'              : { key: C0.ESC, cancel: true },
  'Left'                : (mods, env) => arrowHelper('D', 'b', mods, env),
  'Right'               : (mods, env) => arrowHelper('C', 'f', mods, env),
  'Up'                  : (mods, env) => arrowHelper('A', null, mods, env),
  'Down'                : (mods, env) => arrowHelper('B', null, mods, env),
  'Insert'              : (mods) => ((!(mods & (MODIFIERS.SHIFT | MODIFIERS.CONTROL))) ? { key: C0.ESC + '[2~' } : undefined),
  'Delete'              : (mods) => ({ key: C0.ESC + '[3' + (mods ? (';' + (mods + 1)) : '') + '~' }),
  'Home'                : (mods, env) => ({
    key: C0.ESC + (mods ? ('[1;' + (mods + 1)) : (env.applicationCursor ? 'O' : '[')) + 'H'
  }),
  'End'                 : (mods, env) => ({
    key: C0.ESC + (mods ? ('[1;' + (mods + 1)) : (env.applicationCursor ? 'O' : '[')) + 'F'
  }),
  'PageUp'              : (mods, env) => (!(mods & MODIFIERS.SHIFT) ? { key: C0.ESC + '[5~' } : { scrollLines: -(env.rows - 1) }),
  'PageDown'            : (mods, env) => (!(mods & MODIFIERS.SHIFT) ? { key: C0.ESC + '[6~' } : { scrollLines: env.rows - 1 }),
  'KP0'                 : '0',
  'KP1'                 : '1',
  'KP2'                 : '2',
  'KP3'                 : '3',
  'KP4'                 : '4',
  'KP5'                 : '5',
  'KP6'                 : '6',
  'KP7'                 : '7',
  'KP8'                 : '8',
  'KP9'                 : '9',
  'KP_Multiply'         : '*',
  'KP_Add'              : '+',
  'KP_Subtract'         : '-',
  'KP_Decimal'          : '.',
  'KP_Divide'           : '/',
  'KP_Enter'            : { key: C0.CR, cancel: true },
  'F1'                  : (mods) => ({ key: C0.ESC + (mods ? ('[1;' + (mods + 1)) : 'O') + 'P' }),
  'F2'                  : (mods) => ({ key: C0.ESC + (mods ? ('[1;' + (mods + 1)) : 'O') + 'Q' }),
  'F3'                  : (mods) => ({ key: C0.ESC + (mods ? ('[1;' + (mods + 1)) : 'O') + 'R' }),
  'F4'                  : (mods) => ({ key: C0.ESC + (mods ? ('[1;' + (mods + 1)) : 'O') + 'S' }),
  'F5'                  : (mods) => ({ key: C0.ESC + ('[15' + (mods ? (';' + (mods + 1)) : '') + '~') }),
  'F6'                  : (mods) => ({ key: C0.ESC + ('[17' + (mods ? (';' + (mods + 1)) : '') + '~') }),
  'F7'                  : (mods) => ({ key: C0.ESC + ('[18' + (mods ? (';' + (mods + 1)) : '') + '~') }),
  'F8'                  : (mods) => ({ key: C0.ESC + ('[19' + (mods ? (';' + (mods + 1)) : '') + '~') }),
  'F9'                  : (mods) => ({ key: C0.ESC + ('[20' + (mods ? (';' + (mods + 1)) : '') + '~') }),
  'F10'                 : (mods) => ({ key: C0.ESC + ('[21' + (mods ? (';' + (mods + 1)) : '') + '~') }),
  'F11'                 : (mods) => ({ key: C0.ESC + ('[23' + (mods ? (';' + (mods + 1)) : '') + '~') }),
  'F12'                 : (mods) => ({ key: C0.ESC + ('[24' + (mods ? (';' + (mods + 1)) : '') + '~') })
};

export class KeyMap implements IKeyMap {

  private definitions     = {};
  private cache           = {};
  private indexCode2Names = KEYCODES;
  private indexName2Code  = {};

  // XXX: formalize definitions? how to define { keyCombinationString => IKeyHandlerResult } structure?
  constructor(definitions: any) {
    this.definitions = { ...DEFAULT_DEFINITIONS, ...definitions };
    this.buildIndices();
    this.buildCache();
  }

  public getKeyCodeByName(keyName: string): number {
    return this.indexName2Code[keyName.toUpperCase()];
  }

  public getKeyNamesByCode(keyCode: number): string [] {
    const names = this.indexCode2Names[keyCode];
    return names ? names.split(/\|/) : undefined;
  }

  public mapFromKeyCombinationName(keyCombName: string, env: IKeyMapEnv): IKeyHandlerResult | undefined {
    const hash = this.hashKeyBindingString(keyCombName);
    return this.getKeyHandlerResultByHash(hash, env);
  }

  public mapFromKeyboardEvent(ev: IKeyboardEvent, env: IKeyMapEnv): IKeyHandlerResult | undefined {
    const hash = this.hashKeyboardEvent(ev);
    return this.getKeyHandlerResultByHash(hash, env);
  }

  public modifiersFromKeyboardEvent(ev: IKeyboardEvent): number {
    return (ev.shiftKey ? MODIFIERS.SHIFT   : 0)
         | (ev.altKey   ? MODIFIERS.ALT     : 0)
         | (ev.ctrlKey  ? MODIFIERS.CONTROL : 0)
         | (ev.metaKey  ? MODIFIERS.META    : 0);
  }

  private hashKeyboardEvent(ev: IKeyboardEvent): number {
    return ((ev.keyCode << 4) | this.modifiersFromKeyboardEvent(ev));
  }

  private getKeyHandlerResultByHash(hash: number, env: IKeyMapEnv): IKeyHandlerResult | undefined {
    const base  = hash >> 4 << 4;
    const mods  = hash ^ base;
    const entry = this.cache[hash] || this.cache[base];
    return (typeof (entry) === 'function') ? entry (mods, env) : entry;
  }

  /**
   * Returns a numeric representation of the key and modifiers in the input string.
   * The input string can be: 'Control+Alt-F1' hence '+' and '-' delimiters are
   * allowed and it is not order sensitive.
   * @param keyWithModStr The key binding string.
   */
  private hashKeyBindingString(keyWithModStr: string): number {
    const keys = keyWithModStr.toUpperCase().split(/\+|-/);
    let [len, result, key] = [keys.length, 0, null];
    while (len--) {
      switch (keys[len]) {
        case 'S':
        case 'SHIFT':
          result |= MODIFIERS.SHIFT;
          break;
        case 'A':
        case 'ALT':
          result |= MODIFIERS.ALT;
          break;
        case 'C':
        case 'CTRL':
        case 'CONTROL':
          result |= MODIFIERS.CONTROL;
          break;
        case 'M':
        case 'META':
          result |= MODIFIERS.META;
          break;
        default:
          // We already have a key
          if (result >> 4) throw Error('Invariant: more than one non-modifier keys are not allowed: ' + keyWithModStr);
          let keyCode = this.getKeyCodeByName(keys[len]);
          if (!keyCode) throw Error('Invariant: unsupported key name: ' + keys[len]);
          result |= (keyCode << 4);
          break;
      }
    }
    // XXX: do we want to throw an exception if there modifiers only?!
    return result;
  }

  private buildCache(): void {
    let result = {};
    Object.keys (this.definitions).forEach ((keyWithModStr) => {
      const keyHash: number = this.hashKeyBindingString(keyWithModStr);
      const keyBinding = this.definitions[keyWithModStr];
      const keyBindingType = typeof (keyBinding);
      const base  = keyHash >> 4 << 4;
      const mods  = keyHash ^ base;
      const hasMods = (mods > 0);
      if (keyBindingType === 'string')
        result[keyHash] = {
          key: keyBinding,
          cancel: false,
          scrollLines: undefined
        };
      else if (keyBindingType === 'object') {
        result[keyHash] = {
          key          : keyBinding.key || undefined,
          cancel       : keyBinding.cancel || false,
          scrollLines  : keyBinding.scrollLines || undefined
        };
      }
      else if (keyBindingType === 'function') {
        if (hasMods)
          throw Error('Invariant: generic key handler function can be defined only for a fallback key without modifiers');
        else result[keyHash] = keyBinding;
      }
      else throw Error('Invariant: KeyMap entry must map key combinations to IKeyHandlerResult');
    });
    this.cache = result;
  }

  private buildIndices(): void {
    this.indexCode2Names = KEYCODES;
    Object.keys (this.indexCode2Names).forEach (code => {
      const keyNameString = this.indexCode2Names[code];
      const keyNames = keyNameString.toUpperCase().split(/\|/);
      keyNames.forEach (name => { this.indexName2Code[name] = code; });
    });
  }
}
