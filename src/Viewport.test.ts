/**
 * Copyright (c) 2016 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import jsdom = require('jsdom');
import { expect } from 'chai';
import { MockTerminal } from './utils/TestUtils.test';
import { IViewport } from './Types';
import { Viewport } from './Viewport';

describe('Viewport', () => {
  let dom: jsdom.JSDOM;
  let window: Window;
  let document: Document;

  let term: MockTerminal;
  let viewport: IViewport;
  let _viewportElement: HTMLElement;

  beforeEach(() => {
    dom = new jsdom.JSDOM('');
    window = dom.window;
    document = window.document;

    _viewportElement = document.createElement('div');
    document.body.appendChild(_viewportElement);
    const _viewportScrollArea: HTMLElement = document.createElement('div');
    _viewportElement.appendChild(_viewportScrollArea);

    // jsdom doesn't provide a useful value for scrollHeight
    Object.defineProperty(_viewportElement, 'scrollHeight', { value: 100 });

    // Using an empty object as it's not used in the current tests
    const mockCharMeasure = {};

    term = new MockTerminal();
    term.cols = 80; // <- not used in current tests
    term.rows = 24;

    viewport = new Viewport(term,
      _viewportElement, _viewportScrollArea, <any>mockCharMeasure);

    // Methods excluded from the current tests
    (<any>viewport)._refresh = () => {};
    (<any>viewport).syncScrollArea = () => {};

    (<any>global).WheelEvent = (<any>window).WheelEvent;
  });

  afterEach(() => {
    delete (<any>global).WheelEvent;
  });

  describe('onWheel', () => {
    it('should return true when the terminal is scrolled down', () => {
      const ev = new WheelEvent('wheel', { deltaY: 20 });
      const cancel = viewport.onWheel(ev);
      expect(cancel).eql(true);
    });

    it('should return true when the terminal is scrolled up', () => {
      _viewportElement.scrollTop = 20;
      const ev = new WheelEvent('wheel', { deltaY: -20 });
      const cancel = viewport.onWheel(ev);
      expect(cancel).eql(true);
    });

    it('should return false when scrolling up and viewport is at top', () => {
      const ev = new WheelEvent('wheel', { deltaY: -20 });
      const cancel = viewport.onWheel(ev);
      expect(cancel).eql(false);
    });

    it('should return false when scrolling down and viewport is at bottom', () => {
      _viewportElement.scrollTop = _viewportElement.scrollHeight;
      const ev = new WheelEvent('wheel', { deltaY: 20 });
      const cancel = viewport.onWheel(ev);
      expect(cancel).eql(false);
    });
  });

  describe('onTouchMove', () => {
    it('should return true when the terminal is scrolled down', () => {
      (<any>viewport)._lastTouchY = 60;
      const ev = { touches: [{ pageY: 40 }] };
      const cancel = viewport.onTouchMove(<any>ev);
      expect(cancel).eql(true);
    });

    it('should return true when the terminal is scrolled up', () => {
      (<any>viewport)._lastTouchY = 40;
      _viewportElement.scrollTop = 20;
      const ev = { touches: [{ pageY: 60 }] };
      const cancel = viewport.onTouchMove(<any>ev);
      expect(cancel).eql(true);
    });

    it('should return false when scrolling up and viewport is at top', () => {
      (<any>viewport)._lastTouchY = 40;
      const ev = { touches: [{ pageY: 60 }] };
      const cancel = viewport.onTouchMove(<any>ev);
      expect(cancel).eql(false);
    });

    it('should return false when scrolling down and viewport is at bottom', () => {
      (<any>viewport)._lastTouchY = 60;
      _viewportElement.scrollTop = _viewportElement.scrollHeight;
      const ev = { touches: [{ pageY: 40 }] };
      const cancel = viewport.onTouchMove(<any>ev);
      expect(cancel).eql(false);
    });
  });
});
