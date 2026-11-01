/**
 * Copyright (c) 2026 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import { assert } from 'chai';
import { Emitter } from '../../common/Event';
import { MockBufferService, MockCoreService, MockDecorationService, MockLogService, MockOptionsService } from '../../common/TestUtils.test';
import { createRenderDimensions } from '../renderer/shared/RendererUtils';
import { IRenderDimensions, IRenderer, IRequestRedrawEvent } from '../renderer/shared/Types';
import { MockCharSizeService, MockCoreBrowserService, MockThemeService } from '../TestUtils.test';
import { RenderService } from './RenderService';

type Selection = [[number, number] | undefined, [number, number] | undefined, boolean];

/**
 * A window whose animation frames, timeouts and IntersectionObserver the tests drive by hand.
 */
class TestWindow {
  private _frames = new Map<number, FrameRequestCallback>();
  private _timeouts = new Map<number, () => void>();
  private _nextId = 1;
  private _observers: ((entries: Partial<IntersectionObserverEntry>[]) => void)[] = [];

  public readonly IntersectionObserver = ((window: TestWindow) => class {
    constructor(callback: (entries: Partial<IntersectionObserverEntry>[]) => void) {
      window._observers.push(callback);
    }
    public observe(): void { }
    public disconnect(): void { }
  })(this);

  public requestAnimationFrame(callback: FrameRequestCallback): number {
    const id = this._nextId++;
    this._frames.set(id, callback);
    return id;
  }
  public cancelAnimationFrame(id: number): void { this._frames.delete(id); }
  public setTimeout(callback: () => void): number {
    const id = this._nextId++;
    this._timeouts.set(id, callback);
    return id;
  }
  public clearTimeout(id: number): void { this._timeouts.delete(id); }

  /** Runs the animation frames requested so far; frames they request wait for the next call. */
  public runFrames(): void {
    const frames = [...this._frames.values()];
    this._frames.clear();
    for (const frame of frames) {
      frame(0);
    }
  }
  public runTimeouts(): void {
    const timeouts = [...this._timeouts.values()];
    this._timeouts.clear();
    for (const timeout of timeouts) {
      timeout();
    }
  }
  /** Reports the terminal's screen as in or out of the viewport, as the browser would. */
  public intersect(isIntersecting: boolean): void {
    for (const observer of this._observers) {
      observer([{ isIntersecting, intersectionRatio: isIntersecting ? 1 : 0 }]);
    }
  }
}

class TestCoreBrowserService extends MockCoreBrowserService {
  constructor(private readonly _window: TestWindow) {
    super();
  }
  public get window(): Window & typeof globalThis {
    return this._window as unknown as Window & typeof globalThis;
  }
}

/**
 * Records what it is asked to draw. Like the DOM renderer, it requests a redraw of the selected
 * rows when the selection changes, and of the cursor row when focused or blurred, rather than
 * drawing them itself.
 */
class RecordingRenderer implements IRenderer {
  private readonly _onRequestRedraw = new Emitter<IRequestRedrawEvent>();
  public readonly onRequestRedraw = this._onRequestRedraw.event;
  public dimensions: IRenderDimensions = createRenderDimensions();
  public rendered: [number, number][] = [];
  public selections: Selection[] = [];
  public resizes: [number, number][] = [];
  public focused: boolean | undefined;

  public renderRows(start: number, end: number): void { this.rendered.push([start, end]); }
  public handleSelectionChanged(start: [number, number] | undefined, end: [number, number] | undefined, columnSelectMode: boolean): void {
    this.selections.push([start, end, columnSelectMode]);
    if (start && end) {
      this._onRequestRedraw.fire({ start: start[1], end: end[1] });
    }
  }
  public handleBlur(): void {
    this.focused = false;
    this._onRequestRedraw.fire({ start: 0, end: 23 });
  }
  public handleFocus(): void {
    this.focused = true;
    this._onRequestRedraw.fire({ start: 2, end: 2 });
  }
  public handleResize(cols: number, rows: number): void {
    this.resizes.push([cols, rows]);
    this._onRequestRedraw.fire({ start: 0, end: rows - 1 });
  }
  public handleDevicePixelRatioChange(): void { }
  public handleCharSizeChanged(): void { }
  public handleCursorMove(): void { }
  public clear(): void { }
  public dispose(): void { }
}

