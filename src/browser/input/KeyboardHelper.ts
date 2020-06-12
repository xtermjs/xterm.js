/**
 * Copyright (c) 2020 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import { ICoreService } from 'common/services/Services';

// non printable keys that never trigger an input event
// these keys only trigger down/up events, repeated only trigger multiple down events
const NON_PRINTABLE = [
  // code
  'Escape',
  'F1',
  'F2',
  'F3',
  'F4',
  'F5',
  'F6',
  'F7',
  'F8',
  'F9',
  'F10',
  'F11',
  'F12',        // some browsers/platforms support up to F24
  'Insert',
  'Delete',     // note: produces input if there is content in the element ({inputType: 'deleteContentForward', data: null})
  'PageUp',
  'PageDown',
  'Home',
  'End',
  'Backspace',  // note: produces input if there is content in the element ({inputType: 'deleteContentBackward', data: null})
  'NumLock',
  'Tab',
  'Enter',
  'ShiftLeft',
  'ShiftRight',
  'ControlLeft',
  'MetaLeft',     // windows key under chrome
  'OSLeft',       // windows key under firefox
  'AltLeft',
  'AltRight',     // key: AltGraph
  'ControlRight',
  'ArrowUp',
  'ArrowRight',
  'ArrowDown',
  'ArrowLeft'
]

const TERM_RELEVANT = [
  'Escape',
  'F1',
  'F2',
  'F3',
  'F4',
  'F5',
  'F6',
  'F7',
  'F8',
  'F9',
  'F10',
  'F11',
  'F12',
  'Insert',
  'Delete',
  'PageUp',
  'PageDown',
  'Home',
  'End',
  'Backspace',
  'NumLock',
  'Tab',
  'Enter',
  'ArrowUp',
  'ArrowRight',
  'ArrowDown',
  'ArrowLeft'
]

// dead keys - is this layout specific?
// dead keys trigger input on second press or a decorated char by following key
const OPTIONAL_INPUT = [
  // [key, code]
  ['Dead', 'Backquote'],
  ['Dead', 'Equal'],
]

// KeyboardEvent.getModifierState()
const MODIFIERS = [
  'Alt',
  'AltGraph',
  'CapsLock',
  'Control',
  //'Fn',         // on android FUNCTION key, else unsupported
  //'FnLock',     // unsupported
  //'Hyper',      // unsupported
  'Meta',         // META in GTK (remappable), COMMAND in OSX, windows unsupported
  'NumLock',      // NumLock LED is on, every number key on numpad (OSX)
  'OS',           // WINDOWS key, not supported on OSX
  'ScrollLock',   // ScrollLock LED is on, not supported on Linux and OSX
  'Shift',        // while SHIFT is pressed
  //'Super',      // unsupported
  //'Symbol',     // unsupported
  //'SymbolLock', // unsupported
]

// mapped modifiers on KeyboardEvent
const MODIFIERS_MAPPED = [
  'altKey',       // ALT or OPTION pressed
  'ctrlKey',      // CONTROL pressed
  'metaKey',      // META pressed - COMMAND on OSX keyboards, WINDOWS on PC keyboards
  'shiftKey'      // SHIFT pressed
]

export class KeyboardHelper {

  constructor(
    @ICoreService private readonly _coreService: ICoreService
  ) {}

  private _logPrintable(ev: InputEvent) {
    console.log('PRINTABLE:', [ev.data]);
  }
  private _logNonPrintable(ev: KeyboardEvent) {
    console.log('NON-PRINTABLE:', {key: ev.key, alt: ev.altKey, ctrl: ev.ctrlKey, meta: ev.metaKey, shift: ev.shiftKey});
  }

  public down(ev: KeyboardEvent): boolean {
    //console.log('down', ev);
    if (NON_PRINTABLE.indexOf(ev.code) !== -1 || NON_PRINTABLE.indexOf(ev.key) !== -1) {
      if (TERM_RELEVANT.indexOf(ev.code) !== -1 || TERM_RELEVANT.indexOf(ev.key) !== -1) {
        this._logNonPrintable(ev);
      }
      this._cancel(ev);
    } else if (ev.altKey || ev.ctrlKey || ev.metaKey) {
      this._logNonPrintable(ev);
      this._cancel(ev);
    }
    return true;
  }
  public up(ev: KeyboardEvent): boolean {
    console.log('up', ev);
    return true;
  }
  public input(ev: InputEvent): boolean {
    if (ev.data) {
      this._logPrintable(ev);
      this._cancel(ev);
    }
    return true;
  }

  public _cancel(ev: Event): boolean | undefined {
    ev.preventDefault();
    ev.stopPropagation();
    return false;
  }
}
