/**
 * Copyright (c) 2026 The xterm.js authors. All rights reserved.
 * @license MIT
 *
 * Keyboard layout detection.
 */


interface IMap {
  acc: {[index: string]: number};
  map: {[index: string]: string | string[]};
}

interface IKeyResult {
  layouts: string[];
  certain: number;
  key: string | undefined | (string | undefined)[];
}


/**
 * rebuild map: node bin/keyboard_layouts.mjs fixtures/keyboard_layouts/*
 */
const MAP: IMap = {
  acc: { DE: 0, ES: 1, ES_LA: 2, FR: 3, GR: 4, RU: 5, US: 6 },
  map: {
    Backquote: '^º|²`ё`',
    Backslash: '#ç}*\\\\\\',
    BracketLeft: 'ü`´^[х[',
    BracketRight: '+++$]ъ]',
    Comma: ',,,;,б,',
    Digit0: '000à000',
    Digit1: '111&111',
    Digit2: '222é222',
    Digit3: '333"333',
    Digit4: "444'444",
    Digit5: '555(555',
    Digit6: '666-666',
    Digit7: '777è777',
    Digit8: '888_888',
    Digit9: '999ç999',
    Equal: '´¡¿====',
    IntlBackslash: '<<<<«/\\',
    KeyA: 'aaaqαфa',
    KeyB: 'bbbbβиb',
    KeyC: 'ccccψсc',
    KeyD: 'ddddδвd',
    KeyE: 'eeeeεуe',
    KeyF: 'ffffφаf',
    KeyG: 'ggggγпg',
    KeyH: 'hhhhηрh',
    KeyI: 'iiiiιшi',
    KeyJ: 'jjjjξоj',
    KeyK: 'kkkkκлk',
    KeyL: 'llllλдl',
    KeyM: 'mmm,μьm',
    KeyN: 'nnnnνтn',
    KeyO: 'ooooοщo',
    KeyP: 'ppppπзp',
    KeyQ: 'qqqa;йq',
    KeyR: 'rrrrρкr',
    KeyS: 'ssssσыs',
    KeyT: 'ttttτеt',
    KeyU: 'uuuuθгu',
    KeyV: 'vvvvωмv',
    KeyW: 'wwwzςцw',
    KeyX: 'xxxxχчx',
    KeyY: 'zyyyυнy',
    KeyZ: 'yzzwζяz',
    Minus: "ß'')---",
    Period: '...:.ю.',
    Quote: "ä´{ù'э'",
    Semicolon: 'öññm´ж;',
    Slash: '---!/./'
  }
};


export class LayoutDetector {
  private _keys: {[index: string]: number} = {};
  private _values: (string | string[])[] = [];
  private _rec: string[] = [];
  private _acc: string[] = Object.keys(MAP.acc);
  private _cand: {layout: string; match: number;}[];
  private _key: IKeyResult;

  constructor() {
    let p = 0;
    for (const key of Object.keys(MAP.map)) {
      this._keys[key] = p++;
      this._values.push(MAP.map[key]);
      this._rec.push('');
    }
    this._cand = [...this._acc].map(e => ({layout: e, match: 0 }));
    this._key = { layouts: ['US_QWERTY'], certain: 0, key: undefined };
  }

  /**
   * Reset detector.
   */
  public reset(): void {
    this._rec = this._rec.map(e => '');
  }

  /**
   * Return list of registered layouts.
   */
  public get layouts(): string[] {
    return Object.keys(MAP.acc);
  }

  /**
   * Return list of supported key codes.
   */
  public get codes(): string[] {
    return Object.keys(MAP.map);
  }

  /**
   * Get character key for key code and layout.
   * The known key codes can be requested with `.codes`,
   * the registered layouts with `.layouts`.
   */
  public getLayoutKey(code: string, layout: string): string | undefined {
    if (MAP.acc[layout] !== undefined && MAP.map[code]) {
      return MAP.map[code][MAP.acc[layout]];
    }
  }

  /**
   * Feed a keyboard event `ev` to the detector.
   */
  public feed(ev: KeyboardEvent): void {
    // FIXME: Should we check for OS? (not supported by Safari)
    if (ev.shiftKey || ev.ctrlKey || ev.altKey || ev.metaKey
      || ev.getModifierState('AltGraph')
      || ev.getModifierState('CapsLock')
    ) {
      return;
    }
    const pos = this._keys[ev.code];
    if (pos !== undefined) {
      if (this._rec[pos] && this._rec[pos] !== ev.key) {
        // The key value should never change for the same layout,
        // so we treat a sudden change as a layout change.
        this.reset();
      }
      this._rec[pos] = ev.key;
    }
  }

