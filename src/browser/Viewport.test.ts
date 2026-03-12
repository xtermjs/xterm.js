/**
 * Copyright (c) 2026 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import { assert } from 'chai';
import jsdom = require('jsdom');
import { Viewport } from 'browser/Viewport';
import { MockThemeService } from 'browser/TestUtils.test';
import { createRenderDimensions } from 'browser/renderer/shared/RendererUtils';
import { Emitter } from 'common/Event';
import { MockBufferService, MockCoreService, MockMouseStateService, MockOptionsService } from 'common/TestUtils.test';
import { css } from 'common/Color';
import type { IRenderDimensions } from 'browser/renderer/shared/Types';
import type { ICoreBrowserService, IRenderService } from 'browser/services/Services';

class TestRenderService implements IRenderService {
  public serviceBrand: undefined;
  private readonly _onRender = new Emitter<{ start: number, end: number }>();

  public onDimensionsChange = new Emitter<IRenderDimensions>().event;
  public onRenderedViewportChange = new Emitter<{ start: number, end: number }>().event;
  public onRender = this._onRender.event;
  public onRefreshRequest = new Emitter<{ start: number, end: number }>().event;
  public dimensions: IRenderDimensions = createRenderDimensions();

  constructor() {
    this.dimensions.css.cell.height = 10;
    this.dimensions.css.canvas.height = 100;
  }

  public fireRender(): void {
    this._onRender.fire({ start: 0, end: 0 });
  }

  public addRefreshCallback(callback: FrameRequestCallback): number {
    callback(0);
    return 1;
  }
  public refreshRows(start: number, end: number, sync?: boolean): void { }
  public clearTextureAtlas(): void { }
  public resize(cols: number, rows: number): void { }
  public hasRenderer(): boolean { return true; }
  public setRenderer(renderer: any): void { }
  public handleDevicePixelRatioChange(): void { }
  public handleResize(cols: number, rows: number): void { }
  public handleCharSizeChanged(): void { }
  public handleBlur(): void { }
  public handleFocus(): void { }
  public handleSelectionChanged(start: [number, number] | undefined, end: [number, number] | undefined, columnSelectMode: boolean): void { }
  public handleCursorMove(): void { }
  public clear(): void { }
  public dispose(): void { }
}

describe('Viewport', () => {
  function setup(): {
    viewport: Viewport;
    renderService: TestRenderService;
    coreService: MockCoreService;
    dispose: () => void;
  } {
    const dom = new jsdom.JSDOM();
    const previousWindow = (globalThis as any).window;
    const previousDocument = (globalThis as any).document;
    (globalThis as any).window = dom.window;
    (globalThis as any).document = dom.window.document;

    const element = dom.window.document.createElement('div');
    const screenElement = dom.window.document.createElement('div');

    const optionsService = new MockOptionsService();
    const bufferService = new MockBufferService(80, 5, optionsService);
    const coreBrowserService: ICoreBrowserService = {
      serviceBrand: undefined,
      isFocused: true,
      onDprChange: new Emitter<number>().event,
      onWindowChange: new Emitter<Window & typeof globalThis>().event,
      window: dom.window as unknown as Window & typeof globalThis,
      mainDocument: dom.window.document,
      dpr: 1
    };

    const coreService = new MockCoreService();
    const mouseStateService = new MockMouseStateService();
    const themeService = new MockThemeService();
    (themeService.colors as any).scrollbarSliderBackground = css.toColor('#333333');
    (themeService.colors as any).scrollbarSliderHoverBackground = css.toColor('#444444');
    (themeService.colors as any).scrollbarSliderActiveBackground = css.toColor('#555555');
    const renderService = new TestRenderService();

    const viewport = new Viewport(
      element,
      screenElement,
      bufferService,
      coreBrowserService,
      coreService,
      mouseStateService,
      themeService,
      optionsService,
      renderService
    );

    return {
      viewport,
      renderService,
      coreService,
      dispose: () => {
        viewport.dispose();
        dom.window.close();
        (globalThis as any).window = previousWindow;
        (globalThis as any).document = previousDocument;
      }
    };
  }

  it('should defer DOM sync during synchronized output and flush on render', () => {
    const test = setup();
    let dimSyncCalls = 0;
    let posSyncCalls = 0;

    const scrollableElement = (test.viewport as any)._scrollableElement;
    scrollableElement.setScrollDimensions = () => { dimSyncCalls++; };
    scrollableElement.setScrollPosition = () => { posSyncCalls++; };

    test.coreService.decPrivateModes.synchronizedOutput = true;
    (test.viewport as any)._sync(3);

    assert.equal(dimSyncCalls, 0);
    assert.equal(posSyncCalls, 0);
    assert.equal((test.viewport as any)._needsSyncOnRender, true);

    test.coreService.decPrivateModes.synchronizedOutput = false;
    test.renderService.fireRender();

    assert.equal(dimSyncCalls, 1);
    assert.equal(posSyncCalls, 1);
    assert.equal((test.viewport as any)._needsSyncOnRender, false);

    test.dispose();
  });

  it('should sync DOM immediately when synchronized output is disabled', () => {
    const test = setup();
    let dimSyncCalls = 0;
    let posSyncCalls = 0;

    const scrollableElement = (test.viewport as any)._scrollableElement;
    scrollableElement.setScrollDimensions = () => { dimSyncCalls++; };
    scrollableElement.setScrollPosition = () => { posSyncCalls++; };

    test.coreService.decPrivateModes.synchronizedOutput = false;
    (test.viewport as any)._sync(2);

    assert.equal(dimSyncCalls, 1);
    assert.equal(posSyncCalls, 1);
    assert.equal((test.viewport as any)._needsSyncOnRender, false);

    test.dispose();
  });
});