describe('RenderService', () => {
  let window: TestWindow;
  let coreService: MockCoreService;
  let service: RenderService;
  let renderer: RecordingRenderer;
  let contentEvents: { start: number, end: number }[];
  let renderEvents: { start: number, end: number }[];

  beforeEach(() => {
    window = new TestWindow();
    coreService = new MockCoreService();
    const optionsService = new MockOptionsService();
    service = new RenderService(
      24,
      {} as HTMLElement,
      optionsService,
      new MockLogService(),
      new MockCharSizeService(8, 16),
      coreService,
      new MockDecorationService(),
      new MockBufferService(80, 24, optionsService),
      new TestCoreBrowserService(window),
      new MockThemeService()
    );
    renderer = new RecordingRenderer();
    service.setRenderer(renderer);
    window.intersect(true);
    window.runFrames();
    window.runFrames();
    renderer.rendered = [];
    renderer.selections = [];
    contentEvents = [];
    renderEvents = [];
    service.onRenderedViewportChange(e => contentEvents.push(e));
    service.onRender(e => renderEvents.push(e));
  });

  afterEach(() => service.dispose());

  describe('while paused (not visible)', () => {
    it('does not render a refresh requested before the pause, and renders it all on resume', () => {
      service.refreshRows(0, 23);
      window.intersect(false);
      window.runFrames();
      assert.deepEqual(renderer.rendered, []);
      assert.deepEqual(renderEvents, []);
      assert.deepEqual(contentEvents, []);

      window.intersect(true);
      window.runFrames();
      assert.deepEqual(renderer.rendered, [[0, 23]]);
      assert.deepEqual(contentEvents, [{ start: 0, end: 23 }]);
    });

    it('does not render for selection changes, and keeps the latest for the renderer', () => {
      window.intersect(false);
      service.handleSelectionChanged([0, 3], [10, 5], false);
      service.handleSelectionChanged([0, 4], [10, 6], false);
      window.runFrames();
      assert.deepEqual(renderer.rendered, []);
      assert.deepEqual(renderEvents, []);
      assert.deepEqual(contentEvents, []);
      assert.deepEqual(renderer.selections, [[[0, 3], [10, 5], false], [[0, 4], [10, 6], false]]);

      window.intersect(true);
      window.runFrames();
      assert.deepEqual(renderer.rendered, [[0, 23]]);
    });

    it('does not render for blur and focus, and the renderer keeps the last of them', () => {
      window.intersect(false);
      service.handleBlur();
      service.handleFocus();
      service.handleBlur();
      window.runFrames();
      assert.deepEqual(renderer.rendered, []);
      assert.deepEqual(renderEvents, []);
      assert.deepEqual(contentEvents, []);
      assert.strictEqual(renderer.focused, false);

      window.intersect(true);
      window.runFrames();
      assert.deepEqual(renderer.rendered, [[0, 23]]);
    });

    it('does not render when a deferred resize runs, and renders at the new size on resume', () => {
      window.intersect(false);
      service.handleResize(100, 30);
      service.resize(100, 30);
      // The deferred resize runs when idle, while still paused.
      (service as unknown as { _pausedResizeTask: { flush(): void } })._pausedResizeTask.flush();
      window.runFrames();
      assert.deepEqual(renderer.resizes, [[100, 30]]);
      assert.deepEqual(renderer.rendered, []);
      assert.deepEqual(renderEvents, []);
      assert.deepEqual(contentEvents, []);

      window.intersect(true);
      window.runFrames();
      assert.deepEqual(renderer.rendered, [[0, 29]]);
    });

    it('replays the latest selection into a renderer set while paused', () => {
      window.intersect(false);
      service.handleSelectionChanged([0, 3], [10, 5], false);
      const next = new RecordingRenderer();
      service.setRenderer(next);
      window.runFrames();
      assert.deepEqual(next.rendered, []);
      assert.deepEqual(next.selections, []);
      assert.deepEqual(renderEvents, []);
      assert.deepEqual(contentEvents, []);

      window.intersect(true);
      window.runFrames();
      assert.deepEqual(next.rendered[0], [0, 23]);
      assert.deepEqual(next.selections, [[[0, 3], [10, 5], false]]);
    });

    it('does not render when the synchronized output timeout ends, until visible', () => {
      coreService.decPrivateModes.synchronizedOutput = true;
      service.refreshRows(0, 23);
      window.intersect(false);
      window.runTimeouts();
      window.runFrames();
      assert.strictEqual(coreService.decPrivateModes.synchronizedOutput, false);
      assert.deepEqual(renderer.rendered, []);
      assert.deepEqual(renderEvents, []);
      assert.deepEqual(contentEvents, []);

      window.intersect(true);
      window.runFrames();
      assert.deepEqual(renderer.rendered, [[0, 23]]);
    });
  });

  describe('while visible', () => {
    it('keeps a content refresh as content when a redraw is requested before its frame', () => {
      service.refreshRows(5, 5);
      service.handleFocus();
      window.runFrames();
      assert.deepEqual(renderer.rendered, [[2, 5]]);
      assert.deepEqual(contentEvents, [{ start: 2, end: 5 }]);
    });

    it('does not report a redraw requested by the renderer as a content change', () => {
      service.handleSelectionChanged([0, 3], [10, 5], false);
      window.runFrames();
      assert.deepEqual(renderer.rendered, [[3, 5]]);
      assert.deepEqual(renderEvents, [{ start: 3, end: 5 }]);
      assert.deepEqual(contentEvents, []);
    });

    it('replays a selection on a full refresh once, keeping the refresh\'s content event', () => {
      service.handleSelectionChanged([0, 3], [10, 5], false);
      window.runFrames();
      renderer.rendered = [];
      renderer.selections = [];
      contentEvents = [];

      // A new renderer replays the selection with its first full refresh.
      const next = new RecordingRenderer();
      service.setRenderer(next);
      service.refreshRows(0, 23);
      window.runFrames();
      assert.deepEqual(next.rendered, [[0, 23]]);
      assert.deepEqual(next.selections, [[[0, 3], [10, 5], false]]);
      assert.deepEqual(contentEvents, [{ start: 0, end: 23 }]);

      // The replay's own redraw comes on the next frame, as a redraw only.
      window.runFrames();
      assert.deepEqual(next.rendered, [[0, 23], [3, 5]]);
      assert.deepEqual(next.selections.length, 1);
      assert.deepEqual(contentEvents, [{ start: 0, end: 23 }]);
    });

    it('does not render a redraw while synchronized output is on, and renders it after', () => {
      coreService.decPrivateModes.synchronizedOutput = true;
      service.handleSelectionChanged([0, 3], [10, 5], false);
      window.runFrames();
      assert.deepEqual(renderer.rendered, []);

      coreService.decPrivateModes.synchronizedOutput = false;
      service.refreshRows(0, 0);
      window.runFrames();
      assert.deepEqual(renderer.rendered, [[0, 5]]);
    });
  });
});
