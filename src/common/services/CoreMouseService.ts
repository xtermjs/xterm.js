/**
 * Copyright (c) 2019 The xterm.js authors. All rights reserved.
 * @license MIT
 */
import { IBufferService, ICoreService, ICoreMouseService } from 'common/services/Services';
import { EventEmitter, IEvent } from 'common/EventEmitter';
import { ICoreMouseProtocol, ICoreMouseEvent, CoreMouseEncoding, CoreMouseEventType } from 'common/Types';

/**
 * Supported default protocols.
 */
const DEFAULT_PROCOTOLS: {[key: string]: ICoreMouseProtocol} = {
  /**
   * NONE
   * Events: none
   * Modifiers: none
   */
  NONE: {
    events: [],
    restrict: () => false
  },
  /**
   * X10
   * Events: mousedown
   * Modifiers: none (TBD)
   */
  X10: {
    events: ['mousedown'],
    restrict: (e: ICoreMouseEvent) => {
      // no wheel (TBD), no move, no up
      if (e.button === 'wheel' || e.action !== 'down') {
        return false;
      }
      // no modifiers (TDB)
      e.ctrl = false;
      e.alt = false;
      e.shift = false;
      return true;
    }
  },
  /**
   * VT200
   * Events: mousedown / mouseup / wheel
   * Modifiers: CTRL (TBD)
   */
  VT200: {
    events: ['mousedown', 'mouseup', 'wheel'],
    restrict: (e: ICoreMouseEvent) => {
      // no move
      if (e.action === 'move') {
        return false;
      }
      // modifiers - only ctrl?
      e.alt = false;
      e.shift = false;
      return true;
    }
  },
  /**
   * DRAG
   * Events: mousedown / mouseup / wheel / mousedrag
   * Modifiers: CTRL | ALT | SHIFT
   */
  DRAG: {
    events: ['mousedown', 'mouseup', 'wheel', 'mousedrag'],
    restrict: (e: ICoreMouseEvent) => {
      // no move without button
      if (e.action === 'move' && e.button === 'none') {
        return false;
      }
      // modifiers unclear - let all pass for now
      return true;
    }
  },
  /**
   * ANY
   * Events: all mouse related events
   * Modifiers: CTRL | ALT | SHIFT
   */
  ANY: {
    events: ['mousedown', 'mouseup', 'wheel', 'mousemove'],
    restrict: (e: ICoreMouseEvent) => true
  }
};

/**
 * Mapping of buttons and actions to event codes. (taken from xterm spec)
 * More than 3 buttons are not supported.
 */
enum CODEMAP {
  // buttons
  left = 0,
  middle = 1,
  right = 2,
  none = 3,
  wheel = 64,
  // actions
  up = 0,
  down = 1,
  move = 32,
  // modifiers
  shift = 4,
  alt = 8,
  ctrl = 16
}

// helper for default encoders to generate the event code.
function eventCode(e: ICoreMouseEvent, isSGR: boolean): number {
  const button = CODEMAP[e.button];
  const action = CODEMAP[e.action];
  const modifier = (e.ctrl ? CODEMAP.ctrl : 0) | (e.shift ? CODEMAP.shift : 0) | (e.alt ? CODEMAP.alt : 0);
  let code = button | modifier;
  if (e.button === 'wheel') {
    code |= action;
  } else {
    if (e.action === 'move') {
      code |= CODEMAP.move;
    } else if (e.action === 'up' && !isSGR) {
      // special case - only SGR can report button on release
      // all others have to go with NONE
      code |= CODEMAP.none;
    }
  }
  return code;
}

const S = String.fromCharCode;

/**
 * Supported default encodings.
 */
const DEFAULT_ENCODINGS: {[key: string]: CoreMouseEncoding} = {
  /**
   * DEFAULT - CSI M Pb Px Py
   * Single byte encoding for coords and event code.
   * Can encode values up to 223. The Encoding of higher
   * values is not UTF-8 compatible (and currently limited
   * to 95 in xterm.js).
   */
  DEFAULT: (e: ICoreMouseEvent) => {
    let params = [eventCode(e, false) + 32, e.col + 32, e.row + 32];
    // FIXME: we are currently limited to ASCII range
    params = params.map(v => (v > 127) ? 127 : v);
    // FIXED: params = params.map(v => (v > 255) ? 0 : value);
    return `\x1b[M${S(params[0])}${S(params[1])}${S(params[2])}`;
  },
  /**
   * UTF8 - CSI M Pb Px Py
   * Same as DEFAULT, but with optional 2-byte UTF8
   * encoding for values > 223 (can encode up to 2015).
   */
  UTF8: (e: ICoreMouseEvent) => {
    let params = [eventCode(e, false) + 32, e.col + 32, e.row + 32];
    // limit to 2-byte UTF8
    params = params.map(v => (v > 2047) ? 0 : v);
    return `\x1b[M${S(params[0])}${S(params[1])}${S(params[2])}`;
  },
  /**
   * SGR - CSI < Pb ; Px ; Py M|m
   * No encoding limitation.
   * Can report button on release and works with a well formed sequence.
   */
  SGR: (e: ICoreMouseEvent) => {
    const final = (e.action === 'up' && e.button !== 'wheel') ? 'm' : 'M';
    return `\x1b[<${eventCode(e, true)};${e.col};${e.row}${final}`;
  },
  /**
   * URXVT - CSI Pb ; Px ; Py M
   * Same button encoding as default, decimal encoding for coords.
   * Ambiguity with other sequences, should not be used.
   */
  URXVT: (e: ICoreMouseEvent) => {
    return `\x1b[${eventCode(e, false) + 32};${e.col};${e.row}M`;
  }
};

