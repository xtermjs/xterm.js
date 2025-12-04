/**
 * Copyright (c) 2019 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import { RenderDebouncer } from 'browser/RenderDebouncer';
import { IRenderDebouncerWithCallback } from 'browser/Types';
import { IRenderDimensions, IRenderer } from 'browser/renderer/shared/Types';
import { ICharSizeService, ICoreBrowserService, IRenderService, IThemeService } from 'browser/services/Services';
import { Disposable, MutableDisposable, toDisposable } from 'vs/base/common/lifecycle';
import { DebouncedIdleTask } from 'common/TaskQueue';
import { IBufferService, ICoreService, IDecorationService, IOptionsService } from 'common/services/Services';
import { Emitter } from 'vs/base/common/event';

interface ISelectionState {
  start: [number, number] | undefined;
  end: [number, number] | undefined;
  columnSelectMode: boolean;
}


export class RenderService extends Disposable implements IRenderService {
  public serviceBrand: undefined;

  private _renderer: MutableDisposable<IRenderer> = this._register(new MutableDisposable());
  private _renderDebouncer: IRenderDebouncerWithCallback;
  private _pausedResizeTask = new DebouncedIdleTask();
  private _observerDisposable = this._register(new MutableDisposable());

  private _isPaused: boolean = false;
  private _needsFullRefresh: boolean = false;
  private _isNextRenderRedrawOnly: boolean = true;
  private _needsSelectionRefresh: boolean = false;
  private _canvasWidth: number = 0;
  private _canvasHeight: number = 0;
  private _synchronizedOutputTimeout: number | undefined;
  private _synchronizedOutputStart: number = 0;
  private _synchronizedOutputEnd: number = 0;
  private _selectionState: ISelectionState = {
    start: undefined,
    end: undefined,
    columnSelectMode: false
  };

  private readonly _onDimensionsChange = this._register(new Emitter<IRenderDimensions>());
  public readonly onDimensionsChange = this._onDimensionsChange.event;
  private readonly _onRenderedViewportChange = this._register(new Emitter<{ start: number, end: number }>());
  public readonly onRenderedViewportChange = this._onRenderedViewportChange.event;
  private readonly _onRender = this._register(new Emitter<{ start: number, end: number }>());
  public readonly onRender = this._onRender.event;
  private readonly _onRefreshRequest = this._register(new Emitter<{ start: number, end: number }>());
  public readonly onRefreshRequest = this._onRefreshRequest.event;

  public get dimensions(): IRenderDimensions { return this._renderer.value!.dimensions; }

  constructor(
    private _rowCount: number,
    screenElement: HTMLElement,
    @IOptionsService private readonly _optionsService: IOptionsService,
    @ICharSizeService private readonly _charSizeService: ICharSizeService,
    @ICoreService private readonly _coreService: ICoreService,
    @IDecorationService decorationService: IDecorationService,
    @IBufferService bufferService: IBufferService,
    @ICoreBrowserService private readonly _coreBrowserService: ICoreBrowserService,
    @IThemeService themeService: IThemeService
  ) {
    super();

    this._renderDebouncer = new RenderDebouncer((start, end) => this._renderRows(start, end), this._coreBrowserService);
    this._register(this._renderDebouncer);

    // Clear synchronized output timeout on dispose
    this._register(toDisposable(() => {
      if (this._synchronizedOutputTimeout !== undefined) {
        this._coreBrowserService.window.clearTimeout(this._synchronizedOutputTimeout);
      }
    }));

    this._register(this._coreBrowserService.onDprChange(() => this.handleDevicePixelRatioChange()));

    this._register(bufferService.onResize(() => this._fullRefresh()));
    this._register(bufferService.buffers.onBufferActivate(() => this._renderer.value?.clear()));
    this._register(this._optionsService.onOptionChange(() => this._handleOptionsChanged()));
    this._register(this._charSizeService.onCharSizeChange(() => this.handleCharSizeChanged()));

    // Do a full refresh whenever any decoration is added or removed. This may not actually result
    // in changes but since decorations should be used sparingly or added/removed all in the same
    // frame this should have minimal performance impact.
    this._register(decorationService.onDecorationRegistered(() => this._fullRefresh()));
    this._register(decorationService.onDecorationRemoved(() => this._fullRefresh()));

    // Clear the renderer when the a change that could affect glyphs occurs
    this._register(this._optionsService.onMultipleOptionChange([
      'customGlyphs',
      'drawBoldTextInBrightColors',
      'letterSpacing',
      'lineHeight',
      'fontFamily',
      'fontSize',
      'fontWeight',
      'fontWeightBold',
      'minimumContrastRatio',
      'rescaleOverlappingGlyphs'
    ], () => {
      this.clear();
      this.handleResize(bufferService.cols, bufferService.rows);
      this._fullRefresh();
    }));

    // Refresh the cursor line when the cursor changes
    this._register(this._optionsService.onMultipleOptionChange([
      'cursorBlink',
      'cursorStyle'
    ], () => this.refreshRows(bufferService.buffer.y, bufferService.buffer.y, true)));

    this._register(themeService.onChangeColors(() => this._fullRefresh()));

    this._registerIntersectionObserver(this._coreBrowserService.window, screenElement);
    this._register(this._coreBrowserService.onWindowChange((w) => this._registerIntersectionObserver(w, screenElement)));
  }

  private _registerIntersectionObserver(w: Window & typeof globalThis, screenElement: HTMLElement): void {
    // Detect whether IntersectionObserver is detected and enable renderer pause
    // and resume based on terminal visibility if so
    if ('IntersectionObserver' in w) {
      const observer = new w.IntersectionObserver(e => this._handleIntersectionChange(e[e.length - 1]), { threshold: 0 });
      observer.observe(screenElement);
      this._observerDisposable.value = toDisposable(() => observer.disconnect());
    }
  }

  private _handleIntersectionChange(entry: IntersectionObserverEntry): void {
    this._isPaused = entry.isIntersecting === undefined ? (entry.intersectionRatio === 0) : !entry.isIntersecting;

    // Terminal was hidden on open
    if (!this._isPaused && !this._charSizeService.hasValidSize) {
      this._charSizeService.measure();
    }

    if (!this._isPaused && this._needsFullRefresh) {
      this._pausedResizeTask.flush();
      this.refreshRows(0, this._rowCount - 1);
      this._needsFullRefresh = false;
    }
  }

  public refreshRows(start: number, end: number, isRedrawOnly: boolean = false): void {
    if (this._isPaused) {
      this._needsFullRefresh = true;
      return;
    }

    // Handle synchronized output mode (DEC 2026)
    if (this._coreService.decPrivateModes.synchronizedOutput) {
      // Track the row range that needs refreshing
      if (!this._needsFullRefresh) {
        // First request in this sync cycle
        this._synchronizedOutputStart = start;
        this._synchronizedOutputEnd = end;
        this._needsFullRefresh = true;
      } else {
        // Expand the tracked range to include new rows
        this._synchronizedOutputStart = Math.min(this._synchronizedOutputStart, start);
        this._synchronizedOutputEnd = Math.max(this._synchronizedOutputEnd, end);
      }
      // Start a safety timeout if not already running and timeout is enabled
      const timeout = this._optionsService.options.synchronizedOutputTimeout;
      if (this._synchronizedOutputTimeout === undefined && timeout && timeout > 0) {
        this._synchronizedOutputTimeout = this._coreBrowserService.window.setTimeout(() => {
          this._synchronizedOutputTimeout = undefined;
          // Force-disable the mode and trigger a refresh
          this._coreService.decPrivateModes.synchronizedOutput = false;
          this._fullRefresh();
        }, timeout);
      }
      return;
    }

    // Clear the timeout if synchronized output mode was just disabled
    if (this._synchronizedOutputTimeout !== undefined) {
      this._coreBrowserService.window.clearTimeout(this._synchronizedOutputTimeout);
      this._synchronizedOutputTimeout = undefined;
    }

    // If we were in synchronized output mode, use the tracked row range
    if (this._needsFullRefresh) {
      start = this._synchronizedOutputStart;
      end = this._synchronizedOutputEnd;
      this._needsFullRefresh = false;
    }

    if (!isRedrawOnly) {
      this._isNextRenderRedrawOnly = false;
    }
    this._renderDebouncer.refresh(start, end, this._rowCount);
  }

  private _renderRows(start: number, end: number): void {
    if (!this._renderer.value) {
      return;
    }

    // Skip rendering if synchronized output mode is enabled. This check must happen here
    // (in addition to refreshRows) to handle renders that were queued before the mode was enabled.
    if (this._coreService.decPrivateModes.synchronizedOutput) {
      // Track the row range that needs refreshing
      if (!this._needsFullRefresh) {
        this._synchronizedOutputStart = start;
        this._synchronizedOutputEnd = end;
        this._needsFullRefresh = true;
      } else {
        this._synchronizedOutputStart = Math.min(this._synchronizedOutputStart, start);
        this._synchronizedOutputEnd = Math.max(this._synchronizedOutputEnd, end);
      }
      return;
    }

    // Since this is debounced, a resize event could have happened between the time a refresh was
    // requested and when this triggers. Clamp the values of start and end to ensure they're valid
    // given the current viewport state.
    start = Math.min(start, this._rowCount - 1);
    end = Math.min(end, this._rowCount - 1);

    // Render
    this._renderer.value.renderRows(start, end);

    // Update selection if needed
    if (this._needsSelectionRefresh) {
      this._renderer.value.handleSelectionChanged(this._selectionState.start, this._selectionState.end, this._selectionState.columnSelectMode);
      this._needsSelectionRefresh = false;
    }

    // Fire render event only if it was not a redraw
    if (!this._isNextRenderRedrawOnly) {
      this._onRenderedViewportChange.fire({ start, end });
    }
    this._onRender.fire({ start, end });
    this._isNextRenderRedrawOnly = true;
  }

  public resize(cols: number, rows: number): void {
    this._rowCount = rows;
    this._fireOnCanvasResize();
  }

  private _handleOptionsChanged(): void {
    if (!this._renderer.value) {
      return;
    }
    this.refreshRows(0, this._rowCount - 1);
    this._fireOnCanvasResize();
  }

  private _fireOnCanvasResize(): void {
    if (!this._renderer.value) {
      return;
    }
    // Don't fire the event if the dimensions haven't changed
    if (this._renderer.value.dimensions.css.canvas.width === this._canvasWidth && this._renderer.value.dimensions.css.canvas.height === this._canvasHeight) {
      return;
    }
    this._onDimensionsChange.fire(this._renderer.value.dimensions);
  }

  public hasRenderer(): boolean {
    return !!this._renderer.value;
  }

  public setRenderer(renderer: IRenderer): void {
    this._renderer.value = renderer;
    // If the value was not set, the terminal is being disposed so ignore it
    if (this._renderer.value) {
      this._renderer.value.onRequestRedraw(e => this.refreshRows(e.start, e.end, true));

      // Force a refresh
      this._needsSelectionRefresh = true;
      this._fullRefresh();
    }
  }

  public addRefreshCallback(callback: FrameRequestCallback): number {
    return this._renderDebouncer.addRefreshCallback(callback);
  }

  private _fullRefresh(): void {
    if (this._isPaused) {
      this._needsFullRefresh = true;
    } else {
      this.refreshRows(0, this._rowCount - 1);
    }
  }

  public clearTextureAtlas(): void {
    if (!this._renderer.value) {
      return;
    }
    this._renderer.value.clearTextureAtlas?.();
    this._fullRefresh();
  }

  public handleDevicePixelRatioChange(): void {
    // Force char size measurement as DomMeasureStrategy(getBoundingClientRect) is not stable
    // when devicePixelRatio changes
    this._charSizeService.measure();

    if (!this._renderer.value) {
      return;
    }
    this._renderer.value.handleDevicePixelRatioChange();
    this.refreshRows(0, this._rowCount - 1);
  }

  public handleResize(cols: number, rows: number): void {
    if (!this._renderer.value) {
      return;
    }
    if (this._isPaused) {
      this._pausedResizeTask.set(() => this._renderer.value?.handleResize(cols, rows));
    } else {
      this._renderer.value.handleResize(cols, rows);
    }
    this._fullRefresh();
  }

  // TODO: Is this useful when we have onResize?
  public handleCharSizeChanged(): void {
    this._renderer.value?.handleCharSizeChanged();
  }

  public handleBlur(): void {
    this._renderer.value?.handleBlur();
  }

  public handleFocus(): void {
    this._renderer.value?.handleFocus();
  }

  public handleSelectionChanged(start: [number, number] | undefined, end: [number, number] | undefined, columnSelectMode: boolean): void {
    this._selectionState.start = start;
    this._selectionState.end = end;
    this._selectionState.columnSelectMode = columnSelectMode;
    this._renderer.value?.handleSelectionChanged(start, end, columnSelectMode);
  }

  public handleCursorMove(): void {
    this._renderer.value?.handleCursorMove();
  }

  public clear(): void {
    this._renderer.value?.clear();
  }
}
