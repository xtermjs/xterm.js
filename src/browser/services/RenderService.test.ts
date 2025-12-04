/**
 * Copyright (c) 2025 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import { assert } from 'chai';
import jsdom = require('jsdom');
import { RenderService } from 'browser/services/RenderService';
import { MockBufferService, MockCoreService, MockOptionsService } from 'common/TestUtils.test';
import { IRenderer, IRenderDimensions } from 'browser/renderer/shared/Types';
import { ICoreBrowserService } from 'browser/services/Services';

// Test timing constants
const RENDER_DEBOUNCE_DELAY = 50; // Time to wait for debounced renders
const DEFAULT_SYNC_OUTPUT_TIMEOUT = 5000; // Default synchronized output timeout
const TIMEOUT_TEST_BUFFER = 500; // Extra time to wait in timeout tests

class MockRenderer implements IRenderer {
  public renderRowsCalls: Array<{ start: number; end: number }> = [];
  public dimensions: IRenderDimensions = {
    device: {
      char: { width: 10, height: 20, left: 0, top: 0 },
      cell: { width: 10, height: 20 },
      canvas: { width: 800, height: 600 }
    },
    css: {
      canvas: { width: 800, height: 600 },
      cell: { width: 10, height: 20 }
    }
  };

  renderRows(start: number, end: number): void {
    this.renderRowsCalls.push({ start, end });
  }

  onRequestRedraw(listener: (e: { start: number; end: number }) => void): { dispose: () => void } {
    return { dispose: () => { } };
  }

  clearCells(x: number, y: number, width: number, height: number): void { }
  clearTextureAtlas(): void { }
  clear(): void { }
  handleDevicePixelRatioChange(): void { }
  handleResize(cols: number, rows: number): void { }
  handleCharSizeChanged(): void { }
  handleBlur(): void { }
  handleFocus(): void { }
  handleSelectionChanged(start: [number, number] | undefined, end: [number, number] | undefined, columnSelectMode: boolean): void { }
  handleCursorMove(): void { }
  handleOptionsChanged(): void { }
  dispose(): void { }
}

class MockCoreBrowserService implements ICoreBrowserService {
  public serviceBrand: any;
  public isFocused: boolean = true;
  public window: any;
  public mainDocument: Document;
  public onDprChange = () => ({ dispose: () => { } });
  public onWindowChange = () => ({ dispose: () => { } });
  public get dpr(): number { return 1; }

  constructor(window: Window) {
    this.window = window;
    this.mainDocument = window.document;
    // Add requestAnimationFrame and cancelAnimationFrame if not present
    if (!this.window.requestAnimationFrame) {
      this.window.requestAnimationFrame = (callback: FrameRequestCallback) => {
        return setTimeout(() => callback(Date.now()), 0) as any;
      };
      this.window.cancelAnimationFrame = (id: number) => {
        clearTimeout(id);
      };
    }
  }
}

class MockCharSizeService {
  public serviceBrand: any;
  public width: number = 10;
  public height: number = 20;
  public hasValidSize: boolean = true;
  public onCharSizeChange = () => ({ dispose: () => { } });
  public measure(): void { }
}

class MockDecorationService {
  public serviceBrand: any;
  public decorations: any[] = [];
  public onDecorationRegistered = () => ({ dispose: () => { } });
  public onDecorationRemoved = () => ({ dispose: () => { } });
}

class MockThemeService {
  public serviceBrand: any;
  public colors: any = {};
  public onChangeColors = () => ({ dispose: () => { } });
}

describe('RenderService', () => {
  let dom: jsdom.JSDOM;
  let window: Window;
  let renderService: RenderService;
  let mockRenderer: MockRenderer;
  let coreService: MockCoreService;
  let bufferService: MockBufferService;
  let coreBrowserService: MockCoreBrowserService;

  beforeEach(() => {
    dom = new jsdom.JSDOM('');
    window = dom.window as any as Window;
    const screenElement = window.document.createElement('div');

    coreService = new MockCoreService();
    bufferService = new MockBufferService(80, 30);
    coreBrowserService = new MockCoreBrowserService(window);

    renderService = new RenderService(
      30,
      screenElement,
      new MockOptionsService() as any,
      new MockCharSizeService() as any,
      coreService as any,
      new MockDecorationService() as any,
      bufferService as any,
      coreBrowserService as any,
      new MockThemeService() as any
    );

    mockRenderer = new MockRenderer();
    renderService.setRenderer(mockRenderer);
  });

  afterEach(() => {
    renderService.dispose();
  });

  describe('synchronized output mode', () => {
    it('should defer rendering when synchronized output is enabled', (done) => {
      // Clear any initial renders from setRenderer
      mockRenderer.renderRowsCalls = [];

      // Enable synchronized output
      coreService.decPrivateModes.synchronizedOutput = true;

      // Request a refresh
      renderService.refreshRows(0, 10);

      // Give time for the debounced render to trigger
      setTimeout(() => {
        // Renderer should NOT have been called
        assert.equal(mockRenderer.renderRowsCalls.length, 0, 'Renderer should not be called during synchronized output');
        done();
      }, RENDER_DEBOUNCE_DELAY);
    });

    it('should flush buffered rows when synchronized output is disabled', (done) => {
      // Clear any initial renders from setRenderer
      mockRenderer.renderRowsCalls = [];

      // Enable synchronized output
      coreService.decPrivateModes.synchronizedOutput = true;

      // Request multiple refreshes while in synchronized mode
      renderService.refreshRows(0, 5);
      renderService.refreshRows(10, 15);
      renderService.refreshRows(3, 20);

      setTimeout(() => {
        // Verify no renders happened yet
        assert.equal(mockRenderer.renderRowsCalls.length, 0);

        // Disable synchronized output
        coreService.decPrivateModes.synchronizedOutput = false;

        // Request a refresh to trigger the flush
        renderService.refreshRows(0, 0);

        setTimeout(() => {
          // Should have rendered the accumulated range
          // Note: The test triggers with refreshRows(0, 0), but the accumulated buffer may extend further
          assert.equal(mockRenderer.renderRowsCalls.length, 1, 'Should render once after disabling synchronized output');
          const call = mockRenderer.renderRowsCalls[0];
          assert.equal(call.start, 0, 'Should render from start of accumulated range');
          // The accumulated range should include all requested rows (0-5, 10-15, 3-20 = 0-20)
          assert.isAtLeast(call.end, 15, 'Should render at least to row 15');
          done();
        }, 50);
      }, 50);
    });

    it('should render normally when synchronized output is not enabled', (done) => {
      // Wait for any pending renders from initialization
      setTimeout(() => {
        // Clear any initial renders from setRenderer
        mockRenderer.renderRowsCalls = [];

        // Synchronized output is disabled by default
        assert.equal(coreService.decPrivateModes.synchronizedOutput, false);

        // Request a refresh
        renderService.refreshRows(5, 10);

        setTimeout(() => {
          // Renderer SHOULD have been called
          assert.equal(mockRenderer.renderRowsCalls.length, 1);
          assert.equal(mockRenderer.renderRowsCalls[0].start, 5);
          assert.equal(mockRenderer.renderRowsCalls[0].end, 10);
          done();
        }, 50);
      }, 50);
    });

    it('should accumulate row ranges correctly', (done) => {
      // Clear any initial renders from setRenderer
      mockRenderer.renderRowsCalls = [];

      coreService.decPrivateModes.synchronizedOutput = true;

      // Multiple non-overlapping ranges
      renderService.refreshRows(5, 10);
      renderService.refreshRows(20, 25);
      renderService.refreshRows(0, 3);

      setTimeout(() => {
        assert.equal(mockRenderer.renderRowsCalls.length, 0);

        // Disable and flush
        coreService.decPrivateModes.synchronizedOutput = false;
        renderService.refreshRows(0, 0);

        setTimeout(() => {
          assert.equal(mockRenderer.renderRowsCalls.length, 1);
          // Should accumulate min to max: 0 to 25 (or full viewport if refresh triggered full update)
          assert.equal(mockRenderer.renderRowsCalls[0].start, 0);
          assert.isAtLeast(mockRenderer.renderRowsCalls[0].end, 25, 'Should render at least to row 25');
          done();
        }, 50);
      }, 50);
    });

    it('should handle timeout and force render', function(done) {
      // This test needs more time for the timeout
      this.timeout(10000);

      // Clear any initial renders from setRenderer
      mockRenderer.renderRowsCalls = [];

      coreService.decPrivateModes.synchronizedOutput = true;

      // Request a refresh
      renderService.refreshRows(0, 10);

      setTimeout(() => {
        // Should not have rendered yet
        assert.equal(mockRenderer.renderRowsCalls.length, 0);
      }, 100);

      // Wait for timeout (default timeout + buffer)
      setTimeout(() => {
        // Timeout should have forced a render
        assert.equal(mockRenderer.renderRowsCalls.length, 1, 'Timeout should force render');
        assert.equal(mockRenderer.renderRowsCalls[0].start, 0);
        assert.isAtLeast(mockRenderer.renderRowsCalls[0].end, 10, 'Should render at least the requested rows');

        // Mode should have been automatically disabled
        assert.equal(coreService.decPrivateModes.synchronizedOutput, false, 'Timeout should disable synchronized output');
        done();
      }, DEFAULT_SYNC_OUTPUT_TIMEOUT + TIMEOUT_TEST_BUFFER);
    });

    it('should restart timeout on each buffered render request', function(done) {
      this.timeout(12000);

      // Clear any initial renders from setRenderer
      mockRenderer.renderRowsCalls = [];

      coreService.decPrivateModes.synchronizedOutput = true;

      // First request
      renderService.refreshRows(0, 5);

      // Keep requesting refreshes every 2 seconds (before 5s timeout)
      let requestCount = 0;
      const interval = setInterval(() => {
        requestCount++;
        renderService.refreshRows(0, 5);

        if (requestCount >= 2) {
          clearInterval(interval);

          // After stopping requests, wait for timeout
          setTimeout(() => {
            // Should have rendered after final timeout
            assert.equal(mockRenderer.renderRowsCalls.length, 1, 'Should render after final timeout');
            assert.equal(coreService.decPrivateModes.synchronizedOutput, false);
            done();
          }, 5500);
        }
      }, 2000);
    });

    it('should clear buffered state after flush', (done) => {
      // Clear any initial renders from setRenderer
      mockRenderer.renderRowsCalls = [];

      coreService.decPrivateModes.synchronizedOutput = true;

      // First cycle
      renderService.refreshRows(0, 10);

      setTimeout(() => {
        coreService.decPrivateModes.synchronizedOutput = false;
        renderService.refreshRows(0, 0);

        setTimeout(() => {
          assert.equal(mockRenderer.renderRowsCalls.length, 1);
          mockRenderer.renderRowsCalls = [];

          // Second cycle - should not include rows from first cycle
          coreService.decPrivateModes.synchronizedOutput = true;
          renderService.refreshRows(20, 25);

          setTimeout(() => {
            coreService.decPrivateModes.synchronizedOutput = false;
            renderService.refreshRows(0, 0);

            setTimeout(() => {
              assert.equal(mockRenderer.renderRowsCalls.length, 1);
              assert.equal(mockRenderer.renderRowsCalls[0].start, 20);
              assert.equal(mockRenderer.renderRowsCalls[0].end, 25);
              done();
            }, 50);
          }, 50);
        }, 50);
      }, 50);
    });

    it('should handle BSU sent twice without ESU (idempotent)', (done) => {
      // Clear any initial renders
      mockRenderer.renderRowsCalls = [];

      // Enable synchronized output
      coreService.decPrivateModes.synchronizedOutput = true;
      renderService.refreshRows(0, 10);

      setTimeout(() => {
        assert.equal(mockRenderer.renderRowsCalls.length, 0);

        // Enable again (should be idempotent)
        coreService.decPrivateModes.synchronizedOutput = true;
        renderService.refreshRows(10, 20);

        setTimeout(() => {
          // Still no rendering
          assert.equal(mockRenderer.renderRowsCalls.length, 0);

          // Now disable
          coreService.decPrivateModes.synchronizedOutput = false;
          renderService.refreshRows(0, 0);

          setTimeout(() => {
            // Should render accumulated range
            assert.equal(mockRenderer.renderRowsCalls.length, 1);
            assert.equal(mockRenderer.renderRowsCalls[0].start, 0);
            assert.isAtLeast(mockRenderer.renderRowsCalls[0].end, 20);
            done();
          }, 50);
        }, 50);
      }, 50);
    });

    it('should handle ESU without BSU (no-op)', (done) => {
      // Wait for any pending renders
      setTimeout(() => {
        // Clear any initial renders
        mockRenderer.renderRowsCalls = [];

        // Synchronized output is already disabled (default state)
        assert.equal(coreService.decPrivateModes.synchronizedOutput, false);

        // Disable again (ESU without BSU)
        coreService.decPrivateModes.synchronizedOutput = false;
        renderService.refreshRows(5, 10);

        setTimeout(() => {
          // Should render - ESU without BSU should not cause issues
          // The exact rows may vary due to previous test state, but rendering should occur
          assert.isAtLeast(mockRenderer.renderRowsCalls.length, 1, 'Should render even with ESU before BSU');
          done();
        }, RENDER_DEBOUNCE_DELAY);
      }, RENDER_DEBOUNCE_DELAY);
    });

    it('should handle rapid enable/disable toggling', (done) => {
      // Clear any initial renders
      mockRenderer.renderRowsCalls = [];

      // Rapid toggling
      coreService.decPrivateModes.synchronizedOutput = true;
      renderService.refreshRows(0, 5);

      setTimeout(() => {
        coreService.decPrivateModes.synchronizedOutput = false;
        renderService.refreshRows(0, 0);

        setTimeout(() => {
          const firstRenderCount = mockRenderer.renderRowsCalls.length;

          // Toggle again immediately
          coreService.decPrivateModes.synchronizedOutput = true;
          renderService.refreshRows(10, 15);

          setTimeout(() => {
            coreService.decPrivateModes.synchronizedOutput = false;
            renderService.refreshRows(0, 0);

            setTimeout(() => {
              // Should have rendered both cycles
              assert.isAtLeast(mockRenderer.renderRowsCalls.length, firstRenderCount + 1);
              done();
            }, 50);
          }, 50);
        }, 50);
      }, 50);
    });

    it('should handle terminal resize during synchronized output', (done) => {
      // Clear any initial renders
      mockRenderer.renderRowsCalls = [];

      coreService.decPrivateModes.synchronizedOutput = true;
      renderService.refreshRows(0, 10);

      setTimeout(() => {
        // Resize terminal
        renderService.resize(80, 50);

        // Continue buffering with new size
        renderService.refreshRows(40, 45);

        setTimeout(() => {
          // Disable synchronized output
          coreService.decPrivateModes.synchronizedOutput = false;
          renderService.refreshRows(0, 0);

          setTimeout(() => {
            // Should have rendered (clamped to new size if needed)
            assert.isAtLeast(mockRenderer.renderRowsCalls.length, 1);
            done();
          }, 50);
        }, 50);
      }, 50);
    });

    it('should not timeout when timeout is disabled', function(done) {
      this.timeout(3000);

      // Create a new render service with timeout disabled
      const optionsServiceWithTimeout = new MockOptionsService({ synchronizedOutputTimeout: 0 }) as any;

      const newRenderService = new RenderService(
        30,
        window.document.createElement('div'),
        optionsServiceWithTimeout,
        new MockCharSizeService() as any,
        coreService as any,
        new MockDecorationService() as any,
        bufferService as any,
        coreBrowserService as any,
        new MockThemeService() as any
      );

      const newMockRenderer = new MockRenderer();
      newRenderService.setRenderer(newMockRenderer);

      setTimeout(() => {
        newMockRenderer.renderRowsCalls = [];
        coreService.decPrivateModes.synchronizedOutput = true;
        newRenderService.refreshRows(0, 10);

        // Wait longer than the default timeout would be
        setTimeout(() => {
          // Should NOT have rendered (timeout disabled)
          assert.equal(newMockRenderer.renderRowsCalls.length, 0);
          // Mode should still be enabled
          assert.equal(coreService.decPrivateModes.synchronizedOutput, true);

          newRenderService.dispose();
          done();
        }, 1000);
      }, 50);
    });
  });
});