/**
 * CoreMouseService
 *
 * Provides mouse tracking reports with different protocols and encodings.
 *  - protocols: NONE (default), X10, VT200, DRAG, ANY
 *  - encodings: DEFAULT, SGR, UTF8, URXVT
 *
 * Custom protocols/encodings can be added by `addProtocol` / `addEncoding`.
 * To activate a protocol/encoding, set `activeProtocol` / `activeEncoding`.
 * Switching a protocol will send a notification event `onProtocolChange`
 * with a list of needed events to track.
 *
 * The service handles the mouse tracking state and decides whether to send
 * a tracking report to the backend based on protocol and encoding limitations.
 * To send a mouse event call `triggerMouseEvent`.
 */
export class CoreMouseService implements ICoreMouseService {
  private _protocols: {[name: string]: ICoreMouseProtocol} = {};
  private _encodings: {[name: string]: CoreMouseEncoding} = {};
  private _activeProtocol: string = '';
  private _activeEncoding: string = '';
  private _onProtocolChange = new EventEmitter<CoreMouseEventType[]>();
  private _lastEvent: ICoreMouseEvent | null = null;

  constructor(
    @IBufferService private readonly _bufferService: IBufferService,
    @ICoreService private readonly _coreService: ICoreService
  ) {
    // register default protocols and encodings
    Object.keys(DEFAULT_PROCOTOLS).forEach(name => this.addProtocol(name, DEFAULT_PROCOTOLS[name]));
    Object.keys(DEFAULT_ENCODINGS).forEach(name => this.addEncoding(name, DEFAULT_ENCODINGS[name]));
    // call reset to set defaults
    this.reset();
  }

  public addProtocol(name: string, protocol: ICoreMouseProtocol): void {
    this._protocols[name] = protocol;
  }

  public addEncoding(name: string, encoding: CoreMouseEncoding): void {
    this._encodings[name] = encoding;
  }

  public get activeProtocol(): string {
    return this._activeProtocol;
  }

  public set activeProtocol(name: string) {
    if (!this._protocols[name]) {
      throw new Error(`unknown protocol "${name}"`);
    }
    this._activeProtocol = name;
    this._onProtocolChange.fire(this._protocols[name].events);
  }

  public get activeEncoding(): string {
    return this._activeEncoding;
  }

  public set activeEncoding(name: string) {
    if (!this._encodings[name]) {
      throw new Error(`unknown encoding "${name}"`);
    }
    this._activeEncoding = name;
  }

  public reset(): void {
    this.activeProtocol = 'NONE';
    this.activeEncoding = 'DEFAULT';
    this._lastEvent = null;
  }

  /**
   * Event to announce changes in mouse tracking.
   */
  public get onProtocolChange(): IEvent<CoreMouseEventType[]> {
    return this._onProtocolChange.event;
  }

  /**
   * Triggers a mouse event to be sent.
   *
   * Returns true if the event passed all protocol restrictions and a report
   * was sent, otherwise false. The return value may be used to decide whether
   * the default event action in the bowser component should be omitted.
   *
   * Note: The method will change values of the given event object
   * to fullfill protocol and encoding restrictions.
   */
  public triggerMouseEvent(event: ICoreMouseEvent): boolean {
    // range check for col/row
    if (event.col < 0 || event.col >= this._bufferService.cols
        || event.row < 0 || event.row >= this._bufferService.rows) {
      return false;
    }

    // filter nonsense combinations of button + action
    if (event.button === 'wheel' && event.action === 'move') {
      return false;
    }
    if (event.button === 'none' && event.action !== 'move') {
      return false;
    }

    // report 1-based coords
    event.col++;
    event.row++;

    // debounce move at grid level
    if (event.action === 'move' && this._lastEvent && this._compareEvents(this._lastEvent, event)) {
      return false;
    }

    // apply protocol restrictions
    if (!this._protocols[this._activeProtocol].restrict(event)) {
      return false;
    }

    // encode report and send
    const report = this._encodings[this._activeEncoding](event);
    this._coreService.triggerDataEvent(report, true);

    this._lastEvent = event;

    return true;
  }

  private _compareEvents(e1: ICoreMouseEvent, e2: ICoreMouseEvent): boolean {
    if (e1.col !== e2.col) return false;
    if (e1.row !== e2.row) return false;
    if (e1.button !== e2.button) return false;
    if (e1.action !== e2.action) return false;
    if (e1.ctrl !== e2.ctrl) return false;
    if (e1.alt !== e2.alt) return false;
    if (e1.shift !== e2.shift) return false;
    return true;
  }
}
