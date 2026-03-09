/**
 * Copyright (c) 2019 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import jsdom = require('jsdom');
import { assert } from 'chai';
import { RenderService } from 'browser/services/RenderService';
import { IRenderDimensions, IRenderer, IRequestRedrawEvent } from 'browser/renderer/shared/Types';
import { MockBufferService, MockOptionsService, MockCoreService, MockLogService, MockDecorationService } from 'common/TestUtils.test';
import { MockCharSizeService, MockThemeService } from 'browser/TestUtils.test';
import { ICoreBrowserService } from 'browser/services/Services';
import { IEvent, Emitter } from 'common/Event';

class TestCoreBrowserService implements ICoreBrowserService {
  public serviceBrand: undefined;
  public isFocused: boolean = true;
  public dpr: number = 1;
  public onDprChange: IEvent<number> = new Emitter<number>().event;
  public onWindowChange: IEvent<Window & typeof globalThis> = new Emitter<Window & typeof globalThis>().event;

  constructor(private _window: Window & typeof globalThis) {}

  public get window(): Window & typeof globalThis {
    return this._window;
  }

  public get mainDocument(): Document {
    return this._window.document;
  }
}

class MockRenderer implements IRenderer {
  public readonly dimensions: IRenderDimensions;
  private readonly _onRequestRedraw = new Emitter<IRequestRedrawEvent>();
  public readonly onRequestRedraw: IEvent<IRequestRedrawEvent> = this._onRequestRedraw.event;
  public readonly onContextLoss: IEvent<void> = new Emitter<void>().event;

  constructor(cellWidth: number = 10, cellHeight: number = 20) {
    this.dimensions = {
      css: {
        canvas: { width: cellWidth * 80, height: cellHeight * 24 },
        cell: { width: cellWidth, height: cellHeight }
      },
      device: {
        canvas: { width: cellWidth * 80 * 2, height: cellHeight * 24 * 2 },
        cell: { width: cellWidth * 2, height: cellHeight * 2 },
        char: { width: cellWidth * 2 - 1, height: cellHeight * 2 - 2, top: 0, left: 0 }
      }
    };
  }

  public dispose(): void {}
  public handleDevicePixelRatioChange(): void {}
  public handleResize(cols: number, rows: number): void {}
  public handleCharSizeChanged(): void {}
  public handleBlur(): void {}
  public handleFocus(): void {}
  public handleSelectionChanged(start: [number, number] | undefined, end: [number, number] | undefined, columnSelectMode: boolean): void {}
  public handleCursorMove(): void {}
  public clear(): void {}
  public renderRows(start: number, end: number): void {}
  public clearTextureAtlas(): void {}
}

describe('RenderService', () => {
  let dom: jsdom.JSDOM;
  let screenElement: HTMLElement;
  let renderService: RenderService;
  let optionsService: MockOptionsService;
  let bufferService: MockBufferService;

  beforeEach(() => {
    dom = new jsdom.JSDOM('');
    (dom.window as any).requestAnimationFrame = (cb: FrameRequestCallback): number => dom.window.setTimeout(() => cb(0), 0);
    (dom.window as any).cancelAnimationFrame = (id: number): void => dom.window.clearTimeout(id);
    screenElement = dom.window.document.createElement('div');

    optionsService = new MockOptionsService();
    bufferService = new MockBufferService(80, 24, optionsService);

    renderService = new RenderService(
      24, // rowCount
      screenElement,
      optionsService,
      new MockLogService(),
      new MockCharSizeService(10, 20),
      new MockCoreService(),
      new MockDecorationService(),
      bufferService,
      new TestCoreBrowserService(dom.window as unknown as Window & typeof globalThis),
      new MockThemeService()
    );
  });

  afterEach(() => {
    try {
      renderService.dispose();
    } catch (_e) {
      // Already disposed
    }
  });

  describe('dimensions', () => {
    it('should return default dimensions when renderer is not set', () => {
      assert.isFalse(renderService.hasRenderer());
      const dimensions = renderService.dimensions;
      assert.isDefined(dimensions);
      assert.strictEqual(dimensions.css.canvas.width, 0);
      assert.strictEqual(dimensions.css.canvas.height, 0);
      assert.strictEqual(dimensions.css.cell.width, 0);
      assert.strictEqual(dimensions.css.cell.height, 0);
      assert.strictEqual(dimensions.device.canvas.width, 0);
      assert.strictEqual(dimensions.device.canvas.height, 0);
      assert.strictEqual(dimensions.device.cell.width, 0);
      assert.strictEqual(dimensions.device.cell.height, 0);
      assert.strictEqual(dimensions.device.char.width, 0);
      assert.strictEqual(dimensions.device.char.height, 0);
    });

    it('should return renderer dimensions when renderer is set', () => {
      const mockRenderer = new MockRenderer(10, 20);
      renderService.setRenderer(mockRenderer);
      assert.isTrue(renderService.hasRenderer());
      const dimensions = renderService.dimensions;
      assert.strictEqual(dimensions, mockRenderer.dimensions);
      assert.strictEqual(dimensions.css.cell.width, 10);
      assert.strictEqual(dimensions.css.cell.height, 20);
    });

    it('should return default dimensions after service is disposed', () => {
      const mockRenderer = new MockRenderer(10, 20);
      renderService.setRenderer(mockRenderer);
      assert.strictEqual(renderService.dimensions.css.cell.width, 10);
      renderService.dispose();
      const dimensions = renderService.dimensions;
      assert.isDefined(dimensions);
      assert.strictEqual(dimensions.css.cell.width, 0);
      assert.strictEqual(dimensions.css.cell.height, 0);
    });
  });
});

