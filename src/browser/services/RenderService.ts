/**
 * Copyright (c) 2019 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import { IRenderer, IRenderDimensions, CharacterJoinerHandler } from 'browser/renderer/Types';
import { RenderDebouncer } from 'browser/RenderDebouncer';
import { EventEmitter, IEvent } from 'common/EventEmitter';
import { Disposable } from 'common/Lifecycle';
import { ScreenDprMonitor } from 'browser/ScreenDprMonitor';
import { addDisposableDomListener } from 'browser/Lifecycle';
import { IColorSet } from 'browser/Types';
import { IOptionsService, IBufferService } from 'common/services/Services';
import { ICharSizeService, IRenderService, ICoreBrowserService } from 'browser/services/Services';

export class RenderService extends Disposable implements IRenderService {
  serviceBrand: any;

  private _renderDebouncer: RenderDebouncer;
  private _screenDprMonitor: ScreenDprMonitor;
  private _cursorBlinkStateManager?: CursorBlinkStateManager;

  private _isPaused: boolean = false;
  private _needsFullRefresh: boolean = false;
  private _canvasWidth: number = 0;
  private _canvasHeight: number = 0;

  private _onDimensionsChange = new EventEmitter<IRenderDimensions>();
  public get onDimensionsChange(): IEvent<IRenderDimensions> { return this._onDimensionsChange.event; }
  private _onRender = new EventEmitter<{ start: number, end: number }>();
  public get onRender(): IEvent<{ start: number, end: number }> { return this._onRender.event; }
  private _onRefreshRequest = new EventEmitter<{ start: number, end: number }>();
  public get onRefreshRequest(): IEvent<{ start: number, end: number }> { return this._onRefreshRequest.event; }

  public get dimensions(): IRenderDimensions { return this._renderer.dimensions; }

  constructor(
    private _renderer: IRenderer,
    private _rowCount: number,
    readonly screenElement: HTMLElement,
    @IOptionsService readonly optionsService: IOptionsService,
    @ICharSizeService readonly charSizeService: ICharSizeService,
    @IBufferService readonly bufferService: IBufferService,
    @ICoreBrowserService private readonly _coreBrowserService: ICoreBrowserService
  ) {
    super();
    this._renderDebouncer = new RenderDebouncer((start, end) => this._renderRows(start, end));
    this.register(this._renderDebouncer);

    this._screenDprMonitor = new ScreenDprMonitor();
    this._screenDprMonitor.setListener(() => this.onDevicePixelRatioChange());
    this.register(this._screenDprMonitor);

    this.register(optionsService.onOptionChange(() => {
      if (this.optionsService.options.cursorBlink) {
        if (!this._cursorBlinkStateManager) {
          this._cursorBlinkStateManager = new CursorBlinkStateManager(this._coreBrowserService.isFocused, () => {
            // Refresh the cursor line when blink state changes
            this.refreshRows(this.bufferService.buffer.y, this.bufferService.buffer.y);
          });
        }
      } else {
        this._cursorBlinkStateManager?.dispose();
        this._cursorBlinkStateManager = undefined;
      }
      this._renderer.onOptionsChanged();
      this.refreshRows(this.bufferService.buffer.y, this.bufferService.buffer.y);
    }));
    this.register(charSizeService.onCharSizeChange(() => this.onCharSizeChanged()));

    // No need to register this as renderer is explicitly disposed in RenderService.dispose
    this._renderer.onRequestRefreshRows(e => this.refreshRows(e.start, e.end));

    // dprchange should handle this case, we need this as well for browsers that don't support the
    // matchMedia query.
    this.register(addDisposableDomListener(window, 'resize', () => this.onDevicePixelRatioChange()));

    // Detect whether IntersectionObserver is detected and enable renderer pause
    // and resume based on terminal visibility if so
    if ('IntersectionObserver' in window) {
      const observer = new IntersectionObserver(e => this._onIntersectionChange(e[e.length - 1]), { threshold: 0 });
      observer.observe(screenElement);
      this.register({ dispose: () => observer.disconnect() });
    }
  }

  private _onIntersectionChange(entry: IntersectionObserverEntry): void {
    this._isPaused = entry.intersectionRatio === 0;
    if (!this._isPaused && this._needsFullRefresh) {
      this.refreshRows(0, this._rowCount - 1);
      this._needsFullRefresh = false;
    }
  }

  public refreshRows(start: number, end: number): void {
    if (this._isPaused) {
      this._needsFullRefresh = true;
      return;
    }
    this._renderDebouncer.refresh(start, end, this._rowCount);
  }

  private _renderRows(start: number, end: number): void {
    const isCursorBlinking = !!this._cursorBlinkStateManager && !this._cursorBlinkStateManager.isCursorVisible;
    this._renderer.renderRows(start, end, isCursorBlinking);
    this._onRender.fire({ start, end });
  }

  public resize(cols: number, rows: number): void {
    this._rowCount = rows;
    this._fireOnCanvasResize();
  }

  private _fireOnCanvasResize(): void {
    // Don't fire the event if the dimensions haven't changed
    if (this._renderer.dimensions.canvasWidth === this._canvasWidth && this._renderer.dimensions.canvasHeight === this._canvasHeight) {
      return;
    }
    this._onDimensionsChange.fire(this._renderer.dimensions);
  }

  public dispose(): void {
    this._renderer.dispose();
    super.dispose();
  }

  public setRenderer(renderer: IRenderer): void {
    // TODO: RenderService should be the only one to dispose the renderer
    this._renderer.dispose();
    this._renderer = renderer;
    this._renderer.onRequestRefreshRows(e => this.refreshRows(e.start, e.end));
    this.refreshRows(0, this._rowCount - 1);
  }

  private _fullRefresh(): void {
    if (this._isPaused) {
      this._needsFullRefresh = true;
    } else {
      this.refreshRows(0, this._rowCount - 1);
    }
  }

  public setColors(colors: IColorSet): void {
    this._renderer.setColors(colors);
    this._fullRefresh();
  }

  public onDevicePixelRatioChange(): void {
    this._renderer.onDevicePixelRatioChange();
    this.refreshRows(0, this._rowCount - 1);
  }

  public onResize(cols: number, rows: number): void {
    this._renderer.onResize(cols, rows);
    this._fullRefresh();
  }

  // TODO: Is this useful when we have onResize?
  public onCharSizeChanged(): void {
    this._renderer.onCharSizeChanged();
  }

  public onBlur(): void {
    this._cursorBlinkStateManager?.pause();
    this._renderer.onBlur();
  }

  public onFocus(): void {
    this._cursorBlinkStateManager?.resume();
    this._renderer.onFocus();
  }

  public onSelectionChanged(start: [number, number], end: [number, number], columnSelectMode: boolean): void {
    this._renderer.onSelectionChanged(start, end, columnSelectMode);
  }

  public onCursorMove(): void {
    this._renderer.onCursorMove();
  }

  public clear(): void {
    this._renderer.clear();
  }

  public registerCharacterJoiner(handler: CharacterJoinerHandler): number {
    return this._renderer.registerCharacterJoiner(handler);
  }

  public deregisterCharacterJoiner(joinerId: number): boolean {
    return this._renderer.deregisterCharacterJoiner(joinerId);
  }
}

/**
 * The time between cursor blinks.
 */
