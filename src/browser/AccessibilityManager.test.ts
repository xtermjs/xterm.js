/**
 * Copyright (c) 2026 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import { assert } from 'chai';
import jsdom = require('jsdom');
import { AccessibilityManager } from './AccessibilityManager';
import { ITerminal } from './Types';
import { Emitter } from '../common/Event';
import { MockCoreBrowserService, MockRenderService } from './TestUtils.test';
import * as Strings from './LocalizableStrings';

describe('AccessibilityManager', () => {
  const cols = 10;
  const rows = 5;
  let onA11yChar: Emitter<string>;
  let onLineFeed: Emitter<void>;
  let manager: AccessibilityManager;
  let liveRegion: HTMLElement;

  beforeEach(() => {
    const document = new jsdom.JSDOM('').window.document;
    const element = document.createElement('div');
    onA11yChar = new Emitter<string>();
    onLineFeed = new Emitter<void>();
    const terminal = {
      element,
      cols,
      rows,
      options: { fontSize: 14 },
      buffer: { ydisp: 0, lines: { length: rows, get: () => undefined } },
      onResize: new Emitter().event,
      onRender: new Emitter().event,
      onScroll: new Emitter().event,
      onA11yChar: onA11yChar.event,
      onLineFeed: onLineFeed.event,
      onA11yTab: new Emitter().event,
      onKey: new Emitter().event,
      onBlur: new Emitter().event
    } as unknown as ITerminal;
    const coreBrowserService = new MockCoreBrowserService();
    Object.defineProperty(coreBrowserService, 'mainDocument', { get: () => document });
    manager = new AccessibilityManager(terminal, null!, coreBrowserService, new MockRenderService());
    liveRegion = element.querySelector('.live-region')!;
  });

  afterEach(() => {
    manager.dispose();
  });

  function print(text: string): void {
    for (const char of text) {
      if (char === '\n') {
        onLineFeed.fire();
      } else {
        onA11yChar.fire(char);
      }
    }
  }

  function announce(): void {
    (manager as any)._renderRows(0, rows - 1);
  }

  describe('live region', () => {
    it('should announce output', () => {
      print('foo\nbar');
      announce();
      assert.equal(liveRegion.textContent, 'foo\nbar');
    });

    it('should not announce more than 20 lines of output', () => {
      print('a\n'.repeat(30));
      assert.equal(liveRegion.textContent, Strings.tooMuchOutput.get());
    });

    it('should not announce more than 20 rows of output without line feeds', () => {
      // eg. a TUI that redraws the viewport by positioning the cursor
      print('a'.repeat(cols * 30));
      assert.equal(liveRegion.textContent, Strings.tooMuchOutput.get());
    });

    it('should not grow the live region without bound when output has no line feeds', () => {
      for (let i = 0; i < 10; i++) {
        print('a'.repeat(cols * 30));
        announce();
        // 20 rows plus the row that hits the limit
        assert.isAtMost(liveRegion.textContent!.length, cols * 21);
      }
    });
  });
});
