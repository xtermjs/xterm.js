/**
 * Copyright (c) 2026 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import jsdom = require('jsdom');
import { assert } from 'chai';
import { AccessibilityManager } from './AccessibilityManager';
import * as Strings from './LocalizableStrings';
import { MockRenderService, MockTerminal } from './TestUtils.test';
import { Emitter } from '../common/Event';

interface IPendingTimer {
  id: number;
  callback: () => void;
  delay: number;
}

describe('AccessibilityManager', () => {
  let dom: jsdom.JSDOM;
  let terminalElement: HTMLElement;
  let terminal: MockTerminal;
  let onResizeEmitter: Emitter<{ cols: number, rows: number }>;
  let onRenderEmitter: Emitter<{ start: number, end: number }>;
  let onScrollEmitter: Emitter<number>;
  let onA11yCharEmitter: Emitter<string>;
  let onLineFeedEmitter: Emitter<void>;
  let onA11yTabEmitter: Emitter<number>;
  let onKeyEmitter: Emitter<{ key: string, domEvent: KeyboardEvent }>;
  let onBlurEmitter: Emitter<void>;
  let nextTimerId: number;
  let pendingTimers: IPendingTimer[];
  let manager: AccessibilityManager;

  beforeEach(() => {
    dom = new jsdom.JSDOM('');
    terminalElement = dom.window.document.createElement('div');
    dom.window.document.body.appendChild(terminalElement);

    onResizeEmitter = new Emitter<{ cols: number, rows: number }>();
    onRenderEmitter = new Emitter<{ start: number, end: number }>();
    onScrollEmitter = new Emitter<number>();
    onA11yCharEmitter = new Emitter<string>();
    onLineFeedEmitter = new Emitter<void>();
    onA11yTabEmitter = new Emitter<number>();
    onKeyEmitter = new Emitter<{ key: string, domEvent: KeyboardEvent }>();
    onBlurEmitter = new Emitter<void>();

    terminal = new MockTerminal();
    terminal.rows = 5;
    terminal.cols = 10;
    terminal.element = terminalElement;
    terminal.options = { fontSize: 15 } as any;
    terminal.buffer = {
      ydisp: 0,
      lines: {
        length: 5,
        get: () => undefined
      }
    } as any;
    terminal.onResize = onResizeEmitter.event;
    terminal.onRender = onRenderEmitter.event;
    terminal.onScroll = onScrollEmitter.event;
    terminal.onA11yChar = onA11yCharEmitter.event;
    terminal.onLineFeed = onLineFeedEmitter.event;
    terminal.onA11yTab = onA11yTabEmitter.event;
    terminal.onKey = onKeyEmitter.event;
    terminal.onBlur = onBlurEmitter.event;

    nextTimerId = 1;
    pendingTimers = [];

    const coreBrowserService = {
      mainDocument: dom.window.document,
      window: {
        setTimeout: (callback: () => void, delay: number) => {
          const id = nextTimerId++;
          pendingTimers.push({ id, callback, delay });
          return id;
        },
        clearTimeout: (id: number) => {
          pendingTimers = pendingTimers.filter(t => t.id !== id);
        }
      },
      onDprChange: new Emitter<number>().event
    } as any;

    manager = new AccessibilityManager(
      terminal,
      null as any,
      coreBrowserService,
      new MockRenderService()
    );
  });

  afterEach(() => {
    manager.dispose();
  });

  function getLiveRegion(): HTMLElement {
    const liveRegion = terminalElement.querySelector('.live-region');
    assert.isNotNull(liveRegion);
    return liveRegion as HTMLElement;
  }

  function flushTimers(): void {
    const timers = pendingTimers.slice();
    pendingTimers = [];
    for (const timer of timers) {
      timer.callback();
    }
  }

  it('should clear the live region after announcing characters', () => {
    for (const ch of 'hello') {
      onA11yCharEmitter.fire(ch);
    }
    // Trigger render immediately via _renderRows
    (manager as any)._renderRows(0, 0);

    assert.equal(getLiveRegion().textContent, 'hello');
    assert.equal(pendingTimers.length, 1);
    assert.equal(pendingTimers[0].delay, 300);

    flushTimers();
    assert.equal(getLiveRegion().textContent, '');
  });

  it('should reset the clear timer on consecutive announcements', () => {
    onA11yCharEmitter.fire('a');
    (manager as any)._renderRows(0, 0);
    assert.equal(pendingTimers.length, 1);
    const firstTimerId = pendingTimers[0].id;

    onA11yCharEmitter.fire('b');
    (manager as any)._renderRows(0, 0);
    assert.equal(pendingTimers.length, 1);
    assert.notEqual(pendingTimers[0].id, firstTimerId);
    assert.equal(getLiveRegion().textContent, 'ab');

    flushTimers();
    assert.equal(getLiveRegion().textContent, '');
  });

  it('should cancel pending clear timer on key press and blur', () => {
    onA11yCharEmitter.fire('x');
    (manager as any)._renderRows(0, 0);
    assert.equal(pendingTimers.length, 1);

    onKeyEmitter.fire({ key: 'a', domEvent: {} as KeyboardEvent });
    assert.equal(getLiveRegion().textContent, '');
    assert.equal(pendingTimers.length, 0);

    onA11yCharEmitter.fire('y');
    (manager as any)._renderRows(0, 0);
    assert.equal(pendingTimers.length, 1);

    onBlurEmitter.fire();
    assert.equal(getLiveRegion().textContent, '');
    assert.equal(pendingTimers.length, 0);
  });

  it('should clear tooMuchOutput notice after delay', () => {
    for (let i = 0; i < 21; i++) {
      onLineFeedEmitter.fire();
    }

    assert.equal(getLiveRegion().textContent, Strings.tooMuchOutput.get());
    assert.equal(pendingTimers.length, 1);

    flushTimers();
    assert.equal(getLiveRegion().textContent, '');
  });

  it('should cancel pending clear timer on dispose', () => {
    onA11yCharEmitter.fire('z');
    (manager as any)._renderRows(0, 0);
    assert.equal(pendingTimers.length, 1);

    manager.dispose();
    assert.equal(pendingTimers.length, 0);
  });
});
