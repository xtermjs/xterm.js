/**
 * Copyright (c) 2019 The xterm.js authors. All rights reserved.
 * @license MIT
 */
import { assert } from 'chai';
import { MouseService } from 'browser/services/MouseService';
import { MouseStateService } from 'common/services/MouseStateService';
import { CoreMouseAction, CoreMouseButton } from 'common/Types';
import { IBufferService, ICoreService, ILogService, IOptionsService } from 'common/services/Services';
import { MockCoreBrowserService, MockRenderService, MockSelectionService } from 'browser/TestUtils.test';

function toBytes(s: string | undefined): number[] {
  if (!s) {
    return [];
  }
  const res: number[] = [];
  for (let i = 0; i < s.length; ++i) {
    res.push(s.charCodeAt(i));
  }
  return res;
}

// Minimal mocks for deps that MouseService touches in these tests
const bufferService: IBufferService = {
  buffer: { hasScrollback: true } as any,
  cols: 500,
  rows: 500
} as any;

const optionsService: IOptionsService = {
  rawOptions: {
    logLevel: 'info',
    fastScrollSensitivity: 1,
    scrollSensitivity: 1
  }
} as any;

const logService: ILogService = {
  debug: () => {},
  info: () => {},
  warn: () => {},
  error: () => {}
} as any;

