/**
 * Copyright (c) 2026 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import jsdom = require('jsdom');
import { assert } from 'chai';
import { RenderService } from './RenderService';
import { MockCharSizeService, MockRenderer, MockThemeService } from '../TestUtils.test';
import { MockBufferService, MockCoreService, MockDecorationService, MockLogService, MockOptionsService } from '../../common/TestUtils.test';
import { ICoreBrowserService } from './Services';
import { Emitter } from '../../common/Event';
import { timeout } from '../../common/Async';
import { IRequestRedrawEvent } from '../renderer/shared/Types';

class TestRenderer extends MockRenderer {
  public rendered: [number, number][] = [];
  public resized: [number, number][] = [];
  private readonly _onRequestRedrawEmitter = new Emitter<IRequestRedrawEvent>();
  public onRequestRedraw = this._onRequestRedrawEmitter.event;
  public requestRedraw(e: IRequestRedrawEvent): void { this._onRequestRedrawEmitter.fire(e); }
  public renderRows(start: number, end: number): void { this.rendered.push([start, end]); }
  public handleResize(cols: number, rows: number): void { this.resized.push([cols, rows]); }
  public dispose(): void { }
}

/**
 * Like the WebGL renderer, requests a sync redraw at the end of handleResize.
 */
class SyncResizeRenderer extends TestRenderer {
  public reentered = false;
  private _isResizing = false;
  public handleResize(cols: number, rows: number): void {
    this.reentered ||= this._isResizing;
    this._isResizing = true;
    try {
      super.handleResize(cols, rows);
      this.requestRedraw({ start: 0, end: 9, sync: true });
    } finally {
      this._isResizing = false;
    }
  }
}

describe('RenderService', () => {
  let window: jsdom.DOMWindow;
  let renderService: RenderService;
  let reportIntersection: (isIntersecting: boolean) => void;
  let animationFrames: FrameRequestCallback[];

  beforeEach(() => {
    window = new jsdom.JSDOM('').window;
    animationFrames = [];
    (window as any).requestAnimationFrame = (callback: FrameRequestCallback) => animationFrames.push(callback);
    (window as any).cancelAnimationFrame = () => {};
    (window as any).IntersectionObserver = class {
      constructor(callback: (entries: Partial<IntersectionObserverEntry>[]) => void) {
        reportIntersection = isIntersecting => callback([{ isIntersecting, intersectionRatio: isIntersecting ? 1 : 0 }]);
      }
      public observe(): void { }
      public disconnect(): void { }
    };
    const coreBrowserService = {
      serviceBrand: undefined,
      onDprChange: new Emitter<number>().event,
      onWindowChange: new Emitter<Window & typeof globalThis>().event,
      isFocused: true,
      window: window as unknown as Window & typeof globalThis,
      mainDocument: window.document,
      dpr: 1
    } as ICoreBrowserService;
    renderService = new RenderService(
      10,
      window.document.createElement('div'),
      new MockOptionsService(),
      new MockLogService(),
      new MockCharSizeService(5, 10),
      new MockCoreService(),
      new MockDecorationService(),
      new MockBufferService(80, 10),
      coreBrowserService,
      new MockThemeService()
    );
  });

  afterEach(() => renderService.dispose());

  describe('while paused', () => {
    beforeEach(() => reportIntersection(false));

    it('should render a new renderer right away', () => {
      const renderer = new TestRenderer();
      renderService.setRenderer(renderer);
      assert.deepEqual(renderer.rendered, [[0, 9]]);
    });

    it('should render a sync redraw right away, after the paused resize', () => {
      const renderer = new TestRenderer();
      renderService.setRenderer(renderer);
      renderer.rendered = [];
      renderService.handleResize(100, 10);
      assert.deepEqual(renderer.resized, []);
      renderer.requestRedraw({ start: 0, end: 9, sync: true });
      assert.deepEqual(renderer.resized, [[100, 10]]);
      assert.deepEqual(renderer.rendered, [[0, 9]]);
    });

    describe('with a renderer that redraws on resize', () => {
      it('should resize once on a sync redraw with a resize queued', () => {
        const renderer = new SyncResizeRenderer();
        renderService.setRenderer(renderer);
        renderer.rendered = [];
        renderService.handleResize(100, 10);
        renderer.requestRedraw({ start: 0, end: 9, sync: true });
        assert.deepEqual(renderer.resized, [[100, 10]]);
        assert.isFalse(renderer.reentered);
        // The resize's own redraw renders, then the redraw that flushed it
        assert.deepEqual(renderer.rendered, [[0, 9], [0, 9]]);
      });

      it('should resize once when the queued resize runs idle', async () => {
        const renderer = new SyncResizeRenderer();
        renderService.setRenderer(renderer);
        renderer.rendered = [];
        renderService.handleResize(100, 10);
        await timeout(0);
        assert.deepEqual(renderer.resized, [[100, 10]]);
        assert.isFalse(renderer.reentered);
        assert.deepEqual(renderer.rendered, [[0, 9]]);
      });

      it('should resize once when a renderer is set with a resize queued', async () => {
        renderService.setRenderer(new TestRenderer());
        renderService.handleResize(100, 10);
        const renderer = new SyncResizeRenderer();
        renderService.setRenderer(renderer);
        assert.deepEqual(renderer.resized, [[100, 10]]);
        assert.isFalse(renderer.reentered);
        assert.deepEqual(renderer.rendered, [[0, 9], [0, 9]]);
        // The flush emptied the queue
        await timeout(0);
        assert.deepEqual(renderer.resized, [[100, 10]]);
      });
    });

    it('should not render other refreshes until resumed', () => {
      const renderer = new TestRenderer();
      renderService.setRenderer(renderer);
      renderer.rendered = [];
      renderer.requestRedraw({ start: 0, end: 9 });
      renderService.refreshRows(2, 3);
      assert.deepEqual(renderer.rendered, []);
      assert.equal(animationFrames.length, 0);
      reportIntersection(true);
      animationFrames.splice(0).forEach(callback => callback(0));
      assert.deepEqual(renderer.rendered, [[0, 9]]);
    });
  });

  describe('while not paused', () => {
    it('should render a new renderer on the next frame', () => {
      const renderer = new TestRenderer();
      renderService.setRenderer(renderer);
      assert.deepEqual(renderer.rendered, []);
      animationFrames.splice(0).forEach(callback => callback(0));
      assert.deepEqual(renderer.rendered, [[0, 9]]);
    });
  });
});
