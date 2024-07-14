/**
 * Copyright (c) 2019 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import { assert } from 'chai';
import { DecorationService } from './DecorationService';
import { IMarker } from 'common/Types';
import { Disposable } from 'vs/base/common/lifecycle';
import { Emitter } from 'vs/base/common/event';

const fakeMarker: IMarker = Object.freeze(new class extends Disposable {
  public readonly id = 1;
  public readonly line = 1;
  public readonly isDisposed = false;
  public readonly onDispose = new Emitter<void>().event;
}());

describe('DecorationService', () => {
  it('should set isDisposed to true after dispose', () => {
    const service = new DecorationService();
    const decoration = service.registerDecoration({
      marker: fakeMarker
    });
    assert.ok(decoration);
    assert.isFalse(decoration!.isDisposed);
    decoration!.dispose();
    assert.isTrue(decoration!.isDisposed);
  });
});