describe('MouseService _triggerMouseEvent', () => {
  let mouseService: MouseService;
  let mouseStateService: MouseStateService;
  let coreService: ICoreService;
  let reports: string[];

  beforeEach(() => {
    reports = [];
    mouseStateService = new MouseStateService();
    coreService = {
      triggerDataEvent: (data: string) => reports.push(data),
      triggerBinaryEvent: (data: string) => reports.push(data),
      decPrivateModes: { applicationCursorKeys: false }
    } as any;

    mouseService = new MouseService(
      new MockRenderService(),
      {
        getMouseReportCoords: (_ev: MouseEvent, _el: HTMLElement) => ({ col: 0, row: 0, x: 0, y: 0 })
      } as any,
      mouseStateService,
      coreService,
      bufferService,
      optionsService,
      new MockSelectionService(),
      logService,
      new MockCoreBrowserService()
    );
  });

  function trigger(e: Parameters<any>[0]): boolean {
    return (mouseService as any)._triggerMouseEvent(e);
  }

  it('NONE', () => {
    assert.equal(trigger({ col: 0, row: 0, x: 0, y: 0, button: CoreMouseButton.LEFT, action: CoreMouseAction.DOWN }), false);
    assert.equal(trigger({ col: 0, row: 0, x: 0, y: 0, button: CoreMouseButton.LEFT, action: CoreMouseAction.UP }), false);
    assert.equal(trigger({ col: 0, row: 0, x: 0, y: 0, button: CoreMouseButton.LEFT, action: CoreMouseAction.MOVE }), false);
    assert.equal(trigger({ col: 0, row: 0, x: 0, y: 0, button: CoreMouseButton.MIDDLE, action: CoreMouseAction.DOWN }), false);
    assert.equal(trigger({ col: 0, row: 0, x: 0, y: 0, button: CoreMouseButton.RIGHT, action: CoreMouseAction.DOWN }), false);
    assert.equal(trigger({ col: 0, row: 0, x: 0, y: 0, button: CoreMouseButton.WHEEL, action: CoreMouseAction.UP }), false);
    assert.equal(trigger({ col: 0, row: 0, x: 0, y: 0, button: CoreMouseButton.NONE, action: CoreMouseAction.MOVE }), false);
  });

  it('X10', () => {
    mouseStateService.activeProtocol = 'X10';
    assert.equal(trigger({ col: 0, row: 0, x: 0, y: 0, button: CoreMouseButton.LEFT, action: CoreMouseAction.DOWN }), true);
    assert.equal(trigger({ col: 0, row: 0, x: 0, y: 0, button: CoreMouseButton.LEFT, action: CoreMouseAction.UP }), false);
    assert.equal(trigger({ col: 0, row: 0, x: 0, y: 0, button: CoreMouseButton.LEFT, action: CoreMouseAction.MOVE }), false);
    assert.equal(trigger({ col: 0, row: 0, x: 0, y: 0, button: CoreMouseButton.MIDDLE, action: CoreMouseAction.DOWN }), true);
    assert.equal(trigger({ col: 0, row: 0, x: 0, y: 0, button: CoreMouseButton.RIGHT, action: CoreMouseAction.DOWN }), true);
    assert.equal(trigger({ col: 0, row: 0, x: 0, y: 0, button: CoreMouseButton.WHEEL, action: CoreMouseAction.UP }), false);
    assert.equal(trigger({ col: 0, row: 0, x: 0, y: 0, button: CoreMouseButton.NONE, action: CoreMouseAction.MOVE }), false);
  });

  it('VT200', () => {
    mouseStateService.activeProtocol = 'VT200';
    assert.equal(trigger({ col: 0, row: 0, x: 0, y: 0, button: CoreMouseButton.LEFT, action: CoreMouseAction.DOWN }), true);
    assert.equal(trigger({ col: 0, row: 0, x: 0, y: 0, button: CoreMouseButton.LEFT, action: CoreMouseAction.UP }), true);
    assert.equal(trigger({ col: 0, row: 0, x: 0, y: 0, button: CoreMouseButton.LEFT, action: CoreMouseAction.MOVE }), false);
    assert.equal(trigger({ col: 0, row: 0, x: 0, y: 0, button: CoreMouseButton.MIDDLE, action: CoreMouseAction.DOWN }), true);
    assert.equal(trigger({ col: 0, row: 0, x: 0, y: 0, button: CoreMouseButton.RIGHT, action: CoreMouseAction.DOWN }), true);
    assert.equal(trigger({ col: 0, row: 0, x: 0, y: 0, button: CoreMouseButton.WHEEL, action: CoreMouseAction.UP }), true);
    assert.equal(trigger({ col: 0, row: 0, x: 0, y: 0, button: CoreMouseButton.NONE, action: CoreMouseAction.MOVE }), false);
  });

  it('DRAG', () => {
    mouseStateService.activeProtocol = 'DRAG';
    assert.equal(trigger({ col: 0, row: 0, x: 0, y: 0, button: CoreMouseButton.LEFT, action: CoreMouseAction.DOWN }), true);
    assert.equal(trigger({ col: 0, row: 0, x: 0, y: 0, button: CoreMouseButton.LEFT, action: CoreMouseAction.UP }), true);
    assert.equal(trigger({ col: 0, row: 0, x: 0, y: 0, button: CoreMouseButton.LEFT, action: CoreMouseAction.MOVE }), true);
    assert.equal(trigger({ col: 0, row: 0, x: 0, y: 0, button: CoreMouseButton.MIDDLE, action: CoreMouseAction.DOWN }), true);
    assert.equal(trigger({ col: 0, row: 0, x: 0, y: 0, button: CoreMouseButton.RIGHT, action: CoreMouseAction.DOWN }), true);
    assert.equal(trigger({ col: 0, row: 0, x: 0, y: 0, button: CoreMouseButton.WHEEL, action: CoreMouseAction.UP }), true);
  });

  it('ANY', () => {
    mouseStateService.activeProtocol = 'ANY';
    assert.equal(trigger({ col: 0, row: 0, x: 0, y: 0, button: CoreMouseButton.LEFT, action: CoreMouseAction.DOWN }), true);
    assert.equal(trigger({ col: 0, row: 0, x: 0, y: 0, button: CoreMouseButton.LEFT, action: CoreMouseAction.UP }), true);
    assert.equal(trigger({ col: 0, row: 0, x: 0, y: 0, button: CoreMouseButton.LEFT, action: CoreMouseAction.MOVE }), true);
    assert.equal(trigger({ col: 0, row: 0, x: 0, y: 0, button: CoreMouseButton.MIDDLE, action: CoreMouseAction.DOWN }), true);
    assert.equal(trigger({ col: 0, row: 0, x: 0, y: 0, button: CoreMouseButton.RIGHT, action: CoreMouseAction.DOWN }), true);
    assert.equal(trigger({ col: 0, row: 0, x: 0, y: 0, button: CoreMouseButton.WHEEL, action: CoreMouseAction.UP }), true);
    assert.equal(trigger({ col: 0, row: 0, x: 0, y: 0, button: CoreMouseButton.NONE, action: CoreMouseAction.MOVE }), true);
    // should not report in any case
    // invalid button + action combinations
    assert.equal(trigger({ col: 0, row: 0, x: 0, y: 0, button: CoreMouseButton.WHEEL, action: CoreMouseAction.MOVE }), false);
    assert.equal(trigger({ col: 0, row: 0, x: 0, y: 0, button: CoreMouseButton.NONE, action: CoreMouseAction.DOWN }), false);
    assert.equal(trigger({ col: 0, row: 0, x: 0, y: 0, button: CoreMouseButton.NONE, action: CoreMouseAction.UP }), false);
    // invalid coords
    assert.equal(trigger({ col: -1, row: 0, x: 0, y: 0, button: CoreMouseButton.LEFT, action: CoreMouseAction.DOWN }), false);
    assert.equal(trigger({ col: 500, row: 0, x: 0, y: 0, button: CoreMouseButton.LEFT, action: CoreMouseAction.DOWN }), false);
    assert.equal(trigger({ col: 0, row: -1, x: 0, y: 0, button: CoreMouseButton.LEFT, action: CoreMouseAction.DOWN }), false);
    assert.equal(trigger({ col: 0, row: 500, x: 0, y: 0, button: CoreMouseButton.LEFT, action: CoreMouseAction.DOWN }), false);
  });

  describe('coords', () => {
    it('DEFAULT encoding', () => {
      mouseStateService.activeProtocol = 'ANY';
      for (let i = 0; i < bufferService.cols; ++i) {
        assert.equal(trigger({ col: i, row: 0, x: 0, y: 0, button: CoreMouseButton.LEFT, action: CoreMouseAction.DOWN }), true);
        if (i > 222) {
          // supress mouse reports if we are out of addressible range (max. 222)
          assert.deepEqual(toBytes(reports.pop()), []);
        } else {
          assert.deepEqual(toBytes(reports.pop()), [0x1b, 0x5b, 0x4d, 0x20, i + 33, 0x21]);
        }
      }
    });

    it('SGR encoding', () => {
      mouseStateService.activeProtocol = 'ANY';
      mouseStateService.activeEncoding = 'SGR';
      for (let i = 0; i < bufferService.cols; ++i) {
        assert.equal(trigger({ col: i, row: 0, x: 0, y: 0, button: CoreMouseButton.LEFT, action: CoreMouseAction.DOWN }), true);
        assert.deepEqual(reports.pop(), `\x1b[<0;${i + 1};1M`);
      }
    });

    it('SGR_PIXELS encoding', () => {
      mouseStateService.activeProtocol = 'ANY';
      mouseStateService.activeEncoding = 'SGR_PIXELS';
      for (let i = 0; i < 500; ++i) {
        assert.equal(trigger({ col: 0, row: 0, x: i, y: 0, button: CoreMouseButton.LEFT, action: CoreMouseAction.DOWN }), true);
        assert.deepEqual(reports.pop(), `\x1b[<0;${i};0M`);
      }
    });
  });

  it('eventCodes with modifiers (DEFAULT encoding)', () => {
    // TODO: implement AUX button tests
    mouseStateService.activeProtocol = 'ANY';
    mouseStateService.activeEncoding = 'DEFAULT';
    // all buttons + down + no modifer
    assert.equal(trigger({ col: 0, row: 0, x: 0, y: 0, button: CoreMouseButton.LEFT, action: CoreMouseAction.DOWN, ctrl: false, alt: false, shift: false }), true);
    assert.equal(trigger({ col: 0, row: 0, x: 0, y: 0, button: CoreMouseButton.MIDDLE, action: CoreMouseAction.DOWN, ctrl: false, alt: false, shift: false }), true);
    assert.equal(trigger({ col: 0, row: 0, x: 0, y: 0, button: CoreMouseButton.RIGHT, action: CoreMouseAction.DOWN, ctrl: false, alt: false, shift: false }), true);
    assert.equal(trigger({ col: 0, row: 0, x: 0, y: 0, button: CoreMouseButton.WHEEL, action: CoreMouseAction.DOWN, ctrl: false, alt: false, shift: false }), true);
    assert.deepEqual(reports, ['\x1b[M !!', '\x1b[M!!!', '\x1b[M"!!', '\x1b[Ma!!']);
    reports = [];

    // all buttons + up + no modifier
    assert.equal(trigger({ col: 0, row: 0, x: 0, y: 0, button: CoreMouseButton.LEFT, action: CoreMouseAction.UP, ctrl: false, alt: false, shift: false }), true);
    assert.equal(trigger({ col: 0, row: 0, x: 0, y: 0, button: CoreMouseButton.MIDDLE, action: CoreMouseAction.UP, ctrl: false, alt: false, shift: false }), true);
    assert.equal(trigger({ col: 0, row: 0, x: 0, y: 0, button: CoreMouseButton.RIGHT, action: CoreMouseAction.UP, ctrl: false, alt: false, shift: false }), true);
    assert.equal(trigger({ col: 0, row: 0, x: 0, y: 0, button: CoreMouseButton.WHEEL, action: CoreMouseAction.UP, ctrl: false, alt: false, shift: false }), true);
    assert.deepEqual(reports, ['\x1b[M#!!', '\x1b[M#!!', '\x1b[M#!!', '\x1b[M`!!']);
    reports = [];

    // all buttons + move + no modifier
    assert.equal(trigger({ col: 0, row: 0, x: 0, y: 0, button: CoreMouseButton.LEFT, action: CoreMouseAction.MOVE, ctrl: false, alt: false, shift: false }), true);
    assert.equal(trigger({ col: 0, row: 0, x: 0, y: 0, button: CoreMouseButton.MIDDLE, action: CoreMouseAction.MOVE, ctrl: false, alt: false, shift: false }), true);
    assert.equal(trigger({ col: 0, row: 0, x: 0, y: 0, button: CoreMouseButton.RIGHT, action: CoreMouseAction.MOVE, ctrl: false, alt: false, shift: false }), true);
    assert.equal(trigger({ col: 0, row: 0, x: 0, y: 0, button: CoreMouseButton.NONE, action: CoreMouseAction.MOVE, ctrl: false, alt: false, shift: false }), true);
    assert.deepEqual(reports, ['\x1b[M@!!', '\x1b[MA!!', '\x1b[MB!!', '\x1b[MC!!']);
    reports = [];

    // button none + move + modifiers
    assert.equal(trigger({ col: 0, row: 0, x: 0, y: 0, button: CoreMouseButton.NONE, action: CoreMouseAction.MOVE, ctrl: true, alt: false, shift: false }), true);
    assert.equal(trigger({ col: 0, row: 0, x: 0, y: 0, button: CoreMouseButton.NONE, action: CoreMouseAction.MOVE, ctrl: false, alt: true, shift: false }), true);
    assert.equal(trigger({ col: 0, row: 0, x: 0, y: 0, button: CoreMouseButton.NONE, action: CoreMouseAction.MOVE, ctrl: false, alt: false, shift: true }), true);
    assert.equal(trigger({ col: 0, row: 0, x: 0, y: 0, button: CoreMouseButton.NONE, action: CoreMouseAction.MOVE, ctrl: true, alt: true, shift: false }), true);
    assert.equal(trigger({ col: 0, row: 0, x: 0, y: 0, button: CoreMouseButton.NONE, action: CoreMouseAction.MOVE, ctrl: false, alt: true, shift: true }), true);
    assert.equal(trigger({ col: 0, row: 0, x: 0, y: 0, button: CoreMouseButton.NONE, action: CoreMouseAction.MOVE, ctrl: true, alt: true, shift: true }), true);
    assert.deepEqual(reports, ['\x1b[MS!!', '\x1b[MK!!', '\x1b[MG!!', '\x1b[M[!!', '\x1b[MO!!', '\x1b[M_!!']);
    reports = [];
  });
});
