/**
 * Copyright (c) 2026 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import { assert } from 'chai';
import { TextBlinkStateManager } from 'browser/renderer/shared/TextBlinkStateManager';
import { MockOptionsService } from 'common/TestUtils.test';
import type { ICoreBrowserService } from 'browser/services/Services';
import { Emitter } from 'common/Event';

class FakeWindow {
  public nextId = 1;
  public intervals = new Map<number, () => void>();

  public setInterval(callback: () => void, _duration: number): number {
    const id = this.nextId++;
    this.intervals.set(id, callback);
    return id;
  }

  public clearInterval(id: number): void {
    this.intervals.delete(id);
  }
}

function createManager(duration: number): {
  manager: TextBlinkStateManager;
  window: FakeWindow;
  getRenderCount: () => number;
} {
  const fakeWindow = new FakeWindow();
  let renderCount = 0;
  const coreBrowserService: ICoreBrowserService = {
    serviceBrand: undefined,
    isFocused: true,
    dpr: 1,
    onDprChange: new Emitter<number>().event,
    onWindowChange: new Emitter<Window & typeof globalThis>().event,
    window: fakeWindow as any,
    mainDocument: {} as any
  };
  const optionsService = new MockOptionsService({ blinkIntervalDuration: duration });
  const manager = new TextBlinkStateManager(() => {
    renderCount++;
  }, coreBrowserService, optionsService);
  return {
    manager,
    window: fakeWindow,
    getRenderCount: () => renderCount
  };
}

function getOnlyIntervalCallback(window: FakeWindow): () => void {
  const iterator = window.intervals.values();
  const first = iterator.next();
  assert.ok(!first.done);
  assert.ok(iterator.next().done);
  return first.value;
}

describe('TextBlinkStateManager', () => {
  it('starts interval only when needed', () => {
    const { manager, window } = createManager(100);
    assert.equal(window.intervals.size, 0);
    manager.setNeedsBlinkInViewport(true);
    assert.equal(window.intervals.size, 1);
  });

  it('stops interval and restores blink visibility when no longer needed', () => {
    const { manager, window, getRenderCount } = createManager(100);
    manager.setNeedsBlinkInViewport(true);
    const tick = getOnlyIntervalCallback(window);
    tick();
    const rendersAfterTick = getRenderCount();
    assert.equal(manager.isBlinkOn, false);
    manager.setNeedsBlinkInViewport(false);
    assert.equal(window.intervals.size, 0);
    assert.equal(manager.isBlinkOn, true);
    assert.equal(getRenderCount(), rendersAfterTick + 1);
  });

  it('pauses while viewport is hidden and resumes when visible', () => {
    const { manager, window } = createManager(100);
    manager.setNeedsBlinkInViewport(true);
    assert.equal(window.intervals.size, 1);
    manager.setViewportVisible(false);
    assert.equal(window.intervals.size, 0);
    manager.setViewportVisible(true);
    assert.equal(window.intervals.size, 1);
  });

  it('does not start interval when duration is zero', () => {
    const { manager, window } = createManager(0);
    manager.setNeedsBlinkInViewport(true);
    assert.equal(window.intervals.size, 0);
  });
});