  /**
   * Shows all known layouts and their degree of matching mappings
   * sorted descending (likely layouts first).
   * Ideally there is only one leading layout with a match of 1.
   * If the leading match is not 1, then the user uses an
   * unknown or custom layout.
   */
  public matches(): {layout: string; match: number;}[] {
    for (let i = 0; i < this._cand.length; ++i) {
      this._cand[i].match = 0;
    }
    let c = 0;
    for (let k = 0; k < this._rec.length; ++k) {
      const v = this._rec[k];
      if (v) {
        c++;
        const values = this._values[k];
        for (let i = 0; i < this._acc.length; ++i) {
          if (v === values[i]) {
            this._cand[i].match++;
          }
        }
      }
    }
    if (!c) {
      return this._cand;
    }
    const sorted = [...this._cand].sort((a, b) => b.match - a.match);
    for (let i = 0; i < sorted.length; ++i) {
      sorted[i].match /= c;
    }
    return sorted;
  }

  /**
   * Tries to resolve a key code to a key character.
   * If `certain` is 1 then the result matches the listed layouts.
   * Ideally only one layout is returned, then the detector has seen enough
   * key events in `feed`.
   * If multiple layouts are returned but only one key, then the layout is
   * not yet fully determined but the key code is already known from `feed`.
   * When multiple keys are returned, then the character undetermined
   * and the layout needs further resolving with resolve.
   * A certainty lesser than 1 can have different reasons:
   * - not enough key event fed yet (multiple layouts returned)
   * - user has an unknown or custom layout
   * If `certain` is 0 the result should not be used as the dector
   * has not seen any key events at all.
   */
  public getKey(code: string): IKeyResult {
    const lm = this.matches();
    let candidates = [];
    let lastMatch = 0;
    for (let i = 0; i < lm.length; ++i) {
      if (lm[i].match === 0) {
        break;
      }
      if (lm[i].match === 1) {
        lastMatch = 1;
        candidates.push(lm[i].layout);
      } else if (lm[i].match >= lastMatch) {
        lastMatch = lm[i].match;
        candidates.push(lm[i].layout);
      }
    }
    if (candidates.length === 1) {
      this._key.layouts = candidates;
      this._key.certain = lastMatch;
      this._key.key = MAP.map[code]?.[MAP.acc[candidates[0]]];
      return this._key;
    }
    if (!candidates.length) {
      candidates = [...this._acc];
    }
    const values = [];
    for (let i = 0; i < candidates.length; ++i) {
      values.push(MAP.map[code]?.[MAP.acc[candidates[i]]]);
    }
    const valuesSet = new Set(values);
    // if all candidates yield the same char, return it
    if (valuesSet.size === 1) {
      this._key.layouts = candidates;
      this._key.certain = lastMatch;
      const [value] = values;
      this._key.key = value;
      return this._key;
    }
    // fallthrough
    this._key.layouts = candidates;
    this._key.certain = lastMatch / valuesSet.size;
    this._key.key = values;
    return this._key;
  }

  /**
   * Calculate distance to resolve keyboard layout.
   * Returns the candicate layouts and a list of keys resolving layout ambiguity.
   * The key list is sorted descending by candidate differences for a key code
   * (picking a high difference code needs less follow-up steps).
   * The user should be asked to press the corresponding key and the key event
   * should be fed to `feed`.
   * Repeat this process until this method returns only one layout.
   */
  public resolve(): any {
    const lm = this.matches();
    let candidates = [];
    let lastMatch = 0;
    for (let i = 0; i < lm.length; ++i) {
      if (lm[i].match === 0) {
        break;
      }
      if (lm[i].match === 1) {
        lastMatch = 1;
        candidates.push(lm[i].layout);
      } else if (lm[i].match >= lastMatch) {
        lastMatch = lm[i].match;
        candidates.push(lm[i].layout);
      }
    }
    if (candidates.length === 1) {
      return { layouts: candidates, keys: [] };
    }
    if (!candidates.length) {
      candidates = [...this._acc];
    }
    const acc = candidates.map(e => MAP.acc[e]);
    const codes = Object.keys(this._keys);
    const values = [];
    for (let i = 0; i < this._values.length; ++i) {
      const value = new Set();
      for (let k = 0; k < acc.length; ++k) {
        value.add(this._values[i][k]);
      }
      const len = (new Set(value)).size;
      if (len > 1) {
        values.push({code: codes[i], keys: [...value].sort()});
      }
    }
    values.sort((a, b) => b.keys.length - a.keys.length);
    return { layouts: candidates, keys: values };
  }
}