const BLINK_INTERVAL = 600;

class CursorBlinkStateManager {
  public isCursorVisible: boolean;

  private _animationFrame: number | undefined;
  private _blinkStartTimeout: number | undefined;
  private _blinkInterval: number | undefined;

  /**
   * The time at which the animation frame was restarted, this is used on the
   * next render to restart the timers so they don't need to restart the timers
   * multiple times over a short period.
   */
  private _animationTimeRestarted: number | undefined;

  constructor(
    isFocused: boolean,
    private _renderCallback: () => void
  ) {
    this.isCursorVisible = true;
    if (isFocused) {
      this._restartInterval();
    }
  }

  public get isPaused(): boolean { return !(this._blinkStartTimeout || this._blinkInterval); }

  public dispose(): void {
    if (this._blinkInterval) {
      window.clearInterval(this._blinkInterval);
      this._blinkInterval = undefined;
    }
    if (this._blinkStartTimeout) {
      window.clearTimeout(this._blinkStartTimeout);
      this._blinkStartTimeout = undefined;
    }
    if (this._animationFrame) {
      window.cancelAnimationFrame(this._animationFrame);
      this._animationFrame = undefined;
    }
  }

  public restartBlinkAnimation(): void {
    if (this.isPaused) {
      return;
    }
    // Save a timestamp so that the restart can be done on the next interval
    this._animationTimeRestarted = Date.now();
    // Force a cursor render to ensure it's visible and in the correct position
    this.isCursorVisible = true;
    if (!this._animationFrame) {
      this._animationFrame = window.requestAnimationFrame(() => {
        this._renderCallback();
        this._animationFrame = undefined;
      });
    }
  }

  private _restartInterval(timeToStart: number = BLINK_INTERVAL): void {
    // Clear any existing interval
    if (this._blinkInterval) {
      window.clearInterval(this._blinkInterval);
    }

    // Setup the initial timeout which will hide the cursor, this is done before
    // the regular interval is setup in order to support restarting the blink
    // animation in a lightweight way (without thrashing clearInterval and
    // setInterval).
    this._blinkStartTimeout = <number><any>setTimeout(() => {
      // Check if another animation restart was requested while this was being
      // started
      if (this._animationTimeRestarted) {
        const time = BLINK_INTERVAL - (Date.now() - this._animationTimeRestarted);
        this._animationTimeRestarted = undefined;
        if (time > 0) {
          this._restartInterval(time);
          return;
        }
      }

      // Hide the cursor
      this.isCursorVisible = false;
      this._animationFrame = window.requestAnimationFrame(() => {
        this._renderCallback();
        this._animationFrame = undefined;
      });

      // Setup the blink interval
      this._blinkInterval = <number><any>setInterval(() => {
        // Adjust the animation time if it was restarted
        if (this._animationTimeRestarted) {
          // calc time diff
          // Make restart interval do a setTimeout initially?
          const time = BLINK_INTERVAL - (Date.now() - this._animationTimeRestarted);
          this._animationTimeRestarted = undefined;
          this._restartInterval(time);
          return;
        }

        // Invert visibility and render
        this.isCursorVisible = !this.isCursorVisible;
        this._animationFrame = window.requestAnimationFrame(() => {
          this._renderCallback();
          this._animationFrame = undefined;
        });
      }, BLINK_INTERVAL);
    }, timeToStart);
  }

  public pause(): void {
    this.isCursorVisible = true;
    if (this._blinkInterval) {
      window.clearInterval(this._blinkInterval);
      this._blinkInterval = undefined;
    }
    if (this._blinkStartTimeout) {
      window.clearTimeout(this._blinkStartTimeout);
      this._blinkStartTimeout = undefined;
    }
    if (this._animationFrame) {
      window.cancelAnimationFrame(this._animationFrame);
      this._animationFrame = undefined;
    }
  }

  public resume(): void {
    this._animationTimeRestarted = undefined;
    this._restartInterval();
    this.restartBlinkAnimation();
  }
}
