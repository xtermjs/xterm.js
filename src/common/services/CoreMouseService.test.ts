/**
 * Copyright (c) 2019 The xterm.js authors. All rights reserved.
 * @license MIT
 */
import { CoreMouseService } from 'common/services/CoreMouseService';
import { MockCoreService, MockBufferService } from 'common/TestUtils.test';
import { assert } from 'chai';
import { ICoreMouseEvent, CoreMouseEventType } from 'common/Types';

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
  it('default encodings - DEFAULT, UTF8, SGR, URXVT', () => {
    const cms = new CoreMouseService(bufferService, coreService);
    assert.deepEqual(Object.keys((cms as any)._encodings), ['DEFAULT', 'UTF8', 'SGR', 'URXVT']);
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
    cms.addProtocol('XYZ', { events: [], restrict: (e: ICoreMouseEvent) => false });
    cms.activeProtocol = 'XYZ';
    assert.equal(cms.activeProtocol, 'XYZ');
  });
  it('onProtocolChange', () => {
    const cms = new CoreMouseService(bufferService, coreService);
    const wantedEvents: CoreMouseEventType[][] = [];
    cms.onProtocolChange(events => wantedEvents.push(events));
    cms.activeProtocol = 'NONE';
    assert.deepEqual(wantedEvents, [[]]);
    cms.activeProtocol = 'ANY';
    assert.deepEqual(wantedEvents, [[], ['mousedown', 'mouseup', 'wheel', 'mousedrag', 'mousemove']]);
  });
  describe('triggerMouseEvent', () => {
    let cms: CoreMouseService;
    let reports: string[];
    beforeEach(() => {
      cms = new CoreMouseService(bufferService, coreService);
      reports = [];
      coreService.triggerDataEvent = (data: string, userInput?: boolean) => reports.push(data);
    });
    it('NONE', () => {
      assert.equal(cms.triggerMouseEvent({ col: 0, row: 0, button: 'left', action: 'down' }), false);
      assert.equal(cms.triggerMouseEvent({ col: 0, row: 0, button: 'left', action: 'up' }), false);
      assert.equal(cms.triggerMouseEvent({ col: 0, row: 0, button: 'left', action: 'move' }), false);
      assert.equal(cms.triggerMouseEvent({ col: 0, row: 0, button: 'middle', action: 'down' }), false);
      assert.equal(cms.triggerMouseEvent({ col: 0, row: 0, button: 'right', action: 'down' }), false);
      assert.equal(cms.triggerMouseEvent({ col: 0, row: 0, button: 'wheel', action: 'up' }), false);
      assert.equal(cms.triggerMouseEvent({ col: 0, row: 0, button: 'none', action: 'move' }), false);
    });
    it('X10', () => {
      cms.activeProtocol = 'X10';
      assert.equal(cms.triggerMouseEvent({ col: 0, row: 0, button: 'left', action: 'down' }), true);
      assert.equal(cms.triggerMouseEvent({ col: 0, row: 0, button: 'left', action: 'up' }), false);
      assert.equal(cms.triggerMouseEvent({ col: 0, row: 0, button: 'left', action: 'move' }), false);
      assert.equal(cms.triggerMouseEvent({ col: 0, row: 0, button: 'middle', action: 'down' }), true);
      assert.equal(cms.triggerMouseEvent({ col: 0, row: 0, button: 'right', action: 'down' }), true);
      assert.equal(cms.triggerMouseEvent({ col: 0, row: 0, button: 'wheel', action: 'up' }), false);
      assert.equal(cms.triggerMouseEvent({ col: 0, row: 0, button: 'none', action: 'move' }), false);
    });
    it('VT200', () => {
      cms.activeProtocol = 'VT200';
      assert.equal(cms.triggerMouseEvent({ col: 0, row: 0, button: 'left', action: 'down' }), true);
      assert.equal(cms.triggerMouseEvent({ col: 0, row: 0, button: 'left', action: 'up' }), true);
      assert.equal(cms.triggerMouseEvent({ col: 0, row: 0, button: 'left', action: 'move' }), false);
      assert.equal(cms.triggerMouseEvent({ col: 0, row: 0, button: 'middle', action: 'down' }), true);
      assert.equal(cms.triggerMouseEvent({ col: 0, row: 0, button: 'right', action: 'down' }), true);
      assert.equal(cms.triggerMouseEvent({ col: 0, row: 0, button: 'wheel', action: 'up' }), true);
      assert.equal(cms.triggerMouseEvent({ col: 0, row: 0, button: 'none', action: 'move' }), false);
    });
    it('DRAG', () => {
      cms.activeProtocol = 'DRAG';
      assert.equal(cms.triggerMouseEvent({ col: 0, row: 0, button: 'left', action: 'down' }), true);
      assert.equal(cms.triggerMouseEvent({ col: 0, row: 0, button: 'left', action: 'up' }), true);
      assert.equal(cms.triggerMouseEvent({ col: 0, row: 0, button: 'left', action: 'move' }), true);
      assert.equal(cms.triggerMouseEvent({ col: 0, row: 0, button: 'middle', action: 'down' }), true);
      assert.equal(cms.triggerMouseEvent({ col: 0, row: 0, button: 'right', action: 'down' }), true);
      assert.equal(cms.triggerMouseEvent({ col: 0, row: 0, button: 'wheel', action: 'up' }), true);
    });
    it('ANY', () => {
      cms.activeProtocol = 'ANY';
      assert.equal(cms.triggerMouseEvent({ col: 0, row: 0, button: 'left', action: 'down' }), true);
      assert.equal(cms.triggerMouseEvent({ col: 0, row: 0, button: 'left', action: 'up' }), true);
      assert.equal(cms.triggerMouseEvent({ col: 0, row: 0, button: 'left', action: 'move' }), true);
      assert.equal(cms.triggerMouseEvent({ col: 0, row: 0, button: 'middle', action: 'down' }), true);
      assert.equal(cms.triggerMouseEvent({ col: 0, row: 0, button: 'right', action: 'down' }), true);
      assert.equal(cms.triggerMouseEvent({ col: 0, row: 0, button: 'wheel', action: 'up' }), true);
      assert.equal(cms.triggerMouseEvent({ col: 0, row: 0, button: 'none', action: 'move' }), true);
      // should not report in any case
      // invalid button + action combinations
      assert.equal(cms.triggerMouseEvent({ col: 0, row: 0, button: 'wheel', action: 'move' }), false);
      assert.equal(cms.triggerMouseEvent({ col: 0, row: 0, button: 'none', action: 'down' }), false);
      assert.equal(cms.triggerMouseEvent({ col: 0, row: 0, button: 'none', action: 'up' }), false);
      // invalid coords
      assert.equal(cms.triggerMouseEvent({ col: -1, row: 0, button: 'left', action: 'down' }), false);
      assert.equal(cms.triggerMouseEvent({ col: 500, row: 0, button: 'left', action: 'down' }), false);
      assert.equal(cms.triggerMouseEvent({ col: 0, row: -1, button: 'left', action: 'down' }), false);
      assert.equal(cms.triggerMouseEvent({ col: 0, row: 500, button: 'left', action: 'down' }), false);
    });
    describe('coords', () => {
      it('DEFAULT encoding', () => {
        cms.activeProtocol = 'ANY';
        for (let i = 0; i < bufferService.cols; ++i) {
          assert.equal(cms.triggerMouseEvent({ col: i, row: 0, button: 'left', action: 'down' }), true);
          // capped at 95
          if (i < 95) {
            assert.deepEqual(toBytes(reports.pop()), [0x1b, 0x5b, 0x4d, 0x20, i + 33, 0x21]);
          } else {
            assert.deepEqual(toBytes(reports.pop()), [0x1b, 0x5b, 0x4d, 0x20, 0x7f, 0x21]);
          }
        }
      });
      it('UTF8 encoding', () => {
        cms.activeProtocol = 'ANY';
        cms.activeEncoding = 'UTF8';
        for (let i = 0; i < bufferService.cols; ++i) {
          assert.equal(cms.triggerMouseEvent({ col: i, row: 0, button: 'left', action: 'down' }), true);
          assert.deepEqual(toBytes(reports.pop()), [0x1b, 0x5b, 0x4d, 0x20, i + 33, 0x21]);
        }
      });
      it('SGR encoding', () => {
        cms.activeProtocol = 'ANY';
        cms.activeEncoding = 'SGR';
        for (let i = 0; i < bufferService.cols; ++i) {
          assert.equal(cms.triggerMouseEvent({ col: i, row: 0, button: 'left', action: 'down' }), true);
          assert.deepEqual(reports.pop(), `\x1b[<0;${i + 1};1M`);
        }
      });
      it('URXVT', () => {
        cms.activeProtocol = 'ANY';
        cms.activeEncoding = 'URXVT';
        for (let i = 0; i < bufferService.cols; ++i) {
          assert.equal(cms.triggerMouseEvent({ col: i, row: 0, button: 'left', action: 'down' }), true);
          assert.deepEqual(reports.pop(), `\x1b[32;${i + 1};1M`);
        }
      });
    });
    it('eventCodes with modifiers (DEFAULT encoding)', () => {
      cms.activeProtocol = 'ANY';
      cms.activeEncoding = 'DEFAULT';
      // all buttons + down + no modifer
      assert.equal(cms.triggerMouseEvent({ col: 0, row: 0, button: 'left', action: 'down', ctrl: false, alt: false, shift: false }), true);
      assert.equal(cms.triggerMouseEvent({ col: 0, row: 0, button: 'middle', action: 'down', ctrl: false, alt: false, shift: false }), true);
      assert.equal(cms.triggerMouseEvent({ col: 0, row: 0, button: 'right', action: 'down', ctrl: false, alt: false, shift: false }), true);
      assert.equal(cms.triggerMouseEvent({ col: 0, row: 0, button: 'wheel', action: 'down', ctrl: false, alt: false, shift: false }), true);
      assert.deepEqual(reports, ['\x1b[M !!', '\x1b[M!!!', '\x1b[M"!!', '\x1b[Ma!!']);
      while (reports.pop()) { }

      // all buttons + up + no modifier
      assert.equal(cms.triggerMouseEvent({ col: 0, row: 0, button: 'left', action: 'up', ctrl: false, alt: false, shift: false }), true);
      assert.equal(cms.triggerMouseEvent({ col: 0, row: 0, button: 'middle', action: 'up', ctrl: false, alt: false, shift: false }), true);
      assert.equal(cms.triggerMouseEvent({ col: 0, row: 0, button: 'right', action: 'up', ctrl: false, alt: false, shift: false }), true);
      assert.equal(cms.triggerMouseEvent({ col: 0, row: 0, button: 'wheel', action: 'up', ctrl: false, alt: false, shift: false }), true);
      assert.deepEqual(reports, ['\x1b[M#!!', '\x1b[M#!!', '\x1b[M#!!', '\x1b[M`!!']);
      while (reports.pop()) { }

      // all buttons + move + no modifier
      assert.equal(cms.triggerMouseEvent({ col: 0, row: 0, button: 'left', action: 'move', ctrl: false, alt: false, shift: false }), true);
      assert.equal(cms.triggerMouseEvent({ col: 0, row: 0, button: 'middle', action: 'move', ctrl: false, alt: false, shift: false }), true);
      assert.equal(cms.triggerMouseEvent({ col: 0, row: 0, button: 'right', action: 'move', ctrl: false, alt: false, shift: false }), true);
      assert.equal(cms.triggerMouseEvent({ col: 0, row: 0, button: 'none', action: 'move', ctrl: false, alt: false, shift: false }), true);
      assert.deepEqual(reports, ['\x1b[M@!!', '\x1b[MA!!', '\x1b[MB!!', '\x1b[MC!!']);
      while (reports.pop()) { }

      // button none + move + modifiers
      assert.equal(cms.triggerMouseEvent({ col: 0, row: 0, button: 'none', action: 'move', ctrl: true, alt: false, shift: false }), true);
      assert.equal(cms.triggerMouseEvent({ col: 0, row: 0, button: 'none', action: 'move', ctrl: false, alt: true, shift: false }), true);
      assert.equal(cms.triggerMouseEvent({ col: 0, row: 0, button: 'none', action: 'move', ctrl: false, alt: false, shift: true }), true);
      assert.equal(cms.triggerMouseEvent({ col: 0, row: 0, button: 'none', action: 'move', ctrl: true, alt: true, shift: false }), true);
      assert.equal(cms.triggerMouseEvent({ col: 0, row: 0, button: 'none', action: 'move', ctrl: false, alt: true, shift: true }), true);
      assert.equal(cms.triggerMouseEvent({ col: 0, row: 0, button: 'none', action: 'move', ctrl: true, alt: true, shift: true }), true);
      assert.deepEqual(reports, ['\x1b[MS!!', '\x1b[MK!!', '\x1b[MG!!', '\x1b[M[!!', '\x1b[MO!!', '\x1b[M_!!']);
      while (reports.pop()) { }
    });
  });
});
