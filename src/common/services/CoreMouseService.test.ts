/**
 * Copyright (c) 2019 The xterm.js authors. All rights reserved.
 * @license MIT
 */
import { CoreMouseService } from 'common/services/CoreMouseService';
import { MockCoreService, MockBufferService } from 'common/TestUtils.test';
import { assert } from 'chai';
import { ICoreMouseEvent, CoreMouseEventType, CoreMouseButton, CoreMouseAction } from 'common/Types';

// needed mock services
const bufferService = new MockBufferService(300, 100);
const coreService = new MockCoreService();

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

describe('CoreMouseService', () => {
  it('init', () => {
    const cms = new CoreMouseService(bufferService, coreService);
    assert.equal(cms.activeEncoding, 'DEFAULT');
    assert.equal(cms.activeProtocol, 'NONE');
  });
  it('default protocols - NONE, X10, VT200, DRAG, ANY', () => {
    const cms = new CoreMouseService(bufferService, coreService);
    assert.deepEqual(Object.keys((cms as any)._protocols), ['NONE', 'X10', 'VT200', 'DRAG', 'ANY']);
  });
  it('default encodings - DEFAULT, SGR', () => {
    const cms = new CoreMouseService(bufferService, coreService);
    assert.deepEqual(Object.keys((cms as any)._encodings), ['DEFAULT', 'SGR', 'SGR_PIXELS']);
  });
  it('protocol/encoding setter, reset', () => {
    const cms = new CoreMouseService(bufferService, coreService);
    cms.activeEncoding = 'SGR';
    cms.activeProtocol = 'ANY';
    assert.equal(cms.activeEncoding, 'SGR');
    assert.equal(cms.activeProtocol, 'ANY');
    cms.reset();
    assert.equal(cms.activeEncoding, 'DEFAULT');
    assert.equal(cms.activeProtocol, 'NONE');
    assert.throws(() => { cms.activeEncoding = 'xyz'; }, 'unknown encoding "xyz"');
    assert.throws(() => { cms.activeProtocol = 'xyz'; }, 'unknown protocol "xyz"');
  });
  it('addEncoding', () => {
    const cms = new CoreMouseService(bufferService, coreService);
    cms.addEncoding('XYZ', (e: ICoreMouseEvent) => '');
    cms.activeEncoding = 'XYZ';
    assert.equal(cms.activeEncoding, 'XYZ');
  });
  it('addProtocol', () => {
    const cms = new CoreMouseService(bufferService, coreService);
    cms.addProtocol('XYZ', { events: CoreMouseEventType.NONE, restrict: (e: ICoreMouseEvent) => false });
    cms.activeProtocol = 'XYZ';
    assert.equal(cms.activeProtocol, 'XYZ');
  });
  it('onProtocolChange', () => {
    const cms = new CoreMouseService(bufferService, coreService);
    const wantedEvents: CoreMouseEventType[] = [];
    cms.onProtocolChange(events => wantedEvents.push(events));
    cms.activeProtocol = 'NONE';
    assert.deepEqual(wantedEvents, [CoreMouseEventType.NONE]);
    cms.activeProtocol = 'ANY';
    assert.deepEqual(wantedEvents, [
      CoreMouseEventType.NONE,
      CoreMouseEventType.DOWN | CoreMouseEventType.UP | CoreMouseEventType.WHEEL | CoreMouseEventType.DRAG | CoreMouseEventType.MOVE
    ]);
  });
  describe('triggerMouseEvent', () => {
    let cms: CoreMouseService;
    let reports: string[];
    beforeEach(() => {
      cms = new CoreMouseService(bufferService, coreService);
      reports = [];
      coreService.triggerDataEvent = (data: string, userInput?: boolean) => reports.push(data);
      coreService.triggerBinaryEvent = (data: string) => reports.push(data);
    });
    it('NONE', () => {
      assert.equal(cms.triggerMouseEvent({ col: 0, row: 0, x: 0, y: 0, button: CoreMouseButton.LEFT, action: CoreMouseAction.DOWN }), false);
      assert.equal(cms.triggerMouseEvent({ col: 0, row: 0, x: 0, y: 0, button: CoreMouseButton.LEFT, action: CoreMouseAction.UP }), false);
      assert.equal(cms.triggerMouseEvent({ col: 0, row: 0, x: 0, y: 0, button: CoreMouseButton.LEFT, action: CoreMouseAction.MOVE }), false);
      assert.equal(cms.triggerMouseEvent({ col: 0, row: 0, x: 0, y: 0, button: CoreMouseButton.MIDDLE, action: CoreMouseAction.DOWN }), false);
      assert.equal(cms.triggerMouseEvent({ col: 0, row: 0, x: 0, y: 0, button: CoreMouseButton.RIGHT, action: CoreMouseAction.DOWN }), false);
      assert.equal(cms.triggerMouseEvent({ col: 0, row: 0, x: 0, y: 0, button: CoreMouseButton.WHEEL, action: CoreMouseAction.UP }), false);
      assert.equal(cms.triggerMouseEvent({ col: 0, row: 0, x: 0, y: 0, button: CoreMouseButton.NONE, action: CoreMouseAction.MOVE }), false);
    });
    it('X10', () => {
      cms.activeProtocol = 'X10';
      assert.equal(cms.triggerMouseEvent({ col: 0, row: 0, x: 0, y: 0, button: CoreMouseButton.LEFT, action: CoreMouseAction.DOWN }), true);
      assert.equal(cms.triggerMouseEvent({ col: 0, row: 0, x: 0, y: 0, button: CoreMouseButton.LEFT, action: CoreMouseAction.UP }), false);
      assert.equal(cms.triggerMouseEvent({ col: 0, row: 0, x: 0, y: 0, button: CoreMouseButton.LEFT, action: CoreMouseAction.MOVE }), false);
      assert.equal(cms.triggerMouseEvent({ col: 0, row: 0, x: 0, y: 0, button: CoreMouseButton.MIDDLE, action: CoreMouseAction.DOWN }), true);
      assert.equal(cms.triggerMouseEvent({ col: 0, row: 0, x: 0, y: 0, button: CoreMouseButton.RIGHT, action: CoreMouseAction.DOWN }), true);
      assert.equal(cms.triggerMouseEvent({ col: 0, row: 0, x: 0, y: 0, button: CoreMouseButton.WHEEL, action: CoreMouseAction.UP }), false);
      assert.equal(cms.triggerMouseEvent({ col: 0, row: 0, x: 0, y: 0, button: CoreMouseButton.NONE, action: CoreMouseAction.MOVE }), false);
    });
    it('VT200', () => {
      cms.activeProtocol = 'VT200';
      assert.equal(cms.triggerMouseEvent({ col: 0, row: 0, x: 0, y: 0, button: CoreMouseButton.LEFT, action: CoreMouseAction.DOWN }), true);
      assert.equal(cms.triggerMouseEvent({ col: 0, row: 0, x: 0, y: 0, button: CoreMouseButton.LEFT, action: CoreMouseAction.UP }), true);
      assert.equal(cms.triggerMouseEvent({ col: 0, row: 0, x: 0, y: 0, button: CoreMouseButton.LEFT, action: CoreMouseAction.MOVE }), false);
      assert.equal(cms.triggerMouseEvent({ col: 0, row: 0, x: 0, y: 0, button: CoreMouseButton.MIDDLE, action: CoreMouseAction.DOWN }), true);
      assert.equal(cms.triggerMouseEvent({ col: 0, row: 0, x: 0, y: 0, button: CoreMouseButton.RIGHT, action: CoreMouseAction.DOWN }), true);
      assert.equal(cms.triggerMouseEvent({ col: 0, row: 0, x: 0, y: 0, button: CoreMouseButton.WHEEL, action: CoreMouseAction.UP }), true);
      assert.equal(cms.triggerMouseEvent({ col: 0, row: 0, x: 0, y: 0, button: CoreMouseButton.NONE, action: CoreMouseAction.MOVE }), false);
    });
    it('DRAG', () => {
      cms.activeProtocol = 'DRAG';
      assert.equal(cms.triggerMouseEvent({ col: 0, row: 0, x: 0, y: 0, button: CoreMouseButton.LEFT, action: CoreMouseAction.DOWN }), true);
      assert.equal(cms.triggerMouseEvent({ col: 0, row: 0, x: 0, y: 0, button: CoreMouseButton.LEFT, action: CoreMouseAction.UP }), true);
      assert.equal(cms.triggerMouseEvent({ col: 0, row: 0, x: 0, y: 0, button: CoreMouseButton.LEFT, action: CoreMouseAction.MOVE }), true);
      assert.equal(cms.triggerMouseEvent({ col: 0, row: 0, x: 0, y: 0, button: CoreMouseButton.MIDDLE, action: CoreMouseAction.DOWN }), true);
      assert.equal(cms.triggerMouseEvent({ col: 0, row: 0, x: 0, y: 0, button: CoreMouseButton.RIGHT, action: CoreMouseAction.DOWN }), true);
      assert.equal(cms.triggerMouseEvent({ col: 0, row: 0, x: 0, y: 0, button: CoreMouseButton.WHEEL, action: CoreMouseAction.UP }), true);
    });
    it('ANY', () => {
      cms.activeProtocol = 'ANY';
      assert.equal(cms.triggerMouseEvent({ col: 0, row: 0, x: 0, y: 0, button: CoreMouseButton.LEFT, action: CoreMouseAction.DOWN }), true);
      assert.equal(cms.triggerMouseEvent({ col: 0, row: 0, x: 0, y: 0, button: CoreMouseButton.LEFT, action: CoreMouseAction.UP }), true);
      assert.equal(cms.triggerMouseEvent({ col: 0, row: 0, x: 0, y: 0, button: CoreMouseButton.LEFT, action: CoreMouseAction.MOVE }), true);
      assert.equal(cms.triggerMouseEvent({ col: 0, row: 0, x: 0, y: 0, button: CoreMouseButton.MIDDLE, action: CoreMouseAction.DOWN }), true);
      assert.equal(cms.triggerMouseEvent({ col: 0, row: 0, x: 0, y: 0, button: CoreMouseButton.RIGHT, action: CoreMouseAction.DOWN }), true);
      assert.equal(cms.triggerMouseEvent({ col: 0, row: 0, x: 0, y: 0, button: CoreMouseButton.WHEEL, action: CoreMouseAction.UP }), true);
      assert.equal(cms.triggerMouseEvent({ col: 0, row: 0, x: 0, y: 0, button: CoreMouseButton.NONE, action: CoreMouseAction.MOVE }), true);
      // should not report in any case
      // invalid button + action combinations
      assert.equal(cms.triggerMouseEvent({ col: 0, row: 0, x: 0, y: 0, button: CoreMouseButton.WHEEL, action: CoreMouseAction.MOVE }), false);
      assert.equal(cms.triggerMouseEvent({ col: 0, row: 0, x: 0, y: 0, button: CoreMouseButton.NONE, action: CoreMouseAction.DOWN }), false);
      assert.equal(cms.triggerMouseEvent({ col: 0, row: 0, x: 0, y: 0, button: CoreMouseButton.NONE, action: CoreMouseAction.UP }), false);
      // invalid coords
      assert.equal(cms.triggerMouseEvent({ col: -1, row: 0, x: 0, y: 0, button: CoreMouseButton.LEFT, action: CoreMouseAction.DOWN }), false);
      assert.equal(cms.triggerMouseEvent({ col: 500, row: 0, x: 0, y: 0, button: CoreMouseButton.LEFT, action: CoreMouseAction.DOWN }), false);
      assert.equal(cms.triggerMouseEvent({ col: 0, row: -1, x: 0, y: 0, button: CoreMouseButton.LEFT, action: CoreMouseAction.DOWN }), false);
      assert.equal(cms.triggerMouseEvent({ col: 0, row: 500, x: 0, y: 0, button: CoreMouseButton.LEFT, action: CoreMouseAction.DOWN }), false);
    });
    describe('coords', () => {
      it('DEFAULT encoding', () => {
        cms.activeProtocol = 'ANY';
        for (let i = 0; i < bufferService.cols; ++i) {
          assert.equal(cms.triggerMouseEvent({ col: i, row: 0, x: 0, y: 0, button: CoreMouseButton.LEFT, action: CoreMouseAction.DOWN }), true);
          if (i > 222) {
            // supress mouse reports if we are out of addressible range (max. 222)
            assert.deepEqual(toBytes(reports.pop()), []);
          } else {
            assert.deepEqual(toBytes(reports.pop()), [0x1b, 0x5b, 0x4d, 0x20, i + 33, 0x21]);
          }
        }
      });
      it('SGR encoding', () => {
        cms.activeProtocol = 'ANY';
        cms.activeEncoding = 'SGR';
        for (let i = 0; i < bufferService.cols; ++i) {
          assert.equal(cms.triggerMouseEvent({ col: i, row: 0, x: 0, y: 0, button: CoreMouseButton.LEFT, action: CoreMouseAction.DOWN }), true);
          assert.deepEqual(reports.pop(), `\x1b[<0;${i + 1};1M`);
        }
      });
      it('SGR_PIXELS encoding', () => {
        cms.activeProtocol = 'ANY';
        cms.activeEncoding = 'SGR_PIXELS';
        for (let i = 0; i < 500; ++i) {
          assert.equal(cms.triggerMouseEvent({ col: 0, row: 0, x: i, y: 0, button: CoreMouseButton.LEFT, action: CoreMouseAction.DOWN }), true);
          assert.deepEqual(reports.pop(), `\x1b[<0;${i};0M`);
        }
      });
    });
    it('eventCodes with modifiers (DEFAULT encoding)', () => {
      // TODO: implement AUX button tests
      cms.activeProtocol = 'ANY';
      cms.activeEncoding = 'DEFAULT';
      // all buttons + down + no modifer
      assert.equal(cms.triggerMouseEvent({ col: 0, row: 0, x: 0, y: 0, button: CoreMouseButton.LEFT, action: CoreMouseAction.DOWN, ctrl: false, alt: false, shift: false }), true);
      assert.equal(cms.triggerMouseEvent({ col: 0, row: 0, x: 0, y: 0, button: CoreMouseButton.MIDDLE, action: CoreMouseAction.DOWN, ctrl: false, alt: false, shift: false }), true);
      assert.equal(cms.triggerMouseEvent({ col: 0, row: 0, x: 0, y: 0, button: CoreMouseButton.RIGHT, action: CoreMouseAction.DOWN, ctrl: false, alt: false, shift: false }), true);
      assert.equal(cms.triggerMouseEvent({ col: 0, row: 0, x: 0, y: 0, button: CoreMouseButton.WHEEL, action: CoreMouseAction.DOWN, ctrl: false, alt: false, shift: false }), true);
      assert.deepEqual(reports, ['\x1b[M !!', '\x1b[M!!!', '\x1b[M"!!', '\x1b[Ma!!']);
      reports = [];

      // all buttons + up + no modifier
      assert.equal(cms.triggerMouseEvent({ col: 0, row: 0, x: 0, y: 0, button: CoreMouseButton.LEFT, action: CoreMouseAction.UP, ctrl: false, alt: false, shift: false }), true);
      assert.equal(cms.triggerMouseEvent({ col: 0, row: 0, x: 0, y: 0, button: CoreMouseButton.MIDDLE, action: CoreMouseAction.UP, ctrl: false, alt: false, shift: false }), true);
      assert.equal(cms.triggerMouseEvent({ col: 0, row: 0, x: 0, y: 0, button: CoreMouseButton.RIGHT, action: CoreMouseAction.UP, ctrl: false, alt: false, shift: false }), true);
      assert.equal(cms.triggerMouseEvent({ col: 0, row: 0, x: 0, y: 0, button: CoreMouseButton.WHEEL, action: CoreMouseAction.UP, ctrl: false, alt: false, shift: false }), true);
      assert.deepEqual(reports, ['\x1b[M#!!', '\x1b[M#!!', '\x1b[M#!!', '\x1b[M`!!']);
      reports = [];

      // all buttons + move + no modifier
      assert.equal(cms.triggerMouseEvent({ col: 0, row: 0, x: 0, y: 0, button: CoreMouseButton.LEFT, action: CoreMouseAction.MOVE, ctrl: false, alt: false, shift: false }), true);
      assert.equal(cms.triggerMouseEvent({ col: 0, row: 0, x: 0, y: 0, button: CoreMouseButton.MIDDLE, action: CoreMouseAction.MOVE, ctrl: false, alt: false, shift: false }), true);
      assert.equal(cms.triggerMouseEvent({ col: 0, row: 0, x: 0, y: 0, button: CoreMouseButton.RIGHT, action: CoreMouseAction.MOVE, ctrl: false, alt: false, shift: false }), true);
      assert.equal(cms.triggerMouseEvent({ col: 0, row: 0, x: 0, y: 0, button: CoreMouseButton.NONE, action: CoreMouseAction.MOVE, ctrl: false, alt: false, shift: false }), true);
      assert.deepEqual(reports, ['\x1b[M@!!', '\x1b[MA!!', '\x1b[MB!!', '\x1b[MC!!']);
      reports = [];

      // button none + move + modifiers
      assert.equal(cms.triggerMouseEvent({ col: 0, row: 0, x: 0, y: 0, button: CoreMouseButton.NONE, action: CoreMouseAction.MOVE, ctrl: true, alt: false, shift: false }), true);
      assert.equal(cms.triggerMouseEvent({ col: 0, row: 0, x: 0, y: 0, button: CoreMouseButton.NONE, action: CoreMouseAction.MOVE, ctrl: false, alt: true, shift: false }), true);
      assert.equal(cms.triggerMouseEvent({ col: 0, row: 0, x: 0, y: 0, button: CoreMouseButton.NONE, action: CoreMouseAction.MOVE, ctrl: false, alt: false, shift: true }), true);
      assert.equal(cms.triggerMouseEvent({ col: 0, row: 0, x: 0, y: 0, button: CoreMouseButton.NONE, action: CoreMouseAction.MOVE, ctrl: true, alt: true, shift: false }), true);
      assert.equal(cms.triggerMouseEvent({ col: 0, row: 0, x: 0, y: 0, button: CoreMouseButton.NONE, action: CoreMouseAction.MOVE, ctrl: false, alt: true, shift: true }), true);
      assert.equal(cms.triggerMouseEvent({ col: 0, row: 0, x: 0, y: 0, button: CoreMouseButton.NONE, action: CoreMouseAction.MOVE, ctrl: true, alt: true, shift: true }), true);
      assert.deepEqual(reports, ['\x1b[MS!!', '\x1b[MK!!', '\x1b[MG!!', '\x1b[M[!!', '\x1b[MO!!', '\x1b[M_!!']);
      reports = [];
    });
  });
});
