/**
 * Copyright (c) 2019 The xterm.js authors. All rights reserved.
 * @license MIT
 */
import { MouseStateService } from 'common/services/MouseStateService';
import { assert } from 'chai';
import { ICoreMouseEvent, CoreMouseEventType } from 'common/Types';

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

describe('MouseStateService', () => {
  it('init', () => {
    const cms = new MouseStateService();
    assert.equal(cms.activeEncoding, 'DEFAULT');
    assert.equal(cms.activeProtocol, 'NONE');
  });
  it('default protocols - NONE, X10, VT200, DRAG, ANY', () => {
    const cms = new MouseStateService();
    assert.deepEqual(Object.keys((cms as any)._protocols), ['NONE', 'X10', 'VT200', 'DRAG', 'ANY']);
  });
  it('default encodings - DEFAULT, SGR', () => {
    const cms = new MouseStateService();
    assert.deepEqual(Object.keys((cms as any)._encodings), ['DEFAULT', 'SGR', 'SGR_PIXELS']);
  });
  it('protocol/encoding setter, reset', () => {
    const cms = new MouseStateService();
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
    const cms = new MouseStateService();
    cms.addEncoding('XYZ', (e: ICoreMouseEvent) => '');
    cms.activeEncoding = 'XYZ';
    assert.equal(cms.activeEncoding, 'XYZ');
  });
  it('addProtocol', () => {
    const cms = new MouseStateService();
    cms.addProtocol('XYZ', { events: CoreMouseEventType.NONE, restrict: (e: ICoreMouseEvent) => false });
    cms.activeProtocol = 'XYZ';
    assert.equal(cms.activeProtocol, 'XYZ');
  });
  it('onProtocolChange', () => {
    const cms = new MouseStateService();
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
  it('restrictMouseEvent/encodeMouseEvent', () => {
    const cms = new MouseStateService();
    const event: ICoreMouseEvent = {
      col: 1,
      row: 1,
      x: 0,
      y: 0,
      button: 0,
      action: 1,
      ctrl: false,
      alt: false,
      shift: false
    };
    cms.activeProtocol = 'ANY';
    cms.activeEncoding = 'DEFAULT';
    assert.equal(cms.restrictMouseEvent(event), true);
    assert.deepEqual(toBytes(cms.encodeMouseEvent(event)), [0x1b, 0x5b, 0x4d, 0x21, 0x21, 0x21]);
  });
});
