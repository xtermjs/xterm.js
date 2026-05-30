/**
 * Copyright (c) 2026 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import { perfContext, before, RuntimeCase } from 'xterm-benchmark';
import { DecorationService } from 'common/services/DecorationService';
import { MockLogService, MockBufferService, MockOptionsService } from 'common/terminal/TestUtils.test';
const enum Constants {
  COLS = 80,
  ROWS = 30,
  SINGLE_LINE_DECORATION_COUNT = 20_000,
  MULTI_LINE_DECORATION_COUNT = 19_999,
  MULTI_LINE_HEIGHT = 2,
  VIEWPORT_SCAN_ITERATIONS = 20
}

function registerSingleLineDecorations(service: DecorationService, bufferService: MockBufferService, count: number): void {
  const buffer = bufferService.buffer;
  for (let i = 0; i < count; i++) {
    const line = i % 5000;
    const marker = buffer.addMarker(line);
    service.registerDecoration({ marker, width: Constants.COLS });
  }
}

function registerMixedDecorations(service: DecorationService, bufferService: MockBufferService): void {
  const buffer = bufferService.buffer;
  for (let i = 0; i < Constants.MULTI_LINE_DECORATION_COUNT; i++) {
    const line = i % 5000;
    const marker = buffer.addMarker(line);
    service.registerDecoration({ marker, width: Constants.COLS });
  }
  const multiLineMarker = buffer.addMarker(10);
  service.registerDecoration({
    marker: multiLineMarker,
    width: Constants.COLS,
    height: Constants.MULTI_LINE_HEIGHT
  });
}

function scanVisibleGrid(service: DecorationService, rows: number, cols: number): number {
  let hitCount = 0;
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      service.forEachDecorationAtCell(col, row, undefined, () => {
        hitCount++;
      });
    }
  }
  return hitCount;
}

perfContext('DecorationService.forEachDecorationAtCell', () => {
  perfContext('single-line dense / sparse line hit', () => {
    let service: DecorationService;
    let bufferService: MockBufferService;
    before(() => {
      bufferService = new MockBufferService(Constants.COLS, Constants.ROWS, new MockOptionsService());
      service = new DecorationService(new MockLogService(), bufferService);
      registerSingleLineDecorations(service, bufferService, Constants.SINGLE_LINE_DECORATION_COUNT);
    });
    new RuntimeCase('', () => {
      let hitCount = 0;
      for (let i = 0; i < Constants.VIEWPORT_SCAN_ITERATIONS; i++) {
        service.forEachDecorationAtCell(0, 0, undefined, () => {
          hitCount++;
        });
      }
      return { payloadSize: Constants.VIEWPORT_SCAN_ITERATIONS, hitCount };
    }, { fork: false }).showAverageRuntime();
  });

  perfContext('mixed single-line + multi-line / sparse line hit', () => {
    let service: DecorationService;
    let bufferService: MockBufferService;
    before(() => {
      bufferService = new MockBufferService(Constants.COLS, Constants.ROWS, new MockOptionsService());
      service = new DecorationService(new MockLogService(), bufferService);
      registerMixedDecorations(service, bufferService);
    });
    new RuntimeCase('', () => {
      let hitCount = 0;
      for (let i = 0; i < Constants.VIEWPORT_SCAN_ITERATIONS; i++) {
        service.forEachDecorationAtCell(0, 10, undefined, () => {
          hitCount++;
        });
      }
      return { payloadSize: Constants.VIEWPORT_SCAN_ITERATIONS, hitCount };
    }, { fork: false }).showAverageRuntime();
  });

  perfContext('viewport grid scan', () => {
    let service: DecorationService;
    let bufferService: MockBufferService;
    before(() => {
      bufferService = new MockBufferService(Constants.COLS, Constants.ROWS, new MockOptionsService());
      service = new DecorationService(new MockLogService(), bufferService);
      registerSingleLineDecorations(service, bufferService, Constants.SINGLE_LINE_DECORATION_COUNT);
    });
    new RuntimeCase('', () => {
      let totalHits = 0;
      for (let i = 0; i < Constants.VIEWPORT_SCAN_ITERATIONS; i++) {
        totalHits += scanVisibleGrid(service, Constants.ROWS, Constants.COLS);
      }
      return { payloadSize: Constants.VIEWPORT_SCAN_ITERATIONS * Constants.ROWS * Constants.COLS, totalHits };
    }, { fork: false }).showAverageRuntime();
  });
});
